'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../js/core.js');

const MON = '2026-11-02'; // a Monday
const plan = (txt, o) => g.schedule(g.parseTasks(txt).tasks, Object.assign({ start: MON }, o));

test('parseTasks: columns, defaults and errors', () => {
  const r = g.parseTasks(
    '# comment\nDesign | 5 | | Asha\nBuild | 10 | 1 | Ravi | 09/11/2026\n\nBad | x\nNoDeps | 2 | a\n | 3\nDate | 1 | | | nope',
  );
  assert.equal(r.tasks.length, 2);
  assert.deepEqual(r.tasks[1], { n: 2, name: 'Build', days: 10, deps: [1], owner: 'Ravi', notBefore: '2026-11-09' });
  assert.equal(r.errors.length, 4);
  assert.match(r.errors[0], /Line 5: "x" is not a whole number/);
  assert.match(r.errors[1], /"a" is not a task number/);
  assert.match(r.errors[2], /Line 7: the task has no name/);
  assert.match(r.errors[3], /"nope" is not a date/);
  assert.equal(g.parseTasks('Solo').tasks[0].days, 1);
});

test('schedule: sequential tasks skip weekends', () => {
  const r = plan('A | 3\nB | 4 | 1');
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].start, '2026-11-02');
  assert.equal(r.rows[0].end, '2026-11-04');
  assert.equal(r.rows[1].start, '2026-11-05');
  assert.equal(r.rows[1].end, '2026-11-10', 'Thu, Fri, Mon, Tue');
  assert.equal(r.end, '2026-11-10');
  assert.equal(r.workingDays, 7);
});

test('schedule: parallel paths, slack and critical path', () => {
  const r = plan('Start | 1\nLong | 5 | 1\nShort | 2 | 1\nJoin | 1 | 2,3');
  assert.deepEqual(r.criticalPath, [1, 2, 4]);
  assert.equal(r.rows[2].slack, 3);
  assert.equal(r.rows[2].critical, false);
  assert.equal(r.rows[1].critical, true);
  assert.equal(r.workingDays, 7);
});

test('schedule: holidays and six-day week', () => {
  const r = plan('A | 3', { holidays: ['2026-11-03'] });
  assert.equal(r.rows[0].end, '2026-11-05');
  const s = plan('A | 6', { workWeek: 6 });
  assert.equal(s.rows[0].end, '2026-11-07', 'Mon to Sat');
  assert.equal(plan('A | 6').rows[0].end, '2026-11-09');
});

test('schedule: start on a weekend moves to Monday; not-before pushes a task', () => {
  const r = g.schedule(g.parseTasks('A | 1').tasks, { start: '2026-11-07' });
  assert.equal(r.rows[0].start, '2026-11-09');
  const n = plan('A | 1\nB | 1 | 1 | | 2026-11-16');
  assert.equal(n.rows[1].start, '2026-11-16');
  assert.equal(n.rows[1].slack, 0);
});

test('schedule: milestone takes no time', () => {
  const r = plan('A | 2\nDone | 0 | 1');
  assert.equal(r.rows[1].milestone, true);
  assert.equal(r.rows[1].start, '2026-11-04');
  assert.equal(r.rows[1].end, r.rows[1].start);
});

test('schedule: bad dependencies and cycles are explained', () => {
  assert.match(plan('A | 1 | 5').errors[0], /depends on task 5, which does not exist/);
  assert.match(plan('A | 1 | 1').errors[0], /depends on itself/);
  assert.match(plan('A | 1 | 2\nB | 1 | 1\nC | 1').errors[0], /circle: 1 A; 2 B/);
  assert.match(g.schedule([], { start: MON }).errors[0], /at least one task/);
  assert.throws(() => g.schedule(g.parseTasks('A').tasks, { start: 'x' }), /Dates must look like/);
});

test('bars: positions on a calendar axis', () => {
  const b = g.bars(plan('A | 5\nB | 5 | 1'));
  assert.equal(b.spanDays, 12);
  assert.equal(b.bars[0].left, 0);
  assert.equal(b.bars[1].left > 40, true);
  assert.equal(b.bars[0].critical, true);
  assert.deepEqual(g.bars({ ok: false, rows: [] }), { axis: [], bars: [] });
});

test('CSV and ICS', () => {
  const r = plan('=Evil, task | 2 | | A;B');
  const csv = g.toCsv(r);
  assert.ok(csv.startsWith('\ufeff#,Task'));
  assert.ok(csv.indexOf('"\'=Evil, task"') !== -1);
  const ics = g.toIcs(r, '20261022T000000Z', 'Proj');
  assert.ok(ics.indexOf('DTSTART;VALUE=DATE:20261102') !== -1);
  assert.ok(ics.indexOf('DTEND;VALUE=DATE:20261104') !== -1, 'end is exclusive');
  assert.ok(ics.indexOf('Owner: A\\;B') !== -1);
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('serialize/parse round trip and bad files', () => {
  const s = g.sample(MON);
  s.holidays = ['2026-11-11'];
  assert.deepEqual(g.parse(g.serialize(s)), s);
  assert.throws(() => g.parse('nope'), /not a saved Gantt plan/);
  assert.throws(() => g.parse('{"app":"x"}'), /not a saved Gantt plan/);
});

test('sample plan schedules and tasksToText round-trips', () => {
  const s = g.sample(MON);
  const r = g.schedule(s.tasks, { start: s.start });
  assert.equal(r.ok, true);
  assert.deepEqual(r.criticalPath, [1, 2, 3, 5, 6, 7, 9]);
  assert.deepEqual(g.parseTasks(g.tasksToText(s.tasks)).tasks, s.tasks);
  assert.deepEqual(g.parseHolidays('2026-11-11, 12/11/2026\nzzz'), {
    holidays: ['2026-11-11', '2026-11-12'],
    errors: ['"zzz" is not a date.'],
  });
});
