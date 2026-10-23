/* Resource Planner - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('from').value = todayIso;
  let current = null;

  function render() {
    const pp = ResourceCore.parsePeople($('people').value);
    const aa = ResourceCore.parseAssignments($('assign').value, pp.people);
    const errs = pp.errors.concat(aa.errors);
    setStatus(
      $('status'),
      errs.slice(0, 6).join(' ') + (errs.length > 6 ? ' (and ' + (errs.length - 6) + ' more)' : ''),
      errs.length ? 'warn' : '',
    );
    const tbl = $('t-grid');
    const pt = $('t-proj');
    tbl.textContent = '';
    pt.textContent = '';
    current = null;
    $('summary').textContent = '';
    if (!pp.people.length || !$('from').value) return;
    const g = ResourceCore.grid(pp.people, aa.items, $('from').value, Number($('weeks').value) || 8);
    current = g;
    $('summary').textContent = g.issues.length
      ? g.issues.length +
        ' over-booked person-weeks: ' +
        g.issues
          .slice(0, 5)
          .map((i) => i.person + ' (' + OT.formatDate(i.week, 'dmy') + ', ' + i.booked + '% of ' + i.capacity + '%)')
          .join('; ') +
        (g.issues.length > 5 ? '...' : '')
      : 'Nobody is over-booked in this period.';
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          [el('th', { scope: 'col', text: 'Person' })].concat(
            g.weeks.map((w) => el('th', { scope: 'col', text: OT.formatDate(w, 'dmy').slice(0, 5) })),
          ),
        ),
      ]),
    );
    const body = el('tbody');
    g.rows.forEach((r) => {
      body.appendChild(
        el(
          'tr',
          {},
          [el('th', { scope: 'row', text: r.person + (r.capacity < 100 ? ' (' + r.capacity + '%)' : '') })].concat(
            r.cells.map((c) => {
              const split = Object.keys(c.projects)
                .map((k) => k + ' ' + c.projects[k] + '%')
                .join(', ');
              return el('td', {
                class: 'cellx ' + c.status,
                title: (split || 'nothing booked') + (c.leaveDays ? '; ' + c.leaveDays + ' leave days' : ''),
                text: c.status === 'off' ? 'off' : String(c.booked),
              });
            }),
          ),
        ),
      );
    });
    tbl.appendChild(body);
    if (g.projects.length) {
      pt.appendChild(
        el('thead', {}, [
          el(
            'tr',
            {},
            ['Project', 'Person-days'].map((h) => el('th', { scope: 'col', text: h })),
          ),
        ]),
      );
      const pb = el('tbody');
      g.projects.forEach((p) =>
        pb.appendChild(el('tr', {}, [el('td', { text: p.project }), el('td', { class: 'num', text: String(p.personDays) })])),
      );
      pt.appendChild(pb);
    }
  }

  ['people', 'assign', 'from', 'weeks'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    const s = ResourceCore.sample(todayIso);
    $('people').value = s.people;
    $('assign').value = s.assignments;
    $('from').value = s.from;
    $('weeks').value = s.weeks;
    render();
  });
  $('csv').addEventListener('click', () =>
    current
      ? downloadBlob(ResourceCore.toCsv(current), 'resource-plan.csv', 'text/csv;charset=utf-8')
      : setStatus($('out-status'), 'Add some people first.', 'error'),
  );
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(
      ResourceCore.serialize({
        people: $('people').value,
        assignments: $('assign').value,
        from: $('from').value,
        weeks: Number($('weeks').value) || 8,
      }),
      'resource-plan.json',
      'application/json',
    ),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const s = ResourceCore.parse(await readText(f));
      $('people').value = s.people;
      $('assign').value = s.assignments;
      if (s.from) $('from').value = s.from;
      $('weeks').value = s.weeks;
      render();
      setStatus($('out-status'), 'Plan opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
