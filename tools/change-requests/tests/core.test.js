'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

const TODAY = '2026-10-23';
const cr = (o) =>
  Object.assign(
    {
      title: 'Add UPI',
      description: 'Customers asked',
      requestedBy: 'Sales',
      raised: TODAY,
      category: 'Scope',
      priority: 'High',
      costImpact: '4,50,000',
      daysImpact: 12,
    },
    o || {},
  );

test('add: reference, parsing of money and days, validation, no mutation', () => {
  const s0 = c.create();
  const a = c.add(s0, cr());
  assert.equal(a.item.ref, 'CR-001');
  assert.equal(a.item.costImpact, 450000);
  assert.equal(a.item.daysImpact, 12);
  assert.equal(a.item.status, 'Draft');
  assert.equal(s0.items.length, 0);
  assert.equal(c.add(a.state, cr({ costImpact: '-₹ 2,00,000', daysImpact: '-8' })).item.costImpact, -200000);
  assert.equal(c.add(s0, cr({ costImpact: '', daysImpact: '' })).item.costImpact, 0);
  assert.equal(c.add(a.state, cr()).item.ref, 'CR-002');
  assert.throws(() => c.add(s0, cr({ title: ' ' })), /short title/);
  assert.throws(() => c.add(s0, cr({ costImpact: 'lots' })), /Cost impact must be/);
  assert.throws(() => c.add(s0, cr({ daysImpact: 1.5 })), /Schedule impact must be a whole/);
  assert.throws(() => c.add(s0, cr({ category: 'X' })), /Choose a category/);
  assert.throws(() => c.add(s0, cr({ priority: 'X' })), /Choose a priority/);
  assert.throws(() => c.add(s0, cr({ raised: 'x' })), /Dates must look like/);
});

test('status flow enforces transitions and decision details', () => {
  let s = c.add(c.create(), cr()).state;
  assert.throws(() => c.setStatus(s, 1, 'Approved', { by: 'A', date: TODAY }), /cannot go from Draft to Approved \(allowed: Submitted\)/);
  s = c.setStatus(s, 1, 'Submitted');
  assert.throws(() => c.setStatus(s, 1, 'Approved', { date: TODAY }), /who made the decision/);
  assert.throws(() => c.setStatus(s, 1, 'Approved', { by: 'A', date: '2026-10-01' }), /before the request was raised/);
  assert.throws(() => c.setStatus(s, 1, 'Rejected', { by: 'A', date: TODAY }), /reason for rejecting/);
  assert.throws(() => c.setStatus(s, 1, 'Nope'), /Choose a status/);
  const d = c.setStatus(s, 1, 'Deferred', { by: 'Sponsor', date: TODAY, note: 'Next quarter' });
  assert.equal(d.items[0].decisionNote, 'Next quarter');
  const re = c.setStatus(d, 1, 'Submitted');
  assert.equal(re.items[0].decidedBy, '', 'resubmitting clears the old decision');
  const ok = c.setStatus(s, 1, 'Approved', { by: 'Sponsor', date: TODAY });
  const done = c.setStatus(ok, 1, 'Implemented');
  assert.throws(() => c.setStatus(done, 1, 'Submitted'), /cannot go from Implemented to Submitted\./);
  assert.throws(() => c.setStatus(s, 9, 'Submitted'), /No such change request/);
  assert.equal(s.items[0].status, 'Submitted', 'input state is not mutated');
});

test('update only while Draft or Submitted', () => {
  let s = c.add(c.create(), cr()).state;
  s = c.update(s, 1, { costImpact: '1,00,000', priority: 'Low', title: 'UPI and wallets' });
  assert.equal(s.items[0].costImpact, 100000);
  assert.equal(s.items[0].title, 'UPI and wallets');
  assert.throws(() => c.update(s, 1, { title: '' }), /short title/);
  assert.throws(() => c.update(s, 1, { category: 'Z' }), /Choose a category/);
  s = c.setStatus(c.setStatus(s, 1, 'Submitted'), 1, 'Approved', { by: 'S', date: TODAY });
  assert.throws(() => c.update(s, 1, { costImpact: 5 }), /can no longer be edited/);
});

test('list filters', () => {
  const s = c.sample(TODAY);
  assert.equal(c.list(s).length, 4);
  assert.equal(c.list(s, { status: 'Approved' }).length, 2);
  assert.equal(c.list(s, { category: 'Scope' }).length, 2);
  assert.equal(c.list(s, { priority: 'High' }).length, 1);
  assert.equal(c.list(s, { text: 'load test' }).length, 1);
  assert.equal(c.list(s, { text: 'sales' })[0].ref, 'CR-001');
});

test('totals with and without a baseline', () => {
  const s = c.sample(TODAY);
  const t = c.totals(s);
  assert.equal(t.approved, 2);
  assert.equal(t.pending, 1);
  assert.equal(t.approvedCost, 250000);
  assert.equal(t.approvedDays, 4);
  assert.equal(t.pendingDays, 9);
  assert.equal(t.revisedBudget, undefined);
  const b = c.totals(s, { budget: 5000000, endDate: '2026-12-31' });
  assert.equal(b.revisedBudget, 5250000);
  assert.equal(b.budgetGrowthPct, 5);
  assert.equal(b.ifPendingApproved, 5250000);
  assert.equal(b.revisedEnd, '2027-01-04');
  assert.equal(b.ifPendingEnd, '2027-01-13');
});

test('CSV guards formulas and keeps negative numbers', () => {
  const s = c.add(c.create(), cr({ title: '=cmd, x', costImpact: '-500' })).state;
  const csv = c.toCsv(c.list(s));
  assert.ok(csv.startsWith('﻿Ref,Title'));
  assert.ok(csv.indexOf('"\'=cmd, x"') !== -1);
  assert.ok(csv.indexOf(',-500,12,') !== -1);
});

test('serialize/parse round trip, baseline, bad files', () => {
  const s = c.sample(TODAY);
  const back = c.parse(c.serialize(s, { budget: 100, endDate: '2026-12-31' }));
  assert.deepEqual(back.state, s);
  assert.deepEqual(back.baseline, { budget: 100, endDate: '2026-12-31' });
  assert.deepEqual(c.parse(c.serialize(s)).baseline, { budget: 0, endDate: '' });
  assert.throws(() => c.parse('x'), /not a saved change log/);
  assert.throws(() => c.parse('{"app":"change-requests"}'), /not a saved change log/);
});

test('buildPdf makes a valid single-page form, and long text paginates', async () => {
  const PDFLib = require('../vendor/pdf-lib.min.js');
  const it = c.sample(TODAY).items[0];
  const bytes = await c.buildPdf(PDFLib, it, { project: 'Portal', company: 'Acme' });
  assert.equal(Buffer.from(bytes).slice(0, 5).toString(), '%PDF-');
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 1);
  const long = Object.assign({}, it, { description: 'word '.repeat(1500) });
  assert.ok((await PDFLib.PDFDocument.load(await c.buildPdf(PDFLib, long))).getPageCount() >= 2);
});
