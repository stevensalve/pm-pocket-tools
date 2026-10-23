/* Change Request Log - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  let state = ChangeCore.create();
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('n-date').value = todayIso;
  $('d-date').value = todayIso;
  const rs = (n) => 'Rs. ' + (n < 0 ? '-' : '') + OT.formatInr(Math.abs(n), 0);
  const days = (n) => (n > 0 ? '+' : '') + n + ' days';

  const opts = (sel, first, items) => {
    sel.textContent = '';
    if (first !== null) sel.appendChild(el('option', { value: '', text: first }));
    items.forEach((x) => sel.appendChild(el('option', { value: x, text: x })));
  };
  opts($('n-cat'), null, ChangeCore.CATEGORIES);
  opts($('n-pri'), null, ChangeCore.PRIORITIES);
  $('n-pri').value = 'Medium';
  opts($('f-status'), 'All statuses', ChangeCore.STATUSES);

  const baseline = () => ({ budget: OT.parseAmount($('b-budget').value) || 0, endDate: $('b-end').value });
  const run = (fn) => {
    try {
      state = fn(state);
      setStatus($('status'), '', '');
      render();
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
  };

  function render() {
    const b = baseline();
    const t = ChangeCore.totals(state, b);
    const box = $('stats');
    box.textContent = '';
    const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: v }), label]);
    [
      stat('Changes', String(t.count)),
      stat('Approved cost', rs(t.approvedCost)),
      stat('Approved delay', days(t.approvedDays)),
      stat('Waiting for decision', t.pending + ' (' + rs(t.pendingCost) + ')'),
    ].forEach((x) => box.appendChild(x));
    const n = [];
    if (t.revisedBudget !== undefined)
      n.push(
        'Revised budget ' +
          rs(t.revisedBudget) +
          ' (' +
          (t.budgetGrowthPct > 0 ? '+' : '') +
          t.budgetGrowthPct +
          '%); ' +
          rs(t.ifPendingApproved) +
          ' if everything pending is approved.',
      );
    if (t.revisedEnd)
      n.push(
        'Revised end ' +
          OT.formatDate(t.revisedEnd, 'dmy') +
          '; ' +
          OT.formatDate(t.ifPendingEnd, 'dmy') +
          ' if everything pending is approved.',
      );
    $('narrative').textContent = n.join(' ');

    const rows = ChangeCore.list(state, { status: $('f-status').value });
    const tbl = $('t-log');
    tbl.textContent = '';
    $('empty').hidden = rows.length > 0;
    if (!rows.length) return;
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Ref', 'Change', 'Cost', 'Days', 'Status', 'Decision', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    rows.forEach((r) => {
      const next = ChangeCore.NEXT[r.status];
      const sel = el(
        'select',
        { 'aria-label': 'Move ' + r.ref + ' to' },
        [el('option', { value: '', text: next.length ? 'Move to...' : 'Final' })].concat(
          next.map((x) => el('option', { value: x, text: x })),
        ),
      );
      sel.disabled = !next.length;
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v) run((s) => ChangeCore.setStatus(s, r.id, v, { by: $('d-by').value, date: $('d-date').value, note: $('d-note').value }));
      });
      const pdf = el('button', { type: 'button', text: 'Form (PDF)', 'aria-label': 'Form for ' + r.ref });
      pdf.addEventListener('click', async () => {
        try {
          downloadBlob(
            await ChangeCore.buildPdf(PDFLib, r, { project: $('project').value.trim() }),
            safeFileName(r.ref + '-' + r.title) + '.pdf',
            'application/pdf',
          );
          setStatus($('out-status'), 'Form for ' + r.ref + ' ready.', 'ok');
        } catch (e) {
          setStatus($('out-status'), e.message, 'error');
        }
      });
      body.appendChild(
        el('tr', {}, [
          el('td', { text: r.ref }),
          el('td', {}, [
            el('strong', { text: r.title }),
            el('div', {
              class: 'hint',
              text: [r.category, r.priority + ' priority', r.requestedBy && 'by ' + r.requestedBy].filter(Boolean).join(' / '),
            }),
          ]),
          el('td', { class: 'num', text: rs(r.costImpact) }),
          el('td', { class: 'num', text: days(r.daysImpact) }),
          el('td', {}, [el('span', { class: 'pill ' + r.status, text: r.status })]),
          el('td', {
            text: r.decidedOn ? r.decidedBy + ', ' + OT.formatDate(r.decidedOn, 'dmy') + (r.decisionNote ? ': ' + r.decisionNote : '') : '',
          }),
          el('td', { class: 'noprint' }, [sel, pdf]),
        ]),
      );
    });
    tbl.appendChild(body);
  }

  $('add').addEventListener('click', () => {
    try {
      const r = ChangeCore.add(state, {
        title: $('n-title').value,
        description: $('n-desc').value,
        requestedBy: $('n-by').value,
        raised: $('n-date').value,
        category: $('n-cat').value,
        priority: $('n-pri').value,
        costImpact: $('n-cost').value,
        daysImpact: $('n-days').value,
      });
      state = r.state;
      setStatus($('status'), r.item.ref + ' added as a draft.', 'ok');
      ['n-title', 'n-desc', 'n-cost', 'n-days'].forEach((id) => ($(id).value = ''));
      render();
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
  });
  $('demo').addEventListener('click', () => {
    state = ChangeCore.sample(todayIso);
    render();
  });
  ['b-budget', 'b-end', 'f-status'].forEach((id) => $(id).addEventListener('input', render));
  $('csv').addEventListener('click', () =>
    downloadBlob(
      ChangeCore.toCsv(ChangeCore.list(state, { status: $('f-status').value })),
      'change-requests.csv',
      'text/csv;charset=utf-8',
    ),
  );
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(ChangeCore.serialize(state, baseline()), safeFileName($('project').value || 'change-log') + '.json', 'application/json'),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const r = ChangeCore.parse(await readText(f));
      state = r.state;
      $('b-budget').value = r.baseline.budget ? OT.formatInr(r.baseline.budget, 0) : '';
      $('b-end').value = r.baseline.endDate;
      render();
      setStatus($('out-status'), 'Opened ' + state.items.length + ' change requests.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
