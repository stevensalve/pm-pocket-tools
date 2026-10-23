/**
 * Dependency Map - core logic (pure).
 *
 * Line: task | depends on (task numbers or names, separated by ; or ,) | done (yes/blank) | owner
 * Tasks are numbered 1..n in the order typed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DepCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const MAX = 300;

  /** Parse lines. Dependencies are resolved to task numbers; unknown ones are reported. */
  function parse(text) {
    const raw = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const l = line.trim();
        if (!l || l[0] === '#') return;
        const p = l.split('|').map(norm);
        if (!p[0]) return errors.push('Line ' + (i + 1) + ': the task has no name.');
        if (raw.length >= MAX) return errors.length < 1 && errors.push('Only the first ' + MAX + ' tasks are used.');
        raw.push({
          line: i + 1,
          name: p[0].slice(0, 80),
          deps: p[1] || '',
          done: /^(y|yes|done|x|true|1)$/i.test(p[2] || ''),
          owner: (p[3] || '').slice(0, 40),
        });
      });
    const byName = new Map();
    raw.forEach((t, k) => {
      const key = t.name.toLowerCase();
      if (byName.has(key))
        errors.push('Line ' + t.line + ': "' + t.name + '" appears twice, so it cannot be used by name in dependencies. Use task numbers.');
      else byName.set(key, k + 1);
    });
    const tasks = raw.map((t, k) => {
      const deps = [];
      t.deps
        .split(/[;,]/)
        .map(norm)
        .filter(Boolean)
        .forEach((d) => {
          const n = /^\d+$/.test(d) ? Number(d) : byName.get(d.toLowerCase());
          if (!n || n > raw.length) return errors.push('Line ' + t.line + ': "' + d + '" is not a task in the list.');
          if (n === k + 1) return errors.push('Line ' + t.line + ': a task cannot depend on itself.');
          if (deps.indexOf(n) === -1) deps.push(n);
        });
      return { n: k + 1, name: t.name, deps: deps, done: t.done, owner: t.owner };
    });
    return { tasks: tasks, errors: errors };
  }

  const toText = (tasks) =>
    tasks.map((t) => [t.name, t.deps.join('; '), t.done ? 'yes' : '', t.owner].join(' | ').replace(/( \| )+$/, '')).join('\n');

  /** Find one cycle (as task numbers, first repeated at the end) or null. */
  function findCycle(tasks) {
    const state = {};
    const stack = [];
    let found = null;
    const visit = (n) => {
      state[n] = 1;
      stack.push(n);
      for (const d of tasks[n - 1].deps) {
        if (found) return;
        if (state[d] === 1) {
          found = stack.slice(stack.indexOf(d)).concat(d);
          return;
        }
        if (!state[d]) visit(d);
      }
      stack.pop();
      state[n] = 2;
    };
    for (const t of tasks) if (!state[t.n] && !found) visit(t.n);
    return found;
  }

  /**
   * analyse(tasks) -> { ok, cycle, level{n}, layers[[n]], order[n], ready[n], blocked[{n, waitingOn[n]}], done[n],
   *   downstream{n: count}, longest[n], isolated[n] }
   * level = 0 for tasks with no dependencies, otherwise 1 + highest level among dependencies.
   */
  function analyse(tasks) {
    const cycle = findCycle(tasks);
    if (cycle) return { ok: false, cycle: cycle };
    const level = {};
    const order = [];
    const visit = (n) => {
      if (level[n] !== undefined) return level[n];
      const t = tasks[n - 1];
      level[n] = t.deps.length ? 1 + Math.max.apply(null, t.deps.map(visit)) : 0;
      return level[n];
    };
    tasks.forEach((t) => visit(t.n));
    tasks
      .slice()
      .sort((a, b) => level[a.n] - level[b.n] || a.n - b.n)
      .forEach((t) => order.push(t.n));
    const layers = [];
    order.forEach((n) => (layers[level[n]] = (layers[level[n]] || []).concat(n)));
    const dependents = tasks.map(() => []);
    tasks.forEach((t) => t.deps.forEach((d) => dependents[d - 1].push(t.n)));
    const downstream = {};
    tasks.forEach((t) => {
      const seen = new Set();
      const walk = (n) => dependents[n - 1].forEach((m) => !seen.has(m) && (seen.add(m), walk(m)));
      walk(t.n);
      downstream[t.n] = seen.size;
    });
    const isDone = (n) => tasks[n - 1].done;
    const ready = [];
    const blocked = [];
    tasks.forEach((t) => {
      if (t.done) return;
      const waiting = t.deps.filter((d) => !isDone(d));
      if (waiting.length) blocked.push({ n: t.n, waitingOn: waiting });
      else ready.push(t.n);
    });
    // longest chain by number of tasks
    const best = {};
    const chain = (n) => {
      if (best[n]) return best[n];
      const t = tasks[n - 1];
      let c = [];
      t.deps.forEach((d) => {
        const x = chain(d);
        if (x.length > c.length) c = x;
      });
      best[n] = c.concat(n);
      return best[n];
    };
    let longest = [];
    tasks.forEach((t) => {
      const c = chain(t.n);
      if (c.length > longest.length) longest = c;
    });
    return {
      ok: true,
      cycle: null,
      level: level,
      layers: layers.filter(Boolean),
      order: order,
      ready: ready,
      blocked: blocked,
      done: tasks.filter((t) => t.done).map((t) => t.n),
      downstream: downstream,
      longest: longest,
      isolated: tasks.filter((t) => !t.deps.length && !dependents[t.n - 1].length).map((t) => t.n),
    };
  }

  /** Box positions for a left-to-right diagram. */
  function layout(tasks, a, opts) {
    if (!a.ok) return { nodes: [], edges: [], width: 0, height: 0 };
    const o = Object.assign({ boxW: 160, boxH: 44, gapX: 60, gapY: 18, pad: 12 }, opts);
    const nodes = [];
    a.layers.forEach((layer, li) =>
      layer.forEach((n, i) => {
        const t = tasks[n - 1];
        nodes.push({
          n: n,
          name: t.name,
          done: t.done,
          ready: a.ready.indexOf(n) !== -1,
          x: o.pad + li * (o.boxW + o.gapX),
          y: o.pad + i * (o.boxH + o.gapY),
          w: o.boxW,
          h: o.boxH,
          critical: a.longest.indexOf(n) !== -1,
        });
      }),
    );
    const pos = {};
    nodes.forEach((nd) => (pos[nd.n] = nd));
    const edges = [];
    tasks.forEach((t) =>
      t.deps.forEach((d) =>
        edges.push({
          from: d,
          to: t.n,
          x1: pos[d].x + o.boxW,
          y1: pos[d].y + o.boxH / 2,
          x2: pos[t.n].x,
          y2: pos[t.n].y + o.boxH / 2,
          onLongest: a.longest.indexOf(d) !== -1 && a.longest.indexOf(t.n) === a.longest.indexOf(d) + 1,
        }),
      ),
    );
    const rows = Math.max.apply(
      null,
      a.layers.map((l) => l.length),
    );
    return {
      nodes: nodes,
      edges: edges,
      width: o.pad * 2 + a.layers.length * o.boxW + (a.layers.length - 1) * o.gapX,
      height: o.pad * 2 + rows * o.boxH + (rows - 1) * o.gapY,
    };
  }

  /** Graphviz DOT text for people who want to render it elsewhere. */
  function toDot(tasks) {
    const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const L = ['digraph dependencies {', '  rankdir=LR;', '  node [shape=box, style="rounded,filled", fillcolor="#e0f2fe"];'];
    tasks.forEach((t) => L.push('  t' + t.n + ' [label=' + q(t.n + '. ' + t.name) + (t.done ? ', fillcolor="#dcfce7"' : '') + '];'));
    tasks.forEach((t) => t.deps.forEach((d) => L.push('  t' + d + ' -> t' + t.n + ';')));
    L.push('}');
    return L.join('\n') + '\n';
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(tasks, a) {
    const head = ['#', 'Task', 'Owner', 'Depends on', 'Done', 'Level', 'Can start now', 'Waiting on', 'Tasks it unblocks'];
    const rows = tasks.map((t) => {
      const b = a.ok ? a.blocked.find((x) => x.n === t.n) : null;
      return [
        t.n,
        t.name,
        t.owner,
        t.deps.join(' '),
        t.done ? 'Yes' : 'No',
        a.ok ? a.level[t.n] + 1 : '',
        a.ok && a.ready.indexOf(t.n) !== -1 ? 'Yes' : 'No',
        b ? b.waitingOn.join(' ') : '',
        a.ok ? a.downstream[t.n] : '',
      ];
    });
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(state) {
    return JSON.stringify({ app: 'dependency-map', version: 1, state: state }, null, 2);
  }

  function parseFile(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved dependency map.');
    }
    const s = d && d.app === 'dependency-map' ? d.state : null;
    if (!s || typeof s.text !== 'string') throw new Error('That file is not a saved dependency map.');
    return { name: norm(s.name).slice(0, 80), text: s.text.slice(0, 100000) };
  }

  function sample() {
    return [
      'Sign contract | | yes | Priya',
      'Get cloud account | 1 | yes | Ravi',
      'Set up environments | 2 | | Ravi',
      'Design database | 1 | yes | Meera',
      'Build APIs | 3; 4 | | Kiran',
      'Build screens | Design database | | Asha',
      'Integrate payments | Build APIs | | Kiran',
      'Security review | Build APIs; Build screens | | Ravi',
      'User acceptance testing | Integrate payments; Security review | | Asha',
      'Go-live | User acceptance testing | | Priya',
      'Vendor training deck | | | Meera',
    ].join('\n');
  }

  return {
    parse: parse,
    toText: toText,
    findCycle: findCycle,
    analyse: analyse,
    layout: layout,
    toDot: toDot,
    toCsv: toCsv,
    serialize: serialize,
    parseFile: parseFile,
    sample: sample,
  };
});
