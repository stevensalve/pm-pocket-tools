/* RAID Log - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el } = OT;
  const $ = (id) => document.getElementById(id);
  let state = RaidCore.create();
  const p2 = (n) => String(n).padStart(2, '0');
  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  };
  $('n-raised').value = today();

  const opts = (sel, first, items) => {
    sel.textContent = '';
    if (first !== null) sel.appendChild(el('option', { value: '', text: first }));
    items.forEach((x) => sel.appendChild(el('option', { value: x, text: x })));
  };
  opts($('n-type'), null, RaidCore.TYPES);
  opts($('f-type'), 'All types', RaidCore.TYPES);
  opts($('f-status'), 'All statuses', RaidCore.STATUSES);

  const filter = () => ({
    text: $('f-text').value,
    type: $('f-type').value,
    status: $('f-status').value,
    level: $('f-level').value,
    openOnly: $('f-open').checked,
    overdueOnly: $('f-over').checked,
  });
  const run = (fn) => {
    try {
      state = fn(state);
      setStatus($('status'), '', '');
      render();
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
  };

  function field(label, value, onChange, type, extra) {
    const inp = el('input', Object.assign({ type: type || 'text', value: value, 'aria-label': label }, extra || {}));
    inp.addEventListener('change', () => onChange(inp.value));
    return inp;
  }

  function render() {
    const t = today();
    const m = RaidCore.summary(state, t);
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    const box = $('stats');
    box.textContent = '';
    [
      stat('Open items', m.open),
      stat('Overdue', m.overdue, m.overdue > 0),
      stat('High risks/issues open', m.highOpen, m.highOpen > 0),
      stat('Open, no owner', m.noOwner, m.noOwner > 0),
    ].forEach((s) => box.appendChild(s));
    const parts = [m.byType.map((x) => x.type + 's ' + x.open + ' open').join(', ') + '.'];
    if (m.top.length) parts.push('Top: ' + m.top.map((x) => x.ref + ' (' + x.score + ')').join(', ') + '.');
    $('breakdown').textContent = state.items.length ? parts.join(' ') : 'The log is empty.';

    const rows = RaidCore.list(state, t, filter());
    const tbl = $('t-log');
    tbl.textContent = '';
    $('empty').hidden = rows.length > 0;
    if (!rows.length) return;
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Ref', 'Item', 'Score', 'Owner', 'Status', 'Due', 'Action'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    rows.forEach((r) => {
      const scored = r.type === 'Risk' || r.type === 'Issue';
      const status = el(
        'select',
        { 'aria-label': 'Status of ' + r.ref },
        RaidCore.STATUSES.map((s) => el('option', { value: s, text: s })),
      );
      status.value = r.status;
      status.addEventListener('change', () => run((s) => RaidCore.setStatus(s, r.id, status.value, t)));
      const score = scored
        ? el('div', {}, [
            el('span', { class: 'pill ' + r.level, text: r.score + ' ' + r.level }),
            el('div', { class: 'noprint' }, [
              field('Probability of ' + r.ref, r.probability, (v) => run((s) => RaidCore.update(s, r.id, { probability: v })), 'number', {
                min: '1',
                max: '5',
              }),
              field('Impact of ' + r.ref, r.impact, (v) => run((s) => RaidCore.update(s, r.id, { impact: v })), 'number', {
                min: '1',
                max: '5',
              }),
            ]),
          ])
        : el('span', { text: '-' });
      const due = r.due ? OT.formatDate(r.due, 'dmy') + (r.overdue ? ' (' + -r.daysToDue + ' days late)' : '') : '';
      body.appendChild(
        el('tr', {}, [
          el('td', { text: r.ref }),
          el('td', {}, [el('strong', { text: r.title }), el('div', { class: 'hint', text: r.type })]),
          el('td', {}, [score]),
          el('td', {}, [
            field('Owner of ' + r.ref, r.owner, (v) => run((s) => RaidCore.update(s, r.id, { owner: v })), 'text', { maxlength: '60' }),
          ]),
          el('td', {}, [status]),
          el('td', { class: r.overdue ? 'late' : '', text: due }),
          el('td', {}, [
            field('Action for ' + r.ref, r.action, (v) => run((s) => RaidCore.update(s, r.id, { action: v })), 'text', {
              maxlength: '300',
            }),
          ]),
        ]),
      );
    });
    tbl.appendChild(body);
  }

  $('add').addEventListener('click', () => {
    try {
      const r = RaidCore.add(state, {
        type: $('n-type').value,
        title: $('n-title').value,
        owner: $('n-owner').value,
        probability: $('n-p').value,
        impact: $('n-i').value,
        due: $('n-due').value,
        action: $('n-action').value,
        raised: $('n-raised').value,
      });
      state = r.state;
      setStatus($('status'), r.item.ref + ' added.', 'ok');
      $('n-title').value = '';
      $('n-action').value = '';
      render();
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
  });
  $('demo').addEventListener('click', () => {
    state = RaidCore.sample(today());
    render();
  });
  ['f-text', 'f-type', 'f-status', 'f-level', 'f-open', 'f-over'].forEach((id) => $(id).addEventListener('input', render));
  $('csv').addEventListener('click', () =>
    downloadBlob(RaidCore.toCsv(RaidCore.list(state, today(), filter())), 'raid-log.csv', 'text/csv;charset=utf-8'),
  );
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () => downloadBlob(RaidCore.serialize(state), 'raid-log.json', 'application/json'));
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      state = RaidCore.parse(await readText(f));
      render();
      setStatus($('out-status'), 'Opened ' + state.items.length + ' items.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
