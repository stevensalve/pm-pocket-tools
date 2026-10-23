'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('../js/core.js');

const CFG = { budget: 1000000, start: '2026-01-01', end: '2026-12-31', basis: 'overall' };
const E = (t) => b.parseEntries(t, 'Paid').entries;

test('amount accepts Indian formats and refunds', () => {
  assert.equal(b.amount('1,50,000'), 150000);
  assert.equal(b.amount('₹ 2,500.50'), 2500.5);
  assert.equal(b.amount('Rs. 100'), 100);
  assert.equal(b.amount('-500'), -500);
  assert.equal(b.amount('abc'), null);
  assert.equal(b.amount(''), null);
  assert.equal(b.amount('1.2.3'), null);
});

test('parseEntries: columns, defaults, errors', () => {
  const r = b.parseEntries('# c\n2026-02-01 | 1,00,000 | People | Month 1\n05/03/2026 | 5000\nnope | 5\n2026-04-01 | lots\n', 'Paid');
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries[1], { date: '2026-03-05', amount: 5000, category: 'Uncategorised', note: '' });
  assert.match(r.errors[0], /Paid line 4: "nope" is not a date/);
  assert.match(r.errors[1], /Paid line 5: "lots" is not an amount/);
});

test('summary: on-track project', () => {
  const s = b.summary(CFG, E('2026-02-01 | 100000\n2026-04-01 | 100000'), [], '2026-04-10');
  assert.equal(s.spent, 200000);
  assert.equal(s.totalDays, 365);
  assert.equal(s.elapsedDays, 100);
  assert.equal(s.remainingDays, 265);
  assert.equal(s.timePct, 27.4);
  assert.equal(s.spentPct, 20);
  assert.equal(s.dailyOverall, 2000);
  assert.equal(s.forecast, 200000 + 2000 * 265);
  assert.equal(s.variance, 730000 - 1000000);
  assert.equal(s.verdict, 'on-track');
  assert.equal(s.runOutStatus, 'after-end');
  assert.equal(s.paceGap, -7.4);
});

test('summary: committed spend, run-out and over-run verdicts', () => {
  const s = b.summary(
    CFG,
    E('2026-01-10 | 400000\n2026-03-10 | 300000'),
    E('2026-06-01 | 100000').map((x) => x),
    '2026-03-31',
  );
  assert.equal(s.committed, 100000);
  assert.equal(s.remaining, 200000);
  assert.equal(s.runOutStatus, 'before-end');
  assert.ok(s.runOut > '2026-03-31' && s.runOut < '2026-12-31');
  assert.equal(s.runOut, '2026-04-26', '7,00,000 in 90 days = 7,777.78 a day; 2,00,000 left lasts 26 days');
  assert.equal(s.verdict, 'at-risk');
  const over = b.summary(CFG, E('2026-01-10 | 1200000'), [], '2026-02-01');
  assert.equal(over.verdict, 'over');
  assert.equal(over.runOutStatus, 'already');
  assert.equal(over.remaining, -200000);
});

test('summary: recent basis, future-dated entries, before start, validation', () => {
  const entries = E('2026-01-05 | 600000\n2026-03-20 | 30000\n2026-06-01 | 99999');
  const o = b.summary(CFG, entries, [], '2026-03-31');
  const r = b.summary(Object.assign({}, CFG, { basis: 'recent' }), entries, [], '2026-03-31');
  assert.equal(o.ignoredFuture, 1);
  assert.equal(o.spent, 630000);
  assert.equal(r.dailyRecent, 1000);
  assert.ok(r.forecast < o.forecast, 'recent burn is slower');
  const pre = b.summary(CFG, [], [], '2025-12-01');
  assert.equal(pre.elapsedDays, 0);
  assert.equal(pre.forecast, 0);
  assert.equal(pre.runOutStatus, 'none');
  assert.throws(() => b.summary(Object.assign({}, CFG, { budget: 0 }), [], [], '2026-03-31'), /total budget/);
  assert.throws(() => b.summary(Object.assign({}, CFG, { end: '2025-01-01' }), [], [], '2026-03-31'), /end date is before/);
});

test('monthly: cumulative vs straight-line plan', () => {
  const m = b.monthly(CFG, E('2026-01-15 | 50000\n2026-02-10 | 70000\n2026-03-02 | 10000'), '2026-02-28');
  assert.equal(m.length, 12);
  assert.equal(m[0].spend, 50000);
  assert.equal(m[1].cumulative, 120000);
  assert.equal(m[2].spend, 0, 'after the as-of date');
  assert.equal(m[2].future, true);
  assert.equal(m[0].plannedCumulative, Math.round(((1000000 * 31) / 365) * 100) / 100);
  assert.equal(m[11].plannedCumulative, 1000000);
});

test('byCategory totals and sort', () => {
  const c = b.byCategory(
    E('2026-01-01 | 100 | A\n2026-01-02 | 300 | B\n2026-01-03 | 50 | A\n2026-12-01 | 999 | A'),
    E('2026-06-01 | 500 | A'),
    '2026-03-01',
  );
  assert.deepEqual(c, [
    { category: 'A', paid: 150, committed: 500, total: 650 },
    { category: 'B', paid: 300, committed: 0, total: 300 },
  ]);
});

test('CSV guards formulas but keeps refunds numeric', () => {
  const csv = b.toCsv(CFG, E('2026-01-01 | -500 | =Evil'), [], '2026-02-01');
  assert.ok(csv.startsWith('﻿Month,Spend'));
  assert.ok(csv.indexOf("'=Evil") !== -1);
  assert.ok(csv.indexOf('2026-01,-500,-500') !== -1);
});

test('sample is consistent; serialize/parse round trip', () => {
  const s = b.sample('2026-10-23');
  const paid = b.parseEntries(s.paid, 'Paid');
  const com = b.parseEntries(s.committed, 'Committed');
  assert.deepEqual(paid.errors.concat(com.errors), []);
  const sum = b.summary(s, paid.entries, com.entries, '2026-10-23');
  assert.ok(sum.spent > 0 && sum.committed === 850000);
  assert.deepEqual(b.parse(b.serialize(s)), s);
  assert.throws(() => b.parse('x'), /not a saved budget/);
  assert.throws(() => b.parse('{"app":"budget-burn","state":{}}'), /not a saved budget/);
});
