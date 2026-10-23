/**
 * RAID Log - core logic (pure; "today" is always passed in).
 *
 * Item: { id, ref, type, title, owner, probability 1-5, impact 1-5, score, status, due (ISO or ""), action, raised (ISO), closed (ISO or "") }
 * Types: Risk, Assumption, Issue, Dependency. Score = probability x impact (risks and issues; others default to 1x1).
 * Open statuses: Open, In progress. Finished statuses: Closed, Accepted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.RaidCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const TYPES = ['Risk', 'Assumption', 'Issue', 'Dependency'];
  const STATUSES = ['Open', 'In progress', 'Closed', 'Accepted'];
  const FINISHED = ['Closed', 'Accepted'];
  const PREFIX = { Risk: 'R', Assumption: 'A', Issue: 'I', Dependency: 'D' };
  const MAX = 3000;
  const DAY = 86400000;

  const create = () => ({ counters: { Risk: 0, Assumption: 0, Issue: 0, Dependency: 0 }, items: [] });
  const scale = (v, what) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error(what + ' must be a whole number from 1 to 5.');
    return n;
  };
  const level = (score) => (score >= 15 ? 'High' : score >= 8 ? 'Medium' : 'Low');

  /** Add an item. i: { type, title, owner, probability, impact, due, action, raised }. Returns { state, item }. */
  function add(state, i) {
    if (TYPES.indexOf(i.type) === -1) throw new Error('Choose Risk, Assumption, Issue or Dependency.');
    const title = norm(i.title);
    if (!title) throw new Error('Describe the item in a few words.');
    OT.parseIsoDate(i.raised);
    if (i.due) OT.parseIsoDate(i.due);
    if (state.items.length >= MAX) throw new Error('The log is full (' + MAX + ' items).');
    const scored = i.type === 'Risk' || i.type === 'Issue';
    const p = scored
      ? scale(i.probability === undefined || i.probability === '' ? (i.type === 'Issue' ? 5 : 3) : i.probability, 'Probability')
      : 1;
    const m = scored ? scale(i.impact === undefined || i.impact === '' ? 3 : i.impact, 'Impact') : 1;
    const s = copy(state);
    const n = ++s.counters[i.type];
    const item = {
      id: PREFIX[i.type] + n,
      ref: PREFIX[i.type] + String(n).padStart(2, '0'),
      type: i.type,
      title: title.slice(0, 140),
      owner: norm(i.owner).slice(0, 60),
      probability: p,
      impact: m,
      score: p * m,
      status: 'Open',
      due: i.due || '',
      action: norm(i.action).slice(0, 300),
      raised: i.raised,
      closed: '',
    };
    s.items.push(item);
    return { state: s, item: item };
  }

  function find(s, id) {
    const it = s.items.find((x) => x.id === id);
    if (!it) throw new Error('No such item.');
    return it;
  }

  /** Change fields: { owner, action, due, probability, impact, title }. Score is recalculated. */
  function update(state, id, patch) {
    const s = copy(state);
    const it = find(s, id);
    if (patch.title !== undefined) {
      if (!norm(patch.title)) throw new Error('Describe the item in a few words.');
      it.title = norm(patch.title).slice(0, 140);
    }
    if (patch.owner !== undefined) it.owner = norm(patch.owner).slice(0, 60);
    if (patch.action !== undefined) it.action = norm(patch.action).slice(0, 300);
    if (patch.due !== undefined) {
      if (patch.due) OT.parseIsoDate(patch.due);
      it.due = patch.due;
    }
    if (it.type === 'Risk' || it.type === 'Issue') {
      if (patch.probability !== undefined) it.probability = scale(patch.probability, 'Probability');
      if (patch.impact !== undefined) it.impact = scale(patch.impact, 'Impact');
      it.score = it.probability * it.impact;
    }
    return s;
  }

  function setStatus(state, id, status, date) {
    if (STATUSES.indexOf(status) === -1) throw new Error('Choose a status.');
    const s = copy(state);
    const it = find(s, id);
    if (FINISHED.indexOf(status) !== -1) {
      OT.parseIsoDate(date);
      if (date < it.raised) throw new Error('It cannot be closed before it was raised.');
      if (!it.closed) it.closed = date;
    } else it.closed = '';
    it.status = status;
    return s;
  }

  /** Rows with age, daysToDue (negative = late), overdue and level; filters: type, status, owner, level, openOnly, overdueOnly, text. Highest score first. */
  function list(state, today, filter) {
    OT.parseIsoDate(today);
    const f = Object.assign({ type: '', status: '', owner: '', level: '', openOnly: false, overdueOnly: false, text: '' }, filter);
    const q = norm(f.text).toLowerCase();
    return state.items
      .map((i) => {
        const open = FINISHED.indexOf(i.status) === -1;
        const daysToDue = i.due ? Math.round((OT.parseIsoDate(i.due) - OT.parseIsoDate(today)) / DAY) : null;
        return Object.assign({}, i, {
          open: open,
          level: level(i.score),
          age: Math.round((OT.parseIsoDate(open ? today : i.closed) - OT.parseIsoDate(i.raised)) / DAY),
          daysToDue: daysToDue,
          overdue: open && daysToDue !== null && daysToDue < 0,
        });
      })
      .filter(
        (r) =>
          (!f.type || r.type === f.type) &&
          (!f.status || r.status === f.status) &&
          (!f.owner || r.owner === f.owner) &&
          (!f.level || r.level === f.level) &&
          (!f.openOnly || r.open) &&
          (!f.overdueOnly || r.overdue) &&
          (!q || (r.title + ' ' + r.ref + ' ' + r.action + ' ' + r.owner).toLowerCase().indexOf(q) !== -1),
      )
      .sort(
        (a, b) =>
          Number(b.open) - Number(a.open) ||
          b.score - a.score ||
          (a.due || '9999').localeCompare(b.due || '9999') ||
          a.id.localeCompare(b.id, undefined, { numeric: true }),
      );
  }

  function summary(state, today) {
    const rows = list(state, today);
    const open = rows.filter((r) => r.open);
    const byType = TYPES.map((t) => ({
      type: t,
      open: open.filter((r) => r.type === t).length,
      closed: rows.filter((r) => r.type === t && !r.open).length,
    }));
    const owners = {};
    open.forEach((r) => (owners[r.owner || '(none)'] = (owners[r.owner || '(none)'] || 0) + 1));
    return {
      total: rows.length,
      open: open.length,
      overdue: open.filter((r) => r.overdue).length,
      highOpen: open.filter((r) => r.level === 'High' && (r.type === 'Risk' || r.type === 'Issue')).length,
      noOwner: open.filter((r) => !r.owner).length,
      byType: byType,
      byOwner: Object.keys(owners)
        .map((k) => ({ owner: k, count: owners[k] }))
        .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner)),
      top: open.filter((r) => r.type === 'Risk' || r.type === 'Issue').slice(0, 5),
    };
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+\-@]/.test(t) && isNaN(Number(t)) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(rows) {
    const head = [
      'Ref',
      'Type',
      'Title',
      'Owner',
      'Probability',
      'Impact',
      'Score',
      'Level',
      'Status',
      'Raised',
      'Due',
      'Closed',
      'Overdue',
      'Action',
    ];
    const out = rows.map((r) => [
      r.ref,
      r.type,
      r.title,
      r.owner,
      r.type === 'Risk' || r.type === 'Issue' ? r.probability : '',
      r.type === 'Risk' || r.type === 'Issue' ? r.impact : '',
      r.type === 'Risk' || r.type === 'Issue' ? r.score : '',
      r.type === 'Risk' || r.type === 'Issue' ? r.level : '',
      r.status,
      r.raised,
      r.due,
      r.closed,
      r.overdue ? 'Yes' : 'No',
      r.action,
    ]);
    return (
      '﻿' +
      [head]
        .concat(out)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(state) {
    return JSON.stringify({ app: 'raid-log', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved RAID log.');
    }
    const st = d && d.app === 'raid-log' ? d.state : null;
    if (!st || !Array.isArray(st.items)) throw new Error('That file is not a saved RAID log.');
    let s = create();
    st.items.slice(0, MAX).forEach((i) => {
      try {
        const raised = OT.toIsoDate(i.raised);
        const r = add(s, {
          type: i.type,
          title: i.title,
          owner: i.owner,
          probability: i.probability,
          impact: i.impact,
          due: OT.toIsoDate(i.due),
          action: i.action,
          raised: raised,
        });
        s = r.state;
        const it = s.items[s.items.length - 1];
        if (STATUSES.indexOf(i.status) !== -1) it.status = i.status;
        it.closed = FINISHED.indexOf(it.status) !== -1 ? OT.toIsoDate(i.closed) || it.raised : '';
      } catch (e) {
        /* skip a damaged item */
      }
    });
    return s;
  }

  function sample(today) {
    let s = create();
    const mk = (type, title, owner, p, m, dueIn, action, ago) => {
      s = add(s, {
        type: type,
        title: title,
        owner: owner,
        probability: p,
        impact: m,
        due: dueIn === null ? '' : OT.addDays(today, dueIn),
        action: action,
        raised: OT.addDays(today, -ago),
      }).state;
    };
    mk('Risk', 'Key backend engineer may leave before go-live', 'Priya', 3, 5, 14, 'Cross-train a second engineer', 20);
    mk('Risk', 'Vendor API rate limits not confirmed', 'Ravi', 4, 3, -3, 'Get written limits from the vendor', 15);
    mk('Risk', 'Festival-season holidays shrink the test window', 'Asha', 2, 2, 30, 'Plan testing around the holiday list', 5);
    mk('Assumption', 'Business users are available for UAT in week 8', 'Priya', '', '', 21, 'Confirm with department heads', 12);
    mk('Issue', 'Staging environment is down intermittently', 'Kiran', 5, 3, 2, 'Raise ticket with infra, move to backup server', 2);
    mk('Dependency', 'Payment gateway sandbox from the bank', 'Meera', '', '', -1, 'Escalate to the bank relationship manager', 25);
    s = setStatus(s, 'I1', 'In progress', today);
    return s;
  }

  return {
    TYPES: TYPES,
    STATUSES: STATUSES,
    create: create,
    add: add,
    update: update,
    setStatus: setStatus,
    list: list,
    summary: summary,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
