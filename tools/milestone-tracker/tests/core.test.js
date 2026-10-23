'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../js/core.js');

const TODAY = '2026-10-23';
const P = (t) => m.parse(t).items;

test('parse: columns, status words, defaults, errors', () => {
  const r = m.parse(
    '# x\nA | 2026-11-01 | 2026-11-05 | in progress | Asha\nB | 02/11/2026\nC | 2026-11-03 | | completed\nD | nope\nE | 2026-11-03 | zzz\nF | 2026-11-03 | 2026-11-03 | stuck\nG | 2026-11-03 | | maybe\n | 2026-11-03',
  );
  assert.equal(r.items.length, 4);
  assert.deepEqual(r.items[0], { n: 1, name: 'A', baseline: '2026-11-01', forecast: '2026-11-05', status: 'In progress', owner: 'Asha' });
  assert.equal(r.items[1].forecast, '2026-11-02', 'forecast defaults to the baseline');
  assert.equal(r.items[1].status, 'Not started');
  assert.equal(r.items[2].status, 'Done');
  assert.equal(r.items[3].status, 'Blocked');
  assert.equal(r.errors.length, 4);
  assert.match(r.errors[0], /Line 5: "nope" is not a baseline date/);
  assert.match(r.errors[1], /"zzz" is not a forecast date/);
  assert.match(r.errors[2], /"maybe" is not a status/);
  assert.match(r.errors[3], /has no name/);
});

test('analyse: every state', () => {
  const rows = m.analyse(
    P(
      [
        'Late | 2026-10-01 | 2026-10-10 | In progress',
        'Stuck | 2026-11-30 | 2026-11-30 | Blocked',
        'Slip | 2026-11-30 | 2026-12-10 | In progress',
        'Soon | 2026-11-01 | 2026-11-01 | Not started',
        'Fine | 2027-01-01 | 2027-01-01 | Not started',
        'DoneLate | 2026-09-01 | 2026-09-10 | Done',
        'DoneOk | 2026-09-01 | 2026-09-01 | Done',
      ].join('\n'),
    ),
    TODAY,
  );
  const st = (n) => rows.find((r) => r.name === n).state;
  assert.equal(st('Late'), 'overdue');
  assert.equal(st('Stuck'), 'blocked');
  assert.equal(st('Slip'), 'slipping');
  assert.equal(st('Soon'), 'due soon');
  assert.equal(st('Fine'), 'on track');
  assert.equal(st('DoneLate'), 'done late');
  assert.equal(st('DoneOk'), 'done');
  assert.deepEqual(
    rows.map((r) => r.state),
    ['overdue', 'blocked', 'slipping', 'due soon', 'on track', 'done late', 'done'],
  );
  assert.equal(rows.find((r) => r.name === 'Slip').slip, 10);
  assert.equal(rows.find((r) => r.name === 'Late').daysToGo, -13);
});

test('analyse: due-soon window is adjustable and a past done milestone is never overdue', () => {
  const items = P('A | 2026-11-20 | 2026-11-20 | Not started\nB | 2026-01-01 | 2026-01-01 | Done');
  assert.equal(m.analyse(items, TODAY, 30).find((r) => r.name === 'A').state, 'due soon');
  assert.equal(m.analyse(items, TODAY, 14).find((r) => r.name === 'A').state, 'on track');
  assert.equal(m.analyse(items, TODAY).find((r) => r.name === 'B').state, 'done');
});

test('summary', () => {
  const s = m.summary(P(m.sample(TODAY)), TODAY);
  assert.equal(s.total, 7);
  assert.equal(s.done, 2);
  assert.equal(s.open, 5);
  assert.equal(s.counts.overdue, 1);
  assert.equal(s.counts.blocked, 1);
  assert.equal(s.counts.slipping, 2);
  assert.equal(s.attention, 4);
  assert.equal(s.worstSlip, 11);
  assert.equal(s.next.name, 'Payment integration');
  assert.equal(s.lastForecast > s.lastBaseline, true);
  assert.equal(m.summary([], TODAY).next, null);
  assert.equal(m.summary([], TODAY).lastForecast, '');
});

test('reminder text', () => {
  const t = m.reminder(P(m.sample(TODAY)), TODAY, 'Portal');
  assert.match(t, /^Milestone check - Portal \(23\/10\/2026\)/);
  assert.match(t, /- Backend APIs complete: overdue by 3 days \[Ravi\]/);
  assert.match(t, /- Payment integration: blocked \[Kiran\]/);
  assert.match(t, /UAT start: slipping 7 days/);
  assert.equal(m.reminder(P('A | 2027-01-01'), TODAY), 'Nothing needs attention on 23/10/2026.');
});

test('CSV and ICS', () => {
  const rows = m.analyse(P('=bad, name | 2026-11-01 | 2026-11-04 | Not started | A;B\nDone one | 2026-10-01 | | Done'), TODAY);
  const csv = m.toCsv(rows);
  assert.ok(csv.startsWith('\ufeff#,Milestone'));
  assert.ok(csv.indexOf('"\'=bad, name"') !== -1);
  const ics = m.toIcs(P('A | 2026-11-01 | 2026-11-04 | Not started | X;Y\nB | 2026-10-01 | | Done'), '20261023T000000Z', 3, 'Proj');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1, 'finished milestones are skipped');
  assert.ok(ics.indexOf('DTSTART;VALUE=DATE:20261104') !== -1);
  assert.ok(ics.indexOf('DTEND;VALUE=DATE:20261105') !== -1);
  assert.ok(ics.indexOf('TRIGGER:-P3D') !== -1);
  assert.ok(ics.indexOf('Owner: X\\;Y') !== -1);
  assert.equal(m.toIcs(P('A | 2026-11-01'), 'S', 0).indexOf('VALARM'), -1);
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('toText round trip, save and open', () => {
  const items = P(m.sample(TODAY));
  assert.deepEqual(P(m.toText(items)), items);
  const back = m.parseFile(m.serialize({ name: 'P', text: m.sample(TODAY) }));
  assert.equal(back.name, 'P');
  assert.throws(() => m.parseFile('x'), /not a saved milestone list/);
  assert.throws(() => m.parseFile('{"app":"milestone-tracker","state":{}}'), /not a saved milestone list/);
});
