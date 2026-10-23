'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../js/core.js');

test('parse: people, tasks, combined cells, errors', () => {
  const m = r.parse('Task | Asha | Ravi\nPlan | a/r | C\nBuild | I | ar\n\nOdd | X | R, c\n | R | R\nMany | R | R | R');
  assert.deepEqual(m.people, ['Asha', 'Ravi']);
  assert.equal(m.tasks.length, 4);
  assert.deepEqual(m.tasks[0].cells, ['AR', 'C']);
  assert.deepEqual(m.tasks[1].cells, ['I', 'AR']);
  assert.deepEqual(m.tasks[2].cells, ['', 'RC'], 'an unknown letter is dropped');
  assert.ok(m.errors.some((e) => /Line 5: cell for Asha has "X"/.test(e)));
  assert.ok(m.errors.some((e) => /Line 6: the task has no name/.test(e)));
  assert.ok(m.errors.some((e) => /Line 7: more cells than people/.test(e)));
  assert.deepEqual(r.parse('').tasks, []);
});

test('parse: bad header and duplicates', () => {
  assert.match(r.parse('Task\nA | R').errors[0], /first line must name the people/);
  assert.match(r.parse('Task | Asha | asha\nA | R | A').errors[0], /appears twice/);
  assert.deepEqual(r.parse('Task | Asha |\nA | R').people, ['Asha'], 'a trailing bar is ignored');
});

test('check finds missing and duplicate owners, idle and overloaded people', () => {
  const m = r.parse(
    'Task | Asha | Ravi | Zed\nA | R | R | \nB | A | A | \nC | A/R | I | \nD | A/R | | \nE | A/R | | \nF | A/R | | \nG | A/R | |',
  );
  const k = r.check(m, 5);
  const kinds = k.map((x) => x.kind);
  assert.ok(kinds.indexOf('no-accountable') !== -1);
  assert.ok(kinds.indexOf('many-accountable') !== -1);
  assert.ok(kinds.indexOf('no-responsible') !== -1, 'task B has no R');
  assert.ok(k.some((x) => x.kind === 'idle' && x.person === 'Zed'));
  assert.ok(k.some((x) => x.kind === 'overloaded' && x.person === 'Asha'));
  assert.equal(
    r.check(m, 10).some((x) => x.kind === 'overloaded'),
    false,
  );
  assert.match(k.find((x) => x.kind === 'no-accountable').message, /Task 1 "A" has nobody Accountable/);
});

test('sample chart is clean except for the deliberate go-live demo', () => {
  const m = r.parse(r.sample());
  assert.deepEqual(m.errors, []);
  assert.equal(m.people.length, 5);
  assert.equal(m.tasks.length, 7);
  const problems = r.check(m);
  assert.deepEqual(problems, [], 'the sample has exactly one A and at least one R per task');
});

test('load counts per person', () => {
  const m = r.parse(r.sample());
  const l = r.load(m);
  const asha = l.find((x) => x.person.indexOf('Asha') === 0);
  assert.deepEqual([asha.R, asha.A, asha.C, asha.I], [3, 3, 0, 2]);
});

test('toText round trips', () => {
  const m = r.parse(r.sample());
  assert.deepEqual(r.parse(r.toText(m)), m);
});

test('CSV guards formulas', () => {
  const m = r.parse('Task | =Evil\n=Do it | A/R');
  const csv = r.toCsv(m);
  assert.ok(csv.startsWith("﻿Task,'=Evil"));
  assert.ok(csv.indexOf("'=Do it,A/R") !== -1);
});

test('file save and open', () => {
  assert.equal(r.parseFile(r.serialize({ title: 'T', text: r.sample() })).title, 'T');
  assert.throws(() => r.parseFile('x'), /not a saved RACI chart/);
  assert.throws(() => r.parseFile('{"app":"raci-builder","state":{}}'), /not a saved RACI chart/);
});

test('buildPdf: valid, landscape, and paginates a long chart', async () => {
  const PDFLib = require('../vendor/pdf-lib.min.js');
  const bytes = await r.buildPdf(PDFLib, r.parse(r.sample()), { title: 'Portal RACI', company: 'Acme' });
  assert.equal(Buffer.from(bytes).slice(0, 5).toString(), '%PDF-');
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.ok(doc.getPage(0).getWidth() > doc.getPage(0).getHeight());
  const long = r.parse('Task | A | B\n' + Array.from({ length: 60 }, (_, i) => 'Task number ' + i + ' | R | A').join('\n'));
  assert.ok((await PDFLib.PDFDocument.load(await r.buildPdf(PDFLib, long, {}))).getPageCount() >= 2);
});
