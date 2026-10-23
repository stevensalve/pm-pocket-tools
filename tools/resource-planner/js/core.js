/**
 * Resource Planner - core logic (pure).
 *
 * People line:      name | capacity % (default 100) | leave dates (2026-11-09..2026-11-13, 2026-12-24)
 * Assignment line:  person | project | start | end | percent of a full-time week (default 100)
 * Weeks run Monday to Sunday and have 5 working days. An assignment counts only on working days (Mon-Fri).
 * Load = booked % / capacity % for that week, where capacity shrinks by leave days.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.ResourceCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const DAY = 86400000;
  const MAX_PEOPLE = 100;
  const MAX_ASSIGN = 1000;
  const MAX_WEEKS = 52;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  /** Monday on or before an ISO date. */
  function mondayOf(d) {
    const t = OT.parseIsoDate(d);
    const dow = new Date(t).getUTCDay();
    return iso(t - ((dow + 6) % 7) * DAY);
  }

  function parseLeave(text, errs, label) {
    const days = new Set();
    String(text || '')
      .split(',')
      .map(norm)
      .filter(Boolean)
      .forEach((r) => {
        const m = /^(\S+?)(?:\s*\.\.\s*(\S+))?$/.exec(r);
        const a = m && OT.toIsoDate(m[1]);
        const b = m && (m[2] ? OT.toIsoDate(m[2]) : a);
        if (!a || !b || b < a) return errs.push(label + 'leave "' + r + '" should look like 2026-11-09 or 2026-11-09..2026-11-13.');
        for (let t = OT.parseIsoDate(a); t <= OT.parseIsoDate(b) && days.size < 400; t += DAY) days.add(iso(t));
      });
    return Array.from(days).sort();
  }

  function parsePeople(text) {
    const people = [];
    const errors = [];
    const seen = new Set();
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const label = 'People line ' + (i + 1) + ': ';
        if (!p[0]) return errors.push(label + 'no name.');
        if (seen.has(p[0].toLowerCase())) return errors.push(label + p[0] + ' is listed twice.');
        const cap = p[1] === undefined || p[1] === '' ? 100 : Number(p[1]);
        if (!isFinite(cap) || cap < 0 || cap > 100) return errors.push(label + 'capacity "' + p[1] + '" must be 0 to 100.');
        const before = errors.length;
        const leave = parseLeave(p[2], errors, label);
        if (errors.length > before) return;
        if (people.length >= MAX_PEOPLE) return errors.push('Only the first ' + MAX_PEOPLE + ' people are used.');
        seen.add(p[0].toLowerCase());
        people.push({ name: p[0].slice(0, 60), capacity: cap, leave: leave });
      });
    return { people: people, errors: errors };
  }

  function parseAssignments(text, people) {
    const items = [];
    const errors = [];
    const names = new Map((people || []).map((p) => [p.name.toLowerCase(), p.name]));
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const label = 'Assignment line ' + (i + 1) + ': ';
        if (!p[0] || !p[1]) return errors.push(label + 'needs a person and a project.');
        const who = names.get(p[0].toLowerCase());
        if (!who) return errors.push(label + p[0] + ' is not in the people list.');
        const a = OT.toIsoDate(p[2]);
        const b = OT.toIsoDate(p[3]);
        if (!a || !b) return errors.push(label + 'start and end must be dates.');
        if (b < a) return errors.push(label + 'the end is before the start.');
        const pct = p[4] === undefined || p[4] === '' ? 100 : Number(p[4]);
        if (!isFinite(pct) || pct <= 0 || pct > 100) return errors.push(label + 'percent "' + p[4] + '" must be above 0 and at most 100.');
        if (items.length >= MAX_ASSIGN) return errors.push('Only the first ' + MAX_ASSIGN + ' assignments are used.');
        items.push({ person: who, project: p[1].slice(0, 60), start: a, end: b, percent: pct });
      });
    return { items: items, errors: errors };
  }

  /**
   * Weekly grid. Returns { weeks:[mondayISO], rows:[{ person, capacity, cells:[{booked, capacity, load, status, projects:{}}] }],
   * projects:[{ project, personDays }], issues:[{ person, week, booked, capacity }] }
   * status: 'over' (booked above capacity), 'under' (below half of capacity), 'ok', 'off' (no capacity).
   */
  function grid(people, items, from, count) {
    const n = Math.max(1, Math.min(MAX_WEEKS, Math.floor(count) || 1));
    const first = mondayOf(from);
    const weeks = [];
    for (let i = 0; i < n; i++) weeks.push(OT.addDays(first, i * 7));
    const proj = {};
    const rows = people.map((p) => {
      const leave = new Set(p.leave);
      const mine = items.filter((a) => a.person === p.name);
      const cells = weeks.map((w) => {
        let leaveDays = 0;
        const booked = {};
        let total = 0;
        for (let d = 0; d < 5; d++) {
          const day = OT.addDays(w, d);
          if (leave.has(day)) leaveDays++;
          mine.forEach((a) => {
            if (day >= a.start && day <= a.end) {
              const share = a.percent / 5;
              booked[a.project] = (booked[a.project] || 0) + share;
              total += share;
              proj[a.project] = (proj[a.project] || 0) + a.percent / 100;
            }
          });
        }
        const cap = (p.capacity * (5 - leaveDays)) / 5;
        const r = (v) => Math.round(v * 10) / 10;
        const status = cap === 0 ? (total > 0 ? 'over' : 'off') : total > cap + 0.05 ? 'over' : total < cap * 0.5 ? 'under' : 'ok';
        return {
          week: w,
          booked: r(total),
          capacity: r(cap),
          load: cap === 0 ? (total > 0 ? null : 0) : Math.round((total / cap) * 100),
          status: status,
          leaveDays: leaveDays,
          projects: Object.keys(booked).reduce((o, k) => ((o[k] = r(booked[k])), o), {}),
        };
      });
      return { person: p.name, capacity: p.capacity, cells: cells };
    });
    const issues = [];
    rows.forEach((r) =>
      r.cells.forEach(
        (c) => c.status === 'over' && issues.push({ person: r.person, week: c.week, booked: c.booked, capacity: c.capacity }),
      ),
    );
    return {
      weeks: weeks,
      rows: rows,
      projects: Object.keys(proj)
        .map((k) => ({ project: k, personDays: Math.round(proj[k] * 10) / 10 }))
        .sort((a, b) => b.personDays - a.personDays || a.project.localeCompare(b.project)),
      issues: issues,
    };
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+\-@]/.test(t) && isNaN(Number(t)) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  /** One row per person with booked % per week (and capacity). */
  function toCsv(g) {
    const head = ['Person', 'Capacity %'].concat(g.weeks.map((w) => 'Week of ' + w));
    const rows = g.rows.map((r) =>
      [r.person, r.capacity].concat(r.cells.map((c) => c.booked + (c.capacity !== r.capacity ? ' (cap ' + c.capacity + ')' : ''))),
    );
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(state) {
    return JSON.stringify({ app: 'resource-planner', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved resource plan.');
    }
    const s = d && d.app === 'resource-planner' ? d.state : null;
    if (!s || typeof s.people !== 'string' || typeof s.assignments !== 'string') throw new Error('That file is not a saved resource plan.');
    return {
      people: s.people.slice(0, 20000),
      assignments: s.assignments.slice(0, 100000),
      from: OT.toIsoDate(s.from) || '',
      weeks: Number.isInteger(s.weeks) && s.weeks >= 1 && s.weeks <= MAX_WEEKS ? s.weeks : 8,
    };
  }

  function sample(today) {
    const m = mondayOf(today);
    const w = (n) => OT.addDays(m, n * 7);
    const f = (n) => OT.addDays(m, n * 7 + 4);
    return {
      people: ['Asha | 100', 'Ravi | 100 | ' + w(2) + '..' + f(2), 'Meera | 80', 'Kiran | 100'].join('\n'),
      assignments: [
        'Asha | Customer portal | ' + w(0) + ' | ' + f(3) + ' | 60',
        'Asha | Mobile app | ' + w(1) + ' | ' + f(5) + ' | 60',
        'Ravi | Customer portal | ' + w(0) + ' | ' + f(4) + ' | 100',
        'Meera | Mobile app | ' + w(0) + ' | ' + f(2) + ' | 50',
        'Kiran | Data migration | ' + w(1) + ' | ' + f(2) + ' | 100',
      ].join('\n'),
      from: m,
      weeks: 8,
    };
  }

  return {
    mondayOf: mondayOf,
    parsePeople: parsePeople,
    parseAssignments: parseAssignments,
    grid: grid,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
