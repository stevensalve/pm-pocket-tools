/* Gantt Timeline & Critical Path - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const todayIso = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  $('start').value = todayIso;
  let current = null;

  function state() {
    const t = GanttCore.parseTasks($('tasks').value);
    const h = GanttCore.parseHolidays($('holidays').value);
    return {
      name: $('name').value.trim(),
      start: $('start').value,
      workWeek: Number($('week').value),
      holidays: h.holidays,
      tasks: t.tasks,
      errors: t.errors.concat(h.errors),
    };
  }

  function render() {
    const s = state();
    setStatus($('status'), s.errors.join(' '), s.errors.length ? 'warn' : '');
    const ul = $('problems');
    ul.textContent = '';
    const tbl = $('t-plan');
    tbl.textContent = '';
    current = null;
    $('summary').textContent = '';
    if (!s.start) return;
    let r;
    try {
      r = GanttCore.schedule(s.tasks, { start: s.start, holidays: s.holidays, workWeek: s.workWeek });
    } catch (e) {
      return ul.appendChild(el('li', { text: e.message }));
    }
    if (!r.ok) return r.errors.forEach((m) => ul.appendChild(el('li', { text: m })));
    current = r;
    $('summary').textContent =
      'Finishes ' +
      OT.formatDate(r.end, 'dmy') +
      ' after ' +
      r.workingDays +
      ' working days. Critical path: ' +
      (r.criticalPath.join(' > ') || 'none') +
      '.';
    const b = GanttCore.bars(r);
    tbl.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['#', 'Task', 'Owner', 'Days', 'Start', 'Finish', 'Slack', 'Timeline'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    r.rows.forEach((row, i) => {
      const bar = el('span', {
        class: 'bar-fill' + (row.critical ? ' critical' : '') + (row.milestone ? ' milestone' : ''),
        title: row.name,
      });
      bar.style.left = b.bars[i].left + '%';
      if (!row.milestone) bar.style.width = b.bars[i].width + '%';
      body.appendChild(
        el('tr', {}, [
          el('td', { text: String(row.n) }),
          el('td', { text: row.name + (row.deps.length ? ' (after ' + row.deps.join(', ') + ')' : '') }),
          el('td', { text: row.owner }),
          el('td', { text: String(row.days) }),
          el('td', { text: OT.formatDate(row.start, 'dmy') }),
          el('td', { text: OT.formatDate(row.end, 'dmy') }),
          el('td', { text: row.critical ? 'critical' : String(row.slack) }),
          el('td', { class: 'track' }, [bar]),
        ]),
      );
    });
    tbl.appendChild(body);
  }

  function write(s) {
    $('name').value = s.name;
    $('start').value = s.start || todayIso;
    $('week').value = String(s.workWeek);
    $('tasks').value = GanttCore.tasksToText(s.tasks);
    $('holidays').value = s.holidays.join('\n');
  }

  ['name', 'start', 'week', 'tasks', 'holidays'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    write(GanttCore.sample($('start').value || todayIso));
    render();
  });
  const need = () => {
    if (!current) setStatus($('out-status'), 'Fix the problems above first.', 'error');
    return current;
  };
  $('csv').addEventListener(
    'click',
    () => need() && downloadBlob(GanttCore.toCsv(current), 'gantt-schedule.csv', 'text/csv;charset=utf-8'),
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
    downloadBlob(GanttCore.toIcs(current, stamp, $('name').value.trim()), 'gantt-tasks.ics', 'text/calendar;charset=utf-8');
  });
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () => {
    const s = state();
    downloadBlob(
      GanttCore.serialize({ name: s.name, start: s.start, workWeek: s.workWeek, holidays: s.holidays, tasks: s.tasks }),
      safeFileName(s.name || 'gantt-plan') + '.json',
      'application/json',
    );
  });
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      write(GanttCore.parse(await readText(f)));
      render();
      setStatus($('out-status'), 'Plan opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
