'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../js/core.js');

test('parse: numbers, names, done flag, owner, errors', () => {
  const r = d.parse('A\nB | A | yes | Asha\nC | 1; B\nD | Zed\nE | 99\nF | F\nB | 1\n | 1');
  assert.equal(r.tasks.length, 7);
  assert.deepEqual(r.tasks[1], { n: 2, name: 'B', deps: [1], done: true, owner: 'Asha' });
  assert.deepEqual(r.tasks[2].deps, [1, 2]);
  assert.deepEqual(r.tasks[3].deps, [], 'unknown dependency dropped');
  assert.ok(r.errors.some((e) => /Line 4: "Zed" is not a task/.test(e)));
  assert.ok(r.errors.some((e) => /Line 5: "99" is not a task/.test(e)));
  assert.ok(r.errors.some((e) => /Line 6: a task cannot depend on itself/.test(e)));
  assert.ok(r.errors.some((e) => /"B" appears twice/.test(e)));
  assert.ok(r.errors.some((e) => /has no name/.test(e)));
});

test('findCycle reports the path', () => {
  const t = d.parse('A | 3\nB | 1\nC | 2\nD').tasks;
  const c = d.findCycle(t);
  assert.deepEqual(c.slice(0, -1).sort(), [1, 2, 3]);
  assert.equal(c[0], c[c.length - 1]);
  assert.equal(d.findCycle(d.parse('A\nB | 1').tasks), null);
  const a = d.analyse(t);
  assert.equal(a.ok, false);
  assert.equal(a.cycle.length, 4);
});

test('analyse: levels, layers, order', () => {
  const t = d.parse(d.sample()).tasks;
  const a = d.analyse(t);
  assert.equal(a.ok, true);
  assert.equal(a.level[1], 0);
  assert.equal(a.level[5], 3, 'Build APIs: after Set up environments (2) which is after cloud account (1) which is after contract (0)');
  assert.equal(a.level[10], 6);
  assert.equal(a.layers.length, 7);
  assert.deepEqual(a.layers[0], [1, 11]);
  assert.deepEqual(a.layers[1], [2, 4]);
  assert.equal(a.order[0], 1);
  assert.equal(a.order.length, 11);
});

test('analyse: ready, blocked, done, isolated, downstream and the longest chain', () => {
  const t = d.parse(d.sample()).tasks;
  const a = d.analyse(t);
  assert.deepEqual(a.done, [1, 2, 4]);
  assert.deepEqual(a.ready, [3, 6, 11]);
  assert.deepEqual(
    a.blocked.find((b) => b.n === 5),
    { n: 5, waitingOn: [3] },
  );
  assert.deepEqual(a.blocked.find((b) => b.n === 8).waitingOn, [5, 6]);
  assert.deepEqual(a.isolated, [11]);
  assert.equal(a.downstream[3], 5, 'environments block APIs, payments, security, UAT and go-live');
  assert.equal(a.downstream[10], 0);
  assert.equal(a.longest.length, 7);
  assert.equal(a.longest[0], 1);
  assert.equal(a.longest[a.longest.length - 1], 10);
});

test('layout places every node and edge', () => {
  const t = d.parse(d.sample()).tasks;
  const a = d.analyse(t);
  const l = d.layout(t, a);
  assert.equal(l.nodes.length, 11);
  assert.equal(
    l.edges.length,
    t.reduce((s, x) => s + x.deps.length, 0),
  );
  const n1 = l.nodes.find((x) => x.n === 1);
  const n5 = l.nodes.find((x) => x.n === 5);
  assert.ok(n5.x > n1.x);
  const e = l.edges.find((x) => x.from === 1 && x.to === 2);
  assert.equal(e.x1, n1.x + n1.w);
  assert.ok(l.width >= n5.x + n5.w && l.height >= 2 * 44);
  assert.equal(l.nodes.find((x) => x.n === 3).ready, true);
  assert.deepEqual(d.layout(t, { ok: false }), { nodes: [], edges: [], width: 0, height: 0 });
});

test('DOT and CSV', () => {
  const t = d.parse('A "quoted" | | yes\nB | 1').tasks;
  const dot = d.toDot(t);
  assert.match(dot, /digraph dependencies \{/);
  assert.match(dot, /t1 \[label="1\. A \\"quoted\\"", fillcolor="#dcfce7"\];/);
  assert.match(dot, /t1 -> t2;/);
  const csv = d.toCsv(d.parse('=x | | yes\nB | 1').tasks, d.analyse(d.parse('=x | | yes\nB | 1').tasks));
  assert.ok(csv.startsWith('﻿#,Task'));
  assert.ok(csv.indexOf("'=x") !== -1);
  assert.ok(csv.indexOf('2,B,,1,No,2,Yes,,0') !== -1);
});

test('toText round trip and file save/open', () => {
  const t = d.parse(d.sample()).tasks;
  assert.deepEqual(d.parse(d.toText(t)).tasks, t);
  assert.equal(d.parseFile(d.serialize({ name: 'P', text: d.sample() })).name, 'P');
  assert.throws(() => d.parseFile('x'), /not a saved dependency map/);
  assert.throws(() => d.parseFile('{"app":"dependency-map","state":{}}'), /not a saved dependency map/);
});
