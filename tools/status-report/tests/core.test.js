'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../js/core.js');

const TODAY = '2026-10-23';

test('parseLines strips bullets and numbers, skips blanks, caps', () => {
  assert.deepEqual(s.parseLines('- one\n* two\n3. three\n\n• four\n  plain  '), ['one', 'two', 'three', 'four', 'plain']);
  assert.equal(s.parseLines(Array.from({ length: 30 }, (_, i) => 'x' + i).join('\n')).length, 12);
  assert.deepEqual(s.parseLines(''), []);
});

test('worst picks the most severe colour', () => {
  assert.equal(s.worst(['G', 'G']), 'G');
  assert.equal(s.worst(['G', 'A', 'G']), 'A');
  assert.equal(s.worst(['A', 'R']), 'R');
});

test('slip and RAG thresholds', () => {
  assert.equal(s.slipDays('2026-12-01', '2026-12-09'), 8);
  assert.equal(s.slipDays('2026-12-09', '2026-12-01'), -8);
  assert.equal(s.ragFromSlip(0), 'G');
  assert.equal(s.ragFromSlip(-3), 'G');
  assert.equal(s.ragFromSlip(1), 'A');
  assert.equal(s.ragFromSlip(10), 'A');
  assert.equal(s.ragFromSlip(11), 'R');
  assert.equal(s.ragFromProgress(45, 50), 'G');
  assert.equal(s.ragFromProgress(40, 50), 'A');
  assert.equal(s.ragFromProgress(30, 50), 'R');
});

test('suggest combines slip and progress with scope and budget', () => {
  const d = s.sample(TODAY);
  const g = s.suggest(d);
  assert.equal(g.slip, 8);
  assert.equal(g.progress, 'A');
  assert.equal(g.schedule, 'A');
  assert.equal(g.overall, 'A');
  d.forecastEnd = OT_add(d.plannedEnd, 20);
  assert.equal(s.suggest(d).schedule, 'R');
  const e = s.create();
  assert.equal(s.suggest(e).overall, 'G');
  e.budget = 'R';
  assert.equal(s.suggest(e).overall, 'R');
});
function OT_add(iso, n) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}

test('validate', () => {
  assert.deepEqual(s.validate(s.sample(TODAY)), []);
  const e = s.create();
  const p = s.validate(e);
  assert.ok(p.some((x) => /project name/.test(x)) && p.some((x) => /report date/.test(x)));
  const d = s.sample(TODAY);
  d.percent = 120;
  d.plannedPercent = -1;
  d.forecastEnd = '2026-02-30';
  d.date = '2026-13-45';
  const q = s.validate(d).join(' ');
  assert.match(q, /Percent complete/);
  assert.match(q, /Planned percent/);
  assert.match(q, /forecast finish/);
  assert.match(q, /report date is not/);
  const r = s.sample(TODAY);
  r.summary = '';
  r.asks = [];
  assert.match(s.validate(r).join(' '), /not green/);
  r.scope = 'X';
  assert.match(s.validate(r).join(' '), /colour for scope/);
});

test('toText has the sections and the slip', () => {
  const t = s.toText(s.sample(TODAY));
  assert.match(t, /^PROJECT STATUS: Customer portal \(Week ending 23\/10\/2026\)/);
  assert.match(t, /Overall: AMBER {3}Scope: Green {3}Schedule: Amber {3}Budget: Amber/);
  assert.match(t, /42% complete, plan 50%, planned finish 22\/12\/2026, forecast 30\/12\/2026/);
  assert.match(t, /Accomplished this period:\n- Backend APIs/);
  assert.match(t, /Decisions and help needed:\n- Sponsor/);
  assert.match(t, /Prepared by Priya on 23\/10\/2026\.$/);
  assert.ok(s.toText(s.create()).indexOf('Untitled') !== -1);
});

test('serialize/parse round trip, cleaning and bad files', () => {
  const d = s.sample(TODAY);
  assert.deepEqual(s.parse(s.serialize(d)), d);
  const dirty = JSON.parse(s.serialize(d));
  dirty.doc.overall = 'Purple';
  dirty.doc.percent = 500;
  dirty.doc.plannedPercent = 'x';
  dirty.doc.done = ['- a', '', 'b'];
  const back = s.parse(JSON.stringify(dirty));
  assert.equal(back.overall, 'G');
  assert.equal(back.percent, 0);
  assert.equal(back.plannedPercent, null);
  assert.deepEqual(back.done, ['a', 'b']);
  assert.throws(() => s.parse('nope'), /not a saved status report/);
  assert.throws(() => s.parse('{"app":"x"}'), /not a saved status report/);
});

test('buildPdf makes a valid PDF, and a long one paginates', async () => {
  const PDFLib = require('../vendor/pdf-lib.min.js');
  const d = s.sample(TODAY);
  const bytes = await s.buildPdf(PDFLib, d);
  assert.equal(Buffer.from(bytes).slice(0, 5).toString(), '%PDF-');
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 1);
  d.done = s.parseLines(Array.from({ length: 12 }, () => 'word '.repeat(60)).join('\n'));
  d.next = d.done;
  d.risks = d.done;
  d.asks = d.done;
  assert.ok((await PDFLib.PDFDocument.load(await s.buildPdf(PDFLib, d))).getPageCount() >= 2);
});
