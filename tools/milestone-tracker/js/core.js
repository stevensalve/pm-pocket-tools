/**
 * Milestone Tracker - core logic (pure; "today" is always passed in).
 *
 * Line: milestone | baseline date | forecast date (actual date when Done) | status | owner
 * Status: Not started, In progress, Blocked, Done. Slip = forecast minus baseline in calendar days.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.MilestoneCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const DAY = 86400000;
  const MAX = 500;
  const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];
  const ORDER = ['overdue', 'blocked', 'slipping', 'due soon', 'on track', 'done late', 'done'];
  const diff = (a, b) => Math.round((OT.parseIsoDate(a) - OT.parseIsoDate(b)) / DAY);

  function statusOf(text) {
    const t = norm(text).toLowerCase();
    if (!t) return 'Not started';
    return (
      STATUSES.filter((s) => s.toLowerCase() === t || s.toLowerCase().replace(' ', '') === t.replace(/[\s_-]/g, ''))[0] ||
      (/^(complete|completed|finished|closed)$/.test(t)
        ? 'Done'
        : /^(wip|started|ongoing|active)$/.test(t)
          ? 'In progress'
          : /^(stuck|waiting|on hold)$/.test(t)
            ? 'Blocked'
            : null)
    );
  }

  function parse(text) {
    const items = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const at = 'Line ' + (i + 1) + ': ';
        if (!p[0]) return errors.push(at + 'the milestone has no name.');
        const base = OT.toIsoDate(p[1]);
        if (!base) return errors.push(at + '"' + (p[1] || '') + '" is not a baseline date.');
        let fc = base;
        if (p[2]) {
          fc = OT.toIsoDate(p[2]);
          if (!fc) return errors.push(at + '"' + p[2] + '" is not a forecast date.');
        }
        const st = statusOf(p[3]);
        if (!st) return errors.push(at + '"' + p[3] + '" is not a status (use Not started, In progress, Blocked or Done).');
        if (items.length >= MAX) return errors.push('Only the first ' + MAX + ' milestones are used.');
        items.push({
          n: items.length + 1,
          name: p[0].slice(0, 80),
          baseline: base,
          forecast: fc,
          status: st,
          owner: (p[4] || '').slice(0, 40),
        });
      });
    return { items: items, errors: errors };
  }

  const toText = (items) =>
    items.map((m) => [m.name, m.baseline, m.forecast, m.status, m.owner].join(' | ').replace(/( \| )+$/, '')).join('\n');

  /** Each milestone with slip, days to go and a state. Sorted by state urgency then forecast date. */
  function analyse(items, today, soonDays) {
    OT.parseIsoDate(today);
    const soon = soonDays === undefined ? 14 : soonDays;
    return items
      .map((m) => {
        const slip = diff(m.forecast, m.baseline);
        const toGo = diff(m.forecast, today);
        const done = m.status === 'Done';
        const state = done
          ? slip > 0
            ? 'done late'
            : 'done'
          : toGo < 0
            ? 'overdue'
            : m.status === 'Blocked'
              ? 'blocked'
              : slip > 0
                ? 'slipping'
                : toGo <= soon
                  ? 'due soon'
                  : 'on track';
        return Object.assign({}, m, { slip: slip, daysToGo: toGo, state: state });
      })
      .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.forecast.localeCompare(b.forecast) || a.n - b.n);
  }

  function summary(items, today, soonDays) {
    const rows = analyse(items, today, soonDays);
    const open = rows.filter((r) => r.status !== 'Done');
    const counts = {};
    ORDER.forEach((s) => (counts[s] = rows.filter((r) => r.state === s).length));
    const slips = open.map((r) => r.slip);
    const upcoming = open.filter((r) => r.daysToGo >= 0).sort((a, b) => a.forecast.localeCompare(b.forecast))[0] || null;
    return {
      total: rows.length,
      done: rows.length - open.length,
      open: open.length,
      counts: counts,
      attention: counts.overdue + counts.blocked + counts.slipping,
      worstSlip: slips.length ? Math.max.apply(null, slips) : 0,
      averageSlip: slips.length ? Math.round((slips.reduce((a, b) => a + b, 0) / slips.length) * 10) / 10 : 0,
      next: upcoming,
      lastForecast: rows.length ? rows.reduce((a, r) => (r.forecast > a ? r.forecast : a), rows[0].forecast) : '',
      lastBaseline: rows.length ? rows.reduce((a, r) => (r.baseline > a ? r.baseline : a), rows[0].baseline) : '',
    };
  }

  /** Short message listing what needs attention, ready to paste into an e-mail or chat. */
  function reminder(items, today, project) {
    const rows = analyse(items, today).filter((r) => ['overdue', 'blocked', 'slipping', 'due soon'].indexOf(r.state) !== -1);
    if (!rows.length) return 'Nothing needs attention on ' + OT.formatDate(today, 'dmy') + '.';
    const L = ['Milestone check' + (project ? ' - ' + project : '') + ' (' + OT.formatDate(today, 'dmy') + ')', ''];
    rows.forEach((r) => {
      const what =
        r.state === 'overdue'
          ? 'overdue by ' + -r.daysToGo + ' days'
          : r.state === 'blocked'
            ? 'blocked'
            : r.state === 'slipping'
              ? 'slipping ' + r.slip + ' days (now ' + OT.formatDate(r.forecast, 'dmy') + ')'
              : 'due in ' + r.daysToGo + ' days';
      L.push('- ' + r.name + ': ' + what + (r.owner ? ' [' + r.owner + ']' : ''));
    });
    return L.join('\n');
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(rows) {
    const head = ['#', 'Milestone', 'Owner', 'Status', 'Baseline', 'Forecast / actual', 'Slip (days)', 'State'];
    const out = rows.map((r) => [r.n, r.name, r.owner, r.status, r.baseline, r.forecast, r.slip, r.state]);
    return (
      '\ufeff' +
      [head]
        .concat(out)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
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

  /** All-day events on the forecast date for milestones not yet done, with an alert `alertDays` before. */
  function toIcs(items, stamp, alertDays, project) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PM Pocket Tools//Milestones//EN', 'CALSCALE:GREGORIAN'];
    items
      .filter((m) => m.status !== 'Done')
      .forEach((m) => {
        L.push(
          'BEGIN:VEVENT',
          'UID:milestone-' + m.n + '-' + m.forecast.replace(/-/g, '') + '@pm-pocket-tools',
          'DTSTAMP:' + stamp,
          'DTSTART;VALUE=DATE:' + m.forecast.replace(/-/g, ''),
          'DTEND;VALUE=DATE:' + OT.addDays(m.forecast, 1).replace(/-/g, ''),
          fold('SUMMARY:' + esc((project ? project + ': ' : '') + m.name)),
          fold('DESCRIPTION:' + esc('Baseline ' + OT.formatDate(m.baseline, 'dmy') + (m.owner ? '. Owner: ' + m.owner : ''))),
        );
        if (alertDays > 0)
          L.push(
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:Milestone due soon',
            'TRIGGER:-P' + Math.floor(alertDays) + 'D',
            'END:VALARM',
          );
        L.push('END:VEVENT');
      });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  function serialize(state) {
    return JSON.stringify({ app: 'milestone-tracker', version: 1, state: state }, null, 2);
  }

  function parseFile(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved milestone list.');
    }
    const s = d && d.app === 'milestone-tracker' ? d.state : null;
    if (!s || typeof s.text !== 'string') throw new Error('That file is not a saved milestone list.');
    return { name: norm(s.name).slice(0, 80), text: s.text.slice(0, 100000) };
  }

  function sample(today) {
    const at = (n) => OT.addDays(today, n);
    return [
      'Requirements signed off | ' + at(-50) + ' | ' + at(-48) + ' | Done | Priya',
      'Design approved | ' + at(-30) + ' | ' + at(-20) + ' | Done | Meera',
      'Backend APIs complete | ' + at(-10) + ' | ' + at(-3) + ' | In progress | Ravi',
      'Payment integration | ' + at(10) + ' | ' + at(21) + ' | Blocked | Kiran',
      'UAT start | ' + at(25) + ' | ' + at(32) + ' | Not started | Asha',
      'Training complete | ' + at(35) + ' | ' + at(35) + ' | Not started | Meera',
      'Go-live | ' + at(50) + ' | ' + at(57) + ' | Not started | Priya',
    ].join('\n');
  }

  return {
    STATUSES: STATUSES,
    parse: parse,
    toText: toText,
    analyse: analyse,
    summary: summary,
    reminder: reminder,
    toCsv: toCsv,
    toIcs: toIcs,
    serialize: serialize,
    parseFile: parseFile,
    sample: sample,
  };
});
