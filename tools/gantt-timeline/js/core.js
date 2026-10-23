/**
 * Gantt Timeline & Critical Path - core logic (pure).
 *
 * Task line: name | working days | depends on (task numbers, e.g. 1,3) | owner | not before (ISO or DD/MM/YYYY)
 * Tasks are numbered 1..n in the order typed. 0 days makes a milestone.
 * Working days are Monday-Friday (or Monday-Saturday) minus the holidays you list.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.GanttCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const DAY = 86400000;
  const MAX_TASKS = 300;
  const MAX_DAYS = 3000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  /** Parse typed lines. Returns { tasks, errors }. Dependencies are checked later by schedule(). */
  function parseTasks(text) {
    const tasks = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, idx) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const label = 'Line ' + (idx + 1) + ': ';
        if (!p[0]) return errors.push(label + 'the task has no name.');
        const days = p[1] === undefined || p[1] === '' ? 1 : Number(p[1]);
        if (!Number.isInteger(days) || days < 0 || days > 1000)
          return errors.push(label + '"' + p[1] + '" is not a whole number of working days (0 to 1000).');
        const deps = [];
        let bad = '';
        (p[2] || '')
          .split(/[,\s]+/)
          .filter(Boolean)
          .forEach((d) => {
            const n = Number(d);
            if (!Number.isInteger(n) || n < 1) bad = '"' + d + '" is not a task number.';
            else if (deps.indexOf(n) === -1) deps.push(n);
          });
        if (bad) return errors.push(label + bad);
        let notBefore = '';
        if (p[4]) {
          notBefore = OT.toIsoDate(p[4]);
          if (!notBefore) return errors.push(label + '"' + p[4] + '" is not a date.');
        }
        if (tasks.length >= MAX_TASKS) return errors.push('Only the first ' + MAX_TASKS + ' tasks are used.');
        tasks.push({
          n: tasks.length + 1,
          name: p[0].slice(0, 80),
          days: days,
          deps: deps,
          owner: (p[3] || '').slice(0, 40),
          notBefore: notBefore,
        });
      });
    return { tasks: tasks, errors: errors };
  }

  const tasksToText = (tasks) =>
    tasks.map((t) => [t.name, t.days, t.deps.join(','), t.owner, t.notBefore].join(' | ').replace(/( \| )+$/, '')).join('\n');

  /** Working calendar: isWork(isoDate) */
  function calendar(opts) {
    const hol = new Set((opts.holidays || []).map((h) => OT.toIsoDate(h)).filter(Boolean));
    const sat = opts.workWeek === 6;
    return (d) => {
      const dow = new Date(OT.parseIsoDate(d)).getUTCDay();
      return dow !== 0 && (sat || dow !== 6) && !hol.has(d);
    };
  }

  function parseHolidays(text) {
    const out = [];
    const errors = [];
    String(text || '')
      .split(/[\r\n,;]+/)
      .map(norm)
      .filter(Boolean)
      .forEach((h) => {
        const d = OT.toIsoDate(h);
        if (d) out.push(d);
        else errors.push('"' + h + '" is not a date.');
      });
    return { holidays: Array.from(new Set(out)).sort(), errors: errors };
  }

  /**
   * Forward and backward pass. opts: { start (ISO), holidays [], workWeek 5|6 }
   * Returns { ok, errors, rows:[{n,name,owner,days,deps,start,end,slack,critical,...}], end, workingDays, criticalPath:[n...] }
   */
  function schedule(tasks, opts) {
    const o = Object.assign({ start: '', holidays: [], workWeek: 5 }, opts);
    OT.parseIsoDate(o.start);
    if (!tasks.length) return { ok: false, errors: ['Add at least one task.'], rows: [], end: '', workingDays: 0, criticalPath: [] };
    const errors = [];
    tasks.forEach((t) =>
      t.deps.forEach((d) => {
        if (d > tasks.length) errors.push('Task ' + t.n + ' (' + t.name + ') depends on task ' + d + ', which does not exist.');
        else if (d === t.n) errors.push('Task ' + t.n + ' (' + t.name + ') depends on itself.');
      }),
    );
    if (errors.length) return { ok: false, errors: errors, rows: [], end: '', workingDays: 0, criticalPath: [] };

    // topological order (Kahn); leftover = cycle
    const indeg = tasks.map((t) => t.deps.length);
    const out = tasks.map(() => []);
    tasks.forEach((t) => t.deps.forEach((d) => out[d - 1].push(t.n - 1)));
    const order = [];
    const q = [];
    indeg.forEach((d, i) => d === 0 && q.push(i));
    while (q.length) {
      const i = q.shift();
      order.push(i);
      out[i].forEach((j) => --indeg[j] === 0 && q.push(j));
    }
    if (order.length < tasks.length) {
      const stuck = tasks.filter((_, i) => indeg[i] > 0).map((t) => t.n + ' ' + t.name);
      return {
        ok: false,
        errors: ['These tasks depend on each other in a circle: ' + stuck.join('; ') + '.'],
        rows: [],
        end: '',
        workingDays: 0,
        criticalPath: [],
      };
    }

    // working-day calendar
    const isWork = calendar(o);
    const days = [];
    let t0 = OT.parseIsoDate(o.start);
    const horizon = tasks.reduce((a, t) => a + t.days, 0) + 400;
    for (let t = t0, guard = 0; days.length < Math.min(horizon, MAX_DAYS) && guard < 20000; t += DAY, guard++)
      if (isWork(iso(t))) days.push(iso(t));
    const idxOnOrAfter = (d) => {
      const i = days.findIndex((x) => x >= d);
      return i === -1 ? days.length : i;
    };

    const ES = [];
    const EF = [];
    order.forEach((i) => {
      const t = tasks[i];
      let es = 0;
      t.deps.forEach((d) => (es = Math.max(es, EF[d - 1])));
      if (t.notBefore) es = Math.max(es, idxOnOrAfter(t.notBefore));
      ES[i] = es;
      EF[i] = es + t.days;
    });
    const total = Math.max.apply(null, EF);
    if (total + 1 > days.length)
      return {
        ok: false,
        errors: ['The plan runs past ' + MAX_DAYS + ' working days. Check the durations.'],
        rows: [],
        end: '',
        workingDays: 0,
        criticalPath: [],
      };
    const LF = [];
    const LS = [];
    order
      .slice()
      .reverse()
      .forEach((i) => {
        LF[i] = out[i].length
          ? Math.min.apply(
              null,
              out[i].map((j) => LS[j]),
            )
          : total;
        LS[i] = LF[i] - tasks[i].days;
      });
    const dateAt = (k) => days[Math.min(k, days.length - 1)];
    const rows = tasks.map((t, i) => {
      const slack = LS[i] - ES[i];
      return {
        n: t.n,
        name: t.name,
        owner: t.owner,
        days: t.days,
        deps: t.deps.slice(),
        notBefore: t.notBefore,
        start: dateAt(ES[i]),
        end: t.days ? dateAt(EF[i] - 1) : dateAt(ES[i]),
        slack: slack,
        critical: slack === 0,
        milestone: t.days === 0,
        es: ES[i],
        ef: EF[i],
      };
    });
    // one critical chain: walk back from a critical task that finishes last
    const crit = [];
    let cur = rows.filter((r) => r.critical && r.ef === total).sort((a, b) => a.days - b.days)[0];
    while (cur) {
      crit.unshift(cur.n);
      cur = cur.deps.map((d) => rows[d - 1]).filter((r) => r.critical && r.ef === cur.es)[0];
    }
    return { ok: true, errors: [], rows: rows, end: total > 0 ? dateAt(total - 1) : dateAt(0), workingDays: total, criticalPath: crit };
  }

  /** Percent positions for drawing bars on a calendar-day axis. */
  function bars(result) {
    if (!result.ok || !result.rows.length) return { axis: [], bars: [] };
    const t0 = OT.parseIsoDate(result.rows.reduce((a, r) => (r.start < a ? r.start : a), result.rows[0].start));
    const t1 = OT.parseIsoDate(result.end);
    const span = Math.max(1, Math.round((t1 - t0) / DAY) + 1);
    const pos = (d) => Math.round(((OT.parseIsoDate(d) - t0) / DAY / span) * 10000) / 100;
    return {
      spanDays: span,
      from: iso(t0),
      bars: result.rows.map((r) => ({
        n: r.n,
        left: pos(r.start),
        width: r.milestone
          ? 0
          : Math.max(0.8, Math.round((((OT.parseIsoDate(r.end) - OT.parseIsoDate(r.start)) / DAY + 1) / span) * 10000) / 100),
        critical: r.critical,
        milestone: r.milestone,
      })),
    };
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+\-@]/.test(t) && isNaN(Number(t)) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(result) {
    const head = ['#', 'Task', 'Owner', 'Working days', 'Depends on', 'Start', 'Finish', 'Slack (working days)', 'Critical'];
    const rows = result.rows.map((r) => [
      r.n,
      r.name,
      r.owner,
      r.days,
      r.deps.join(' '),
      r.start,
      r.end,
      r.slack,
      r.critical ? 'Yes' : 'No',
    ]);
    return (
      '\ufeff' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    const out = [];
    let s = line;
    while (s.length > 73) {
      out.push(s.slice(0, 73));
      s = ' ' + s.slice(73);
    }
    out.push(s);
    return out.join('\r\n');
  }

  /** All-day calendar events, one per task. stamp = 'YYYYMMDDTHHMMSSZ'. */
  function toIcs(result, stamp, projectName) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PM Pocket Tools//Gantt//EN', 'CALSCALE:GREGORIAN'];
    result.rows.forEach((r) => {
      const end = OT.addDays(r.end, 1);
      lines.push(
        'BEGIN:VEVENT',
        'UID:task-' + r.n + '-' + r.start.replace(/-/g, '') + '@pm-pocket-tools',
        'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + r.start.replace(/-/g, ''),
        'DTEND;VALUE=DATE:' + (r.milestone ? OT.addDays(r.start, 1) : end).replace(/-/g, ''),
        fold('SUMMARY:' + icsEsc((projectName ? projectName + ': ' : '') + r.name + (r.critical ? ' (critical)' : ''))),
        fold('DESCRIPTION:' + icsEsc(r.owner ? 'Owner: ' + r.owner : '')),
        'END:VEVENT',
      );
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  function serialize(state) {
    return JSON.stringify({ app: 'gantt-timeline', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved Gantt plan.');
    }
    const s = d && d.app === 'gantt-timeline' ? d.state : null;
    if (!s || !Array.isArray(s.tasks)) throw new Error('That file is not a saved Gantt plan.');
    const tasks = parseTasks(
      s.tasks
        .slice(0, MAX_TASKS)
        .map((t) =>
          [t && t.name, t && t.days, Array.isArray(t && t.deps) ? t.deps.join(',') : '', t && t.owner, t && t.notBefore]
            .map((v) => String(v === undefined || v === null ? '' : v).replace(/[|\r\n]/g, ' '))
            .join('|'),
        )
        .join('\n'),
    ).tasks;
    const start = OT.toIsoDate(s.start);
    return {
      name: norm(s.name).slice(0, 80),
      start: start || '',
      workWeek: s.workWeek === 6 ? 6 : 5,
      holidays: parseHolidays((Array.isArray(s.holidays) ? s.holidays : []).join('\n')).holidays,
      tasks: tasks,
    };
  }

  function sample(today) {
    const tasks = parseTasks(
      [
        'Kick-off and scope | 2 | | Priya',
        'Requirements | 5 | 1 | Priya',
        'UI design | 6 | 2 | Meera',
        'Backend build | 12 | 2 | Ravi',
        'Frontend build | 10 | 3 | Kiran',
        'Integration testing | 5 | 4,5 | Asha',
        'User acceptance | 4 | 6 | Priya',
        'Training material | 3 | 3 | Meera',
        'Go-live | 0 | 7,8 | Priya',
      ].join('\n'),
    ).tasks;
    return { name: 'Customer portal', start: today, workWeek: 5, holidays: [], tasks: tasks };
  }

  return {
    parseTasks: parseTasks,
    tasksToText: tasksToText,
    parseHolidays: parseHolidays,
    schedule: schedule,
    bars: bars,
    toCsv: toCsv,
    toIcs: toIcs,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
