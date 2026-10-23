/* Budget Burn & Forecast - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('asof').value = todayIso;
  const rs = (n) => 'Rs. ' + OT.formatInr(n, 0);
  let current = null;

  function read() {
    return {
      name: $('name').value.trim(),
      budget: BurnCore.amount($('budget').value) || 0,
      start: $('start').value,
      end: $('end').value,
      basis: $('basis').value,
      paid: $('paid').value,
      committed: $('committed').value,
    };
  }
  function write(s) {
    $('name').value = s.name;
    $('budget').value = s.budget ? OT.formatInr(s.budget, 0) : '';
    $('start').value = s.start;
    $('end').value = s.end;
    $('basis').value = s.basis;
    $('paid').value = s.paid;
    $('committed').value = s.committed;
  }
  const clear = () => ['t-month', 't-cat', 'stats', 'narrative'].forEach((id) => ($(id).textContent = ''));

  function render() {
    const s = read();
    const pa = BurnCore.parseEntries(s.paid, 'Paid');
    const co = BurnCore.parseEntries(s.committed, 'Committed');
    const errs = pa.errors.concat(co.errors);
    setStatus($('status'), errs.slice(0, 5).join(' '), errs.length ? 'warn' : '');
    clear();
    current = null;
    $('verdict').hidden = true;
    ['m-paid', 'm-commit'].forEach((id) => ($(id).style.width = '0%'));
    if (!s.start || !s.end || !$('asof').value) return;
    let m;
    try {
      m = BurnCore.summary(s, pa.entries, co.entries, $('asof').value);
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    current = { cfg: s, paid: pa.entries, committed: co.entries, asOf: $('asof').value };
    const v = $('verdict');
    v.hidden = false;
    v.className = 'verdict ' + m.verdict;
    v.textContent = {
      'on-track': 'On track: the forecast stays within budget.',
      watch: 'Watch: the forecast is slightly over budget.',
      'at-risk': 'At risk: the forecast is more than 5% over budget.',
      over: 'Over budget: paid plus committed already exceeds the budget.',
    }[m.verdict];
    const stat = (label, val, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: val }), label]);
    const box = $('stats');
    [
      stat('Budget', rs(m.budget)),
      stat('Paid (' + m.spentPct + '%)', rs(m.spent)),
      stat('Committed', rs(m.committed)),
      stat('Left to commit', rs(m.remaining), m.remaining < 0),
      stat('Forecast at completion', rs(m.forecast), m.variance > 0),
      stat('Variance', (m.variance > 0 ? '+' : '') + rs(m.variance), m.variance > 0),
      stat('Monthly burn', rs(m.monthlyBurn)),
      stat('Time used', m.timePct + '%'),
    ].forEach((x) => box.appendChild(x));
    $('m-paid').style.width = Math.min(100, m.spentPct) + '%';
    $('m-commit').style.width = Math.min(100 - Math.min(100, m.spentPct), m.committedPct) + '%';
    $('m-time').style.left = Math.min(99.5, m.timePct) + '%';
    $('meter').className = 'meter' + (m.remaining < 0 ? ' over' : '');
    const t = [];
    t.push(
      'Day ' +
        m.elapsedDays +
        ' of ' +
        m.totalDays +
        '. Spending is ' +
        (m.paceGap > 0 ? m.paceGap + ' points ahead of' : m.paceGap < 0 ? -m.paceGap + ' points behind' : 'level with') +
        ' the calendar.',
    );
    if (m.runOutStatus === 'before-end')
      t.push('At this burn rate the money runs out around ' + OT.formatDate(m.runOut, 'dmy') + ', before the end date.');
    else if (m.runOutStatus === 'after-end') t.push('At this burn rate the budget lasts past the end date.');
    else if (m.runOutStatus === 'already') t.push('There is nothing left to commit.');
    if (m.ignoredFuture) t.push(m.ignoredFuture + ' paid entries are dated after the as-of date and were ignored.');
    $('narrative').textContent = t.join(' ');

    const mt = $('t-month');
    mt.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Month', 'Spend', 'Cumulative', 'Plan (straight line)'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const mb = el('tbody');
    BurnCore.monthly(s, pa.entries, current.asOf).forEach((r) =>
      mb.appendChild(
        el('tr', {}, [
          el('td', { text: r.month }),
          el('td', { class: 'num', text: r.future ? '' : OT.formatInr(r.spend, 0) }),
          el('td', { class: 'num', text: r.future ? '' : OT.formatInr(r.cumulative, 0) }),
          el('td', { class: 'num', text: OT.formatInr(r.plannedCumulative, 0) }),
        ]),
      ),
    );
    mt.appendChild(mb);
    const ct = $('t-cat');
    ct.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Category', 'Paid', 'Committed', 'Total'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const cb = el('tbody');
    BurnCore.byCategory(pa.entries, co.entries, current.asOf).forEach((c) =>
      cb.appendChild(
        el('tr', {}, [
          el('td', { text: c.category }),
          el('td', { class: 'num', text: OT.formatInr(c.paid, 0) }),
          el('td', { class: 'num', text: OT.formatInr(c.committed, 0) }),
          el('td', { class: 'num', text: OT.formatInr(c.total, 0) }),
        ]),
      ),
    );
    ct.appendChild(cb);
  }

  ['name', 'budget', 'start', 'end', 'asof', 'basis', 'paid', 'committed'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    write(BurnCore.sample(todayIso));
    render();
  });
  $('csv').addEventListener('click', () =>
    current
      ? downloadBlob(
          BurnCore.toCsv(current.cfg, current.paid, current.committed, current.asOf),
          'budget-burn.csv',
          'text/csv;charset=utf-8',
        )
      : setStatus($('out-status'), 'Fill in the budget and dates first.', 'error'),
  );
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(BurnCore.serialize(read()), safeFileName($('name').value || 'budget') + '.json', 'application/json'),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      write(BurnCore.parse(await readText(f)));
      render();
      setStatus($('out-status'), 'Budget opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
