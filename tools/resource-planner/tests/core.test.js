'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rp = require('../js/core.js');

const MON = '2026-11-02';
const people = (t) => rp.parsePeople(t).people;

test('mondayOf', () => {
  assert.equal(rp.mondayOf('2026-11-02'), '2026-11-02');
  assert.equal(rp.mondayOf('2026-11-08'), '2026-11-02', 'Sunday');
  assert.equal(rp.mondayOf('2026-11-04'), '2026-11-02');
});

test('parsePeople: defaults, leave ranges, errors', () => {
  const r = rp.parsePeople(
    '# team\nAsha\nRavi | 80 | 2026-11-09..2026-11-10, 2026-11-20\nAsha | 100\nMeera | 150\nKiran | 100 | soon\n | 50',
  );
  assert.equal(r.people.length, 2);
  assert.deepEqual(r.people[0], { name: 'Asha', capacity: 100, leave: [] });
  assert.deepEqual(r.people[1].leave, ['2026-11-09', '2026-11-10', '2026-11-20']);
  assert.equal(r.errors.length, 4);
  assert.match(r.errors[0], /Asha is listed twice/);
  assert.match(r.errors[1], /capacity "150"/);
  assert.match(r.errors[2], /leave "soon"/);
  assert.match(r.errors[3], /no name/);
});

test('parseAssignments: matching, defaults, errors', () => {
  const ppl = people('Asha\nRavi');
  const r = rp.parseAssignments(
    'asha | P1 | 2026-11-02 | 2026-11-13\nRavi | P2 | 03/11/2026 | 05/11/2026 | 50\nZed | P1 | 2026-11-02 | 2026-11-03\nAsha | P1 | 2026-11-05 | 2026-11-02\nAsha | P1 | x | 2026-11-02\nAsha | P1 | 2026-11-02 | 2026-11-03 | 0\nAsha |  | 2026-11-02 | 2026-11-03',
    ppl,
  );
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].person, 'Asha');
  assert.equal(r.items[0].percent, 100);
  assert.equal(r.items[1].start, '2026-11-03');
  assert.equal(r.errors.length, 5);
  assert.match(r.errors[0], /Zed is not in the people list/);
  assert.match(r.errors[1], /end is before the start/);
  assert.match(r.errors[2], /must be dates/);
  assert.match(r.errors[3], /percent "0"/);
  assert.match(r.errors[4], /needs a person and a project/);
});

test('grid: full and partial weeks, projects, statuses', () => {
  const ppl = people('Asha');
  const items = rp.parseAssignments('Asha | P1 | 2026-11-02 | 2026-11-06 | 60\nAsha | P2 | 2026-11-04 | 2026-11-13 | 60', ppl).items;
  const g = rp.grid(ppl, items, '2026-11-04', 3);
  assert.deepEqual(g.weeks, ['2026-11-02', '2026-11-09', '2026-11-16']);
  const c = g.rows[0].cells;
  assert.equal(c[0].booked, 96, 'P1 60 all week + P2 60 for 3 days = 60 + 36');
  assert.equal(c[0].status, 'ok');
  assert.deepEqual(c[0].projects, { P1: 60, P2: 36 });
  assert.equal(c[1].booked, 60);
  assert.equal(c[1].status, 'ok');
  assert.equal(c[2].booked, 0);
  assert.equal(c[2].status, 'under');
  assert.deepEqual(
    g.projects,
    [
      { project: 'P1', personDays: 3 },
      { project: 'P2', personDays: 4.8 },
    ].sort((a, b) => b.personDays - a.personDays),
  );
});

test('grid: over-booking, leave and zero capacity', () => {
  const ppl = people('Asha\nRavi | 100 | 2026-11-02..2026-11-03\nSam | 0');
  const items = rp.parseAssignments(
    'Asha | A | 2026-11-02 | 2026-11-06 | 100\nAsha | B | 2026-11-02 | 2026-11-06 | 40\nRavi | A | 2026-11-02 | 2026-11-06 | 100\nSam | A | 2026-11-02 | 2026-11-06 | 50',
    ppl,
  ).items;
  const g = rp.grid(ppl, items, MON, 2);
  assert.equal(g.rows[0].cells[0].status, 'over');
  assert.equal(g.rows[0].cells[0].load, 140);
  assert.equal(g.rows[1].cells[0].capacity, 60, 'two days of leave');
  assert.equal(g.rows[1].cells[0].status, 'over');
  assert.equal(g.rows[1].cells[0].leaveDays, 2);
  assert.equal(g.rows[2].cells[0].status, 'over', 'booked with no capacity');
  assert.equal(g.rows[2].cells[0].load, null);
  assert.equal(g.rows[2].cells[1].status, 'off');
  assert.equal(g.issues.length, 3);
  assert.equal(g.issues[0].person, 'Asha');
});

test('grid: weekends are ignored and weeks are clamped', () => {
  const ppl = people('Asha');
  const items = rp.parseAssignments('Asha | A | 2026-11-07 | 2026-11-08 | 100', ppl).items;
  assert.equal(rp.grid(ppl, items, MON, 1).rows[0].cells[0].booked, 0);
  assert.equal(rp.grid(ppl, items, MON, 999).weeks.length, 52);
  assert.equal(rp.grid(ppl, items, MON, 0).weeks.length, 1);
});

test('CSV', () => {
  const ppl = people('=Evil | 100');
  const g = rp.grid(ppl, [], MON, 2);
  const csv = rp.toCsv(g);
  assert.ok(csv.startsWith('﻿Person,Capacity %,Week of 2026-11-02,Week of 2026-11-09'));
  assert.ok(csv.indexOf("'=Evil,100,0,0") !== -1);
});

test('sample produces an over-booked week and round-trips', () => {
  const s = rp.sample('2026-10-23');
  const pp = rp.parsePeople(s.people);
  const aa = rp.parseAssignments(s.assignments, pp.people);
  assert.deepEqual(pp.errors.concat(aa.errors), []);
  const g = rp.grid(pp.people, aa.items, s.from, s.weeks);
  assert.ok(
    g.issues.some((i) => i.person === 'Asha'),
    'Asha is double-booked in week 2',
  );
  assert.ok(
    g.issues.some((i) => i.person === 'Ravi'),
    'Ravi is booked during leave',
  );
  assert.deepEqual(rp.parse(rp.serialize(s)), s);
  assert.throws(() => rp.parse('x'), /not a saved resource plan/);
  assert.throws(() => rp.parse('{"app":"resource-planner","state":{}}'), /not a saved resource plan/);
});
