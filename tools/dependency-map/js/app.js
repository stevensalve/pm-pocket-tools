/* Dependency Map - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  let current = null;

  function svg(tag, attrs, text) {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (text !== undefined) n.textContent = text;
    return n;
  }
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  function draw(tasks, a) {
    const box = $('diagram');
    box.textContent = '';
    const l = DepCore.layout(tasks, a);
    const root = svg('svg', { width: l.width, height: l.height, viewBox: '0 0 ' + l.width + ' ' + l.height, role: 'presentation' });
    const defs = svg('defs');
    const mk = svg('marker', { id: 'arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' });
    mk.appendChild(svg('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#6b7280' }));
    defs.appendChild(mk);
    root.appendChild(defs);
    l.edges.forEach((e) => {
      const mx = (e.x1 + e.x2) / 2;
      root.appendChild(
        svg('path', {
          d: 'M' + e.x1 + ',' + e.y1 + ' C' + mx + ',' + e.y1 + ' ' + mx + ',' + e.y2 + ' ' + e.x2 + ',' + e.y2,
          fill: 'none',
          stroke: e.onLongest ? '#dc2626' : '#9ca3af',
          'stroke-width': e.onLongest ? 2 : 1.2,
          'marker-end': 'url(#arrow)',
        }),
      );
    });
    l.nodes.forEach((n) => {
      const g = svg('g');
      g.appendChild(svg('title', {}, n.n + '. ' + n.name));
      g.appendChild(
        svg('rect', {
          x: n.x,
          y: n.y,
          width: n.w,
          height: n.h,
          rx: 8,
          fill: n.done ? '#dcfce7' : n.ready ? '#dbeafe' : '#f3f4f6',
          stroke: n.critical ? '#dc2626' : '#9ca3af',
          'stroke-width': n.critical ? 2 : 1,
        }),
      );
      g.appendChild(
        svg('text', { x: n.x + 8, y: n.y + 18, 'font-size': 12, 'font-weight': 700, fill: '#111827' }, n.n + '. ' + clip(n.name, 20)),
      );
      g.appendChild(
        svg(
          'text',
          { x: n.x + 8, y: n.y + 34, 'font-size': 10.5, fill: '#4b5563' },
          n.done ? 'done' : n.ready ? 'can start now' : 'waiting',
        ),
      );
      root.appendChild(g);
    });
    box.appendChild(root);
  }

  function render() {
    const r = DepCore.parse($('text').value);
    setStatus($('status'), r.errors.slice(0, 5).join(' '), r.errors.length ? 'warn' : '');
    ['problems', 'stats', 'narrative', 'diagram', 't-list'].forEach((id) => ($(id).textContent = ''));
    current = null;
    if (!r.tasks.length) return;
    const a = DepCore.analyse(r.tasks);
    if (!a.ok) {
      return $('problems').appendChild(
        el('li', {
          text:
            'These tasks depend on each other in a circle, so no order is possible: ' +
            a.cycle.map((n) => n + ' ' + r.tasks[n - 1].name).join(' > ') +
            '.',
        }),
      );
    }
    current = { tasks: r.tasks, a: a };
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    [
      stat('Tasks', r.tasks.length),
      stat('Done', a.done.length),
      stat('Can start now', a.ready.length),
      stat('Blocked', a.blocked.length, a.blocked.length > 0),
      stat('Longest chain', a.longest.length),
    ].forEach((x) => $('stats').appendChild(x));
    const top = r.tasks.filter((t) => !t.done).sort((x, y) => a.downstream[y.n] - a.downstream[x.n] || x.n - y.n)[0];
    const t = [];
    if (a.ready.length) t.push('Can start now: ' + a.ready.map((n) => n + ' ' + r.tasks[n - 1].name).join('; ') + '.');
    if (top && a.downstream[top.n] > 0)
      t.push('Biggest blocker: ' + top.n + ' ' + top.name + ' holds up ' + a.downstream[top.n] + ' other tasks.');
    if (a.isolated.length) t.push('Not connected to anything: ' + a.isolated.map((n) => n + ' ' + r.tasks[n - 1].name).join('; ') + '.');
    $('narrative').textContent = t.join(' ');
    draw(r.tasks, a);
    const tb = $('t-list');
    tb.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['#', 'Task', 'Owner', 'Depends on', 'State', 'Unblocks'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    r.tasks.forEach((x) => {
      const b = a.blocked.find((y) => y.n === x.n);
      const state = x.done ? 'Done' : b ? 'Waiting on ' + b.waitingOn.join(', ') : 'Can start now';
      body.appendChild(
        el('tr', {}, [
          el('td', { text: String(x.n) }),
          el('td', { text: x.name }),
          el('td', { text: x.owner }),
          el('td', { text: x.deps.join(', ') }),
          el('td', { text: state }),
          el('td', { class: 'num', text: String(a.downstream[x.n]) }),
        ]),
      );
    });
    tb.appendChild(body);
  }

  ['name', 'text'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    $('text').value = DepCore.sample();
    render();
  });
  const need = () => {
    if (!current) setStatus($('out-status'), 'Add some tasks without circular dependencies first.', 'error');
    return current;
  };
  $('csv').addEventListener(
    'click',
    () => need() && downloadBlob(DepCore.toCsv(current.tasks, current.a), 'dependencies.csv', 'text/csv;charset=utf-8'),
  );
  $('dot').addEventListener(
    'click',
    () => need() && downloadBlob(DepCore.toDot(current.tasks), 'dependencies.dot', 'text/plain;charset=utf-8'),
  );
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(
      DepCore.serialize({ name: $('name').value.trim(), text: $('text').value }),
      safeFileName($('name').value || 'dependency-map') + '.json',
      'application/json',
    ),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const s = DepCore.parseFile(await readText(f));
      $('name').value = s.name;
      $('text').value = s.text;
      render();
      setStatus($('out-status'), 'Map opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
