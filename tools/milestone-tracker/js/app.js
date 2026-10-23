/* Milestone Tracker - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('today').value = todayIso;
  let items = [];

  function render() {
    const r = MilestoneCore.parse($('text').value);
    items = r.items;
    setStatus($('status'), r.errors.join(' '), r.errors.length ? 'warn' : '');
    const today = $('today').value;
    ['stats', 'narrative', 'msg', 't-ms'].forEach((id) => ($(id).textContent = ''));
    if (!today || !items.length) return;
    const soon = Number($('soon').value);
    const s = MilestoneCore.summary(items, today, soon);
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    [
      stat('Milestones', s.total),
      stat('Done', s.done),
      stat('Overdue', s.counts.overdue, s.counts.overdue > 0),
      stat('Blocked', s.counts.blocked, s.counts.blocked > 0),
      stat('Slipping', s.counts.slipping, s.counts.slipping > 0),
      stat('Worst slip (days)', s.worstSlip, s.worstSlip > 0),
    ].forEach((x) => $('stats').appendChild(x));
    const t = [];
    if (s.next) t.push('Next: ' + s.next.name + ' on ' + OT.formatDate(s.next.forecast, 'dmy') + ' (' + s.next.daysToGo + ' days).');
    if (s.lastForecast)
      t.push(
        'Last milestone ' +
          (s.lastForecast > s.lastBaseline
            ? 'moved from ' + OT.formatDate(s.lastBaseline, 'dmy') + ' to ' + OT.formatDate(s.lastForecast, 'dmy') + '.'
            : 'is on ' + OT.formatDate(s.lastForecast, 'dmy') + ', as baselined.'),
      );
    $('narrative').textContent = t.join(' ');
    const rows = MilestoneCore.analyse(items, today, soon);
    const tbl = $('t-ms');
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Milestone', 'Owner', 'Status', 'Baseline', 'Forecast', 'Slip', 'State'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    rows.forEach((x) =>
      body.appendChild(
        el('tr', {}, [
          el('td', { text: x.name }),
          el('td', { text: x.owner }),
          el('td', { text: x.status }),
          el('td', { text: OT.formatDate(x.baseline, 'dmy') }),
          el('td', { text: OT.formatDate(x.forecast, 'dmy') }),
          el('td', { class: x.slip > 0 ? 'late' : '', text: x.slip > 0 ? '+' + x.slip + ' d' : x.slip < 0 ? x.slip + ' d' : '-' }),
          el('td', {}, [el('span', { class: 'pill ' + x.state.replace(' ', '-'), text: x.state })]),
        ]),
      ),
    );
    tbl.appendChild(body);
    $('msg').textContent = MilestoneCore.reminder(items, today, $('name').value.trim());
  }

  ['name', 'today', 'soon', 'text'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    $('text').value = MilestoneCore.sample($('today').value || todayIso);
    render();
  });
  $('copy').addEventListener('click', async () => {
    const ok = await copyText($('msg').textContent);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  const need = () => {
    if (!items.length) setStatus($('out-status'), 'Add some milestones first.', 'error');
    return items.length > 0;
  };
  $('csv').addEventListener(
    'click',
    () =>
      need() &&
      downloadBlob(
        MilestoneCore.toCsv(MilestoneCore.analyse(items, $('today').value, Number($('soon').value))),
        'milestones.csv',
        'text/csv;charset=utf-8',
      ),
  );
  $('ics').addEventListener('click', () => {
    if (!need()) return;
    const n = new Date();
    const stamp =
      n.getUTCFullYear() +
      p2(n.getUTCMonth() + 1) +
      p2(n.getUTCDate()) +
      'T' +
      p2(n.getUTCHours()) +
      p2(n.getUTCMinutes()) +
      p2(n.getUTCSeconds()) +
      'Z';
    downloadBlob(
      MilestoneCore.toIcs(items, stamp, Number($('soon').value) > 0 ? 3 : 0, $('name').value.trim()),
      'milestones.ics',
      'text/calendar;charset=utf-8',
    );
  });
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(
      MilestoneCore.serialize({ name: $('name').value.trim(), text: $('text').value }),
      safeFileName($('name').value || 'milestones') + '.json',
      'application/json',
    ),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const s = MilestoneCore.parseFile(await readText(f));
      $('name').value = s.name;
      $('text').value = s.text;
      render();
      setStatus($('out-status'), 'Milestones opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
