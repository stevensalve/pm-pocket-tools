'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../js/core.js');

const TODAY = '2026-10-23';
const risk = (o) =>
  Object.assign(
    {
      type: 'Risk',
      title: 'Vendor slips',
      owner: 'Asha',
      probability: 4,
      impact: 5,
      due: '2026-10-30',
      action: 'Call vendor',
      raised: TODAY,
    },
    o || {},
  );

test('add: reference per type, score, defaults, validation, no mutation', () => {
  const s0 = r.create();
  const a = r.add(s0, risk());
  assert.equal(a.item.ref, 'R01');
  assert.equal(a.item.score, 20);
  assert.equal(s0.items.length, 0);
  const b = r.add(a.state, risk());
  assert.equal(b.item.ref, 'R02');
  assert.equal(r.add(b.state, { type: 'Issue', title: 'Down', raised: TODAY }).item.ref, 'I01');
  const asm = r.add(s0, { type: 'Assumption', title: 'Users free', raised: TODAY, probability: 5, impact: 5 }).item;
  assert.equal(asm.score, 1, 'assumptions are not scored');
  assert.equal(r.add(s0, { type: 'Issue', title: 'x', raised: TODAY }).item.probability, 5, 'issues have already happened');
  assert.equal(r.add(s0, { type: 'Risk', title: 'x', raised: TODAY }).item.score, 9);
  assert.throws(() => r.add(s0, risk({ type: 'Idea' })), /Choose Risk/);
  assert.throws(() => r.add(s0, risk({ title: ' ' })), /Describe the item/);
  assert.throws(() => r.add(s0, risk({ probability: 6 })), /Probability must be/);
  assert.throws(() => r.add(s0, risk({ impact: 0 })), /Impact must be/);
  assert.throws(() => r.add(s0, risk({ due: '2026-13-01' })), /Dates must look like|does not exist/);
});

test('update recalculates the score and validates', () => {
  let s = r.add(r.create(), risk()).state;
  s = r.update(s, 'R1', { probability: 2, owner: ' Ravi ', action: 'New plan', due: '' });
  assert.equal(s.items[0].score, 10);
  assert.equal(s.items[0].owner, 'Ravi');
  assert.equal(s.items[0].due, '');
  assert.throws(() => r.update(s, 'R1', { impact: 9 }), /Impact must be/);
  assert.throws(() => r.update(s, 'R1', { title: '' }), /Describe the item/);
  assert.throws(() => r.update(s, 'Z9', {}), /No such item/);
  const a = r.add(s, { type: 'Assumption', title: 'x', raised: TODAY }).state;
  assert.equal(r.update(a, 'A1', { probability: 5 }).items[1].score, 1);
});

test('setStatus: closing needs a date not before raised; reopening clears', () => {
  let s = r.add(r.create(), risk({ raised: '2026-10-20' })).state;
  assert.throws(() => r.setStatus(s, 'R1', 'Closed', '2026-10-19'), /before it was raised/);
  assert.throws(() => r.setStatus(s, 'R1', 'Done', TODAY), /Choose a status/);
  s = r.setStatus(s, 'R1', 'Closed', '2026-10-22');
  assert.equal(s.items[0].closed, '2026-10-22');
  s = r.setStatus(s, 'R1', 'Accepted', '2026-10-23');
  assert.equal(s.items[0].closed, '2026-10-22');
  s = r.setStatus(s, 'R1', 'Open', TODAY);
  assert.equal(s.items[0].closed, '');
});

test('list: levels, overdue, ordering, filters', () => {
  const s = r.sample(TODAY);
  const rows = r.list(s, TODAY);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].ref, 'I01', 'highest score first (5 x 3 = 15)... tie with 15 ordered by due date');
  assert.equal(rows.find((x) => x.ref === 'R01').level, 'High');
  assert.equal(rows.find((x) => x.ref === 'R03').level, 'Low');
  assert.equal(rows.find((x) => x.ref === 'R02').overdue, true);
  assert.equal(rows.find((x) => x.ref === 'D01').overdue, true);
  assert.equal(rows.find((x) => x.ref === 'R01').daysToDue, 14);
  assert.equal(r.list(s, TODAY, { overdueOnly: true }).length, 2);
  assert.equal(r.list(s, TODAY, { type: 'Risk' }).length, 3);
  assert.equal(r.list(s, TODAY, { level: 'High' }).length, 2);
  assert.equal(r.list(s, TODAY, { text: 'gateway' })[0].ref, 'D01');
  assert.equal(r.list(s, TODAY, { owner: 'Priya' }).length, 2);
});

test('summary', () => {
  const m = r.summary(r.sample(TODAY), TODAY);
  assert.equal(m.total, 6);
  assert.equal(m.open, 6);
  assert.equal(m.overdue, 2);
  assert.equal(m.highOpen, 2);
  assert.equal(m.byType.find((x) => x.type === 'Risk').open, 3);
  assert.equal(m.top[0].ref, 'I01');
  assert.equal(m.byOwner[0].owner, 'Priya');
  assert.equal(m.noOwner, 0);
});

test('CSV', () => {
  const s = r.add(r.create(), risk({ title: '=cmd, "x"' })).state;
  const csv = r.toCsv(r.list(s, TODAY));
  assert.ok(csv.startsWith('﻿Ref,Type'));
  assert.ok(csv.indexOf('"\'=cmd, ""x"""') !== -1);
  const a = r.add(r.create(), { type: 'Assumption', title: 'A', raised: TODAY }).state;
  assert.ok(r.toCsv(r.list(a, TODAY)).split('\r\n')[1].indexOf('A01,Assumption,A,,,,,,Open') === 0);
});

test('serialize/parse round trip and bad files', () => {
  let s = r.sample(TODAY);
  s = r.setStatus(s, 'R3', 'Closed', TODAY);
  const back = r.parse(r.serialize(s));
  assert.deepEqual(r.list(back, TODAY), r.list(s, TODAY));
  assert.throws(() => r.parse('x'), /not a saved RAID log/);
  assert.throws(() => r.parse('{"app":"raid-log"}'), /not a saved RAID log/);
  const bad = JSON.parse(r.serialize(s));
  bad.state.items[0].type = 'Nope';
  assert.equal(r.parse(JSON.stringify(bad)).items.length, 5, 'damaged items are skipped');
});
