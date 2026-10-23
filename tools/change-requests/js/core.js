/**
 * Change Request Log - core logic (pure).
 *
 * CR: { id, ref, title, description, requestedBy, raised (ISO), category, priority, costImpact (Rs., may be negative),
 *       daysImpact (calendar days, may be negative), status, decidedBy, decidedOn (ISO or ""), decisionNote }
 * Status flow: Draft -> Submitted -> Approved | Rejected | Deferred;  Deferred -> Submitted | Approved | Rejected;  Approved -> Implemented.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.ChangeCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const CATEGORIES = ['Scope', 'Schedule', 'Cost', 'Quality', 'Resources', 'Other'];
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Deferred', 'Implemented'];
  const NEXT = {
    Draft: ['Submitted'],
    Submitted: ['Approved', 'Rejected', 'Deferred'],
    Deferred: ['Submitted', 'Approved', 'Rejected'],
    Approved: ['Implemented'],
    Rejected: [],
    Implemented: [],
  };
  const DECISIONS = ['Approved', 'Rejected', 'Deferred'];
  const MAX = 1000;
  const r2 = (n) => Math.round(n * 100) / 100;

  const create = () => ({ nextId: 1, items: [] });

  function money(v, what) {
    if (v === '' || v === null || v === undefined) return 0;
    const t = String(v)
      .replace(/(?:₹|rs\.?|inr)/gi, '')
      .replace(/[,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error(what + ' must be a number of rupees (a minus sign is fine for savings).');
    return r2(Number(t));
  }
  function whole(v, what) {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(v);
    if (!Number.isInteger(n) || Math.abs(n) > 3650) throw new Error(what + ' must be a whole number of days (a minus sign is fine).');
    return n;
  }

  /** c: { title, description, requestedBy, raised, category, priority, costImpact, daysImpact }. Returns { state, item }. */
  function add(state, c) {
    const title = norm(c.title);
    if (!title) throw new Error('Give the change a short title.');
    OT.parseIsoDate(c.raised);
    if (CATEGORIES.indexOf(c.category || 'Scope') === -1) throw new Error('Choose a category.');
    if (PRIORITIES.indexOf(c.priority || 'Medium') === -1) throw new Error('Choose a priority.');
    if (state.items.length >= MAX) throw new Error('The log is full (' + MAX + ' changes).');
    const s = copy(state);
    const id = s.nextId++;
    const item = {
      id: id,
      ref: 'CR-' + String(id).padStart(3, '0'),
      title: title.slice(0, 120),
      description: norm(c.description).slice(0, 1000),
      requestedBy: norm(c.requestedBy).slice(0, 60),
      raised: c.raised,
      category: c.category || 'Scope',
      priority: c.priority || 'Medium',
      costImpact: money(c.costImpact, 'Cost impact'),
      daysImpact: whole(c.daysImpact, 'Schedule impact'),
      status: 'Draft',
      decidedBy: '',
      decidedOn: '',
      decisionNote: '',
    };
    s.items.push(item);
    return { state: s, item: item };
  }

  function find(s, id) {
    const it = s.items.find((x) => x.id === id);
    if (!it) throw new Error('No such change request.');
    return it;
  }

  /** Edit details while the request is Draft or Submitted. */
  function update(state, id, patch) {
    const s = copy(state);
    const it = find(s, id);
    if (['Draft', 'Submitted'].indexOf(it.status) === -1) throw new Error(it.ref + ' has been decided and can no longer be edited.');
    if (patch.title !== undefined) {
      if (!norm(patch.title)) throw new Error('Give the change a short title.');
      it.title = norm(patch.title).slice(0, 120);
    }
    if (patch.description !== undefined) it.description = norm(patch.description).slice(0, 1000);
    if (patch.requestedBy !== undefined) it.requestedBy = norm(patch.requestedBy).slice(0, 60);
    if (patch.category !== undefined) {
      if (CATEGORIES.indexOf(patch.category) === -1) throw new Error('Choose a category.');
      it.category = patch.category;
    }
    if (patch.priority !== undefined) {
      if (PRIORITIES.indexOf(patch.priority) === -1) throw new Error('Choose a priority.');
      it.priority = patch.priority;
    }
    if (patch.costImpact !== undefined) it.costImpact = money(patch.costImpact, 'Cost impact');
    if (patch.daysImpact !== undefined) it.daysImpact = whole(patch.daysImpact, 'Schedule impact');
    return s;
  }

  /** Move to a new status. Decisions need who and when; the date cannot be before the request was raised. */
  function setStatus(state, id, status, info) {
    if (STATUSES.indexOf(status) === -1) throw new Error('Choose a status.');
    const s = copy(state);
    const it = find(s, id);
    if (NEXT[it.status].indexOf(status) === -1)
      throw new Error(
        it.ref +
          ' cannot go from ' +
          it.status +
          ' to ' +
          status +
          (NEXT[it.status].length ? ' (allowed: ' + NEXT[it.status].join(', ') + ').' : '.'),
      );
    const i = info || {};
    if (DECISIONS.indexOf(status) !== -1) {
      if (!norm(i.by)) throw new Error('Say who made the decision.');
      OT.parseIsoDate(i.date);
      if (i.date < it.raised) throw new Error('The decision cannot be dated before the request was raised.');
      if (status === 'Rejected' && !norm(i.note)) throw new Error('Give a reason for rejecting.');
      it.decidedBy = norm(i.by).slice(0, 60);
      it.decidedOn = i.date;
      it.decisionNote = norm(i.note).slice(0, 300);
    } else if (status === 'Submitted') {
      it.decidedBy = '';
      it.decidedOn = '';
      it.decisionNote = '';
    }
    it.status = status;
    return s;
  }

  function list(state, filter) {
    const f = Object.assign({ status: '', category: '', priority: '', text: '' }, filter);
    const q = norm(f.text).toLowerCase();
    return state.items
      .filter(
        (r) =>
          (!f.status || r.status === f.status) &&
          (!f.category || r.category === f.category) &&
          (!f.priority || r.priority === f.priority) &&
          (!q || (r.title + ' ' + r.ref + ' ' + r.requestedBy + ' ' + r.description).toLowerCase().indexOf(q) !== -1),
      )
      .map((r) => Object.assign({}, r));
  }

  /** Cost and schedule effect: approved (including implemented), still pending, and against optional baseline budget and end date. */
  function totals(state, baseline) {
    const b = baseline || {};
    const sum = (arr, k) => r2(arr.reduce((a, r) => a + r[k], 0));
    const approved = state.items.filter((r) => r.status === 'Approved' || r.status === 'Implemented');
    const pending = state.items.filter((r) => r.status === 'Submitted' || r.status === 'Deferred');
    const t = {
      count: state.items.length,
      approved: approved.length,
      pending: pending.length,
      rejected: state.items.filter((r) => r.status === 'Rejected').length,
      approvedCost: sum(approved, 'costImpact'),
      approvedDays: sum(approved, 'daysImpact'),
      pendingCost: sum(pending, 'costImpact'),
      pendingDays: sum(pending, 'daysImpact'),
    };
    if (b.budget > 0) {
      t.revisedBudget = r2(b.budget + t.approvedCost);
      t.budgetGrowthPct = Math.round((t.approvedCost / b.budget) * 1000) / 10;
      t.ifPendingApproved = r2(b.budget + t.approvedCost + t.pendingCost);
    }
    if (b.endDate) {
      t.revisedEnd = OT.addDays(b.endDate, t.approvedDays);
      t.ifPendingEnd = OT.addDays(b.endDate, t.approvedDays + t.pendingDays);
    }
    return t;
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(rows) {
    const head = [
      'Ref',
      'Title',
      'Category',
      'Priority',
      'Requested by',
      'Raised',
      'Cost impact (Rs.)',
      'Schedule impact (days)',
      'Status',
      'Decided by',
      'Decided on',
      'Decision note',
      'Description',
    ];
    const out = rows.map((r) => [
      r.ref,
      r.title,
      r.category,
      r.priority,
      r.requestedBy,
      r.raised,
      r.costImpact,
      r.daysImpact,
      r.status,
      r.decidedBy,
      r.decidedOn,
      r.decisionNote,
      r.description,
    ]);
    return (
      '﻿' +
      [head]
        .concat(out)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function sanitize(s) {
    return String(s)
      .replace(/₹/g, 'Rs.')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^ -~\u00a0-ÿ]/g, '?');
  }

  function wrap(font, text, size, width) {
    const out = [];
    String(text)
      .split(/\r?\n/)
      .forEach((para) => {
        let line = '';
        sanitize(para)
          .split(/\s+/)
          .forEach((w) => {
            if (!w) return;
            const t = line ? line + ' ' + w : w;
            if (font.widthOfTextAtSize(t, size) <= width) line = t;
            else {
              if (line) out.push(line);
              line = w;
            }
          });
        out.push(line);
      });
    return out;
  }

  const signed = (n) => (n > 0 ? '+' : n < 0 ? '-' : '') + OT.formatInr(Math.abs(n), 0);

  /** One-page A4 change request form with approval lines. meta: { project, company } */
  async function buildPdf(PDFLib, cr, meta) {
    const md = meta || {};
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle(sanitize('Change request ' + cr.ref));
    pdf.setCreator('PM Pocket Tools');
    const W = 595.28;
    const H = 841.89;
    const M = 42;
    const grey = rgb(0.45, 0.47, 0.52);
    const ink = rgb(0.1, 0.1, 0.12);
    let page = pdf.addPage([W, H]);
    let y = H - M;
    const text = (s, x, size, f, right) => {
      const v = sanitize(s);
      const ff = f || font;
      page.drawText(v, { x: right ? x - ff.widthOfTextAtSize(v, size) : x, y: y, size: size, font: ff, color: ink });
    };
    const need = (h) => {
      if (y < M + 20 + h) {
        page = pdf.addPage([W, H]);
        y = H - M;
      }
    };
    const para = (s, size, f, x, width, lead) => {
      wrap(f || font, s, size, width || W - 2 * M).forEach((l) => {
        need(lead || size + 3);
        text(l, x === undefined ? M : x, size, f);
        y -= lead || size + 3.5;
      });
    };
    if (md.company) {
      text(md.company, M, 10, bold);
      y -= 14;
    }
    text('CHANGE REQUEST', M, 18, bold);
    text(cr.ref, W - M, 14, bold, true);
    y -= 16;
    if (md.project) para('Project: ' + md.project, 10, font, M, W - 2 * M, 14);
    y -= 6;
    const kv = (items) => {
      const cw = (W - 2 * M) / items.length;
      let max = 1;
      items.forEach((it, i) => {
        const x = M + i * cw;
        const keep = y;
        text(it[0], x, 7.5, font);
        y -= 12;
        const lines = wrap(bold, it[1] || '-', 10, cw - 10).slice(0, 2);
        lines.forEach((l) => {
          text(l, x, 10, bold);
          y -= 12;
        });
        max = Math.max(max, lines.length);
        y = keep;
      });
      y -= 16 + max * 12;
    };
    kv([
      ['Title', cr.title],
      ['Requested by', cr.requestedBy],
      ['Date raised', OT.formatDate(cr.raised, 'dmy')],
    ]);
    kv([
      ['Category', cr.category],
      ['Priority', cr.priority],
      ['Status', cr.status],
    ]);
    page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 38, color: rgb(0.93, 0.94, 0.96) });
    y -= 4;
    text('Cost impact', M + 10, 8, font);
    text('Schedule impact', M + 220, 8, font);
    y -= 17;
    text('Rs. ' + signed(cr.costImpact), M + 10, 14, bold);
    text((cr.daysImpact > 0 ? '+' : '') + cr.daysImpact + ' days', M + 220, 14, bold);
    y -= 34;
    text('Description of the change', M, 11, bold);
    y -= 15;
    para(cr.description || '(none given)', 10, font, M, W - 2 * M, 13.5);
    y -= 8;
    if (cr.decidedOn) {
      need(60);
      text('Decision', M, 11, bold);
      y -= 15;
      para(
        cr.status + ' by ' + cr.decidedBy + ' on ' + OT.formatDate(cr.decidedOn, 'dmy') + (cr.decisionNote ? '. ' + cr.decisionNote : ''),
        10,
        font,
        M,
        W - 2 * M,
        13.5,
      );
    }
    need(110);
    y -= 36;
    ['Requested by', 'Project manager', 'Sponsor / approver'].forEach((r, i) => {
      const x = M + i * 175;
      page.drawLine({ start: { x: x, y: y }, end: { x: x + 150, y: y }, thickness: 0.5, color: grey });
      page.drawText(sanitize(r), { x: x, y: y - 11, size: 8, font: font, color: grey });
      page.drawText('Name / date:', { x: x, y: y - 23, size: 8, font: font, color: grey });
    });
    page.drawText('Approve  [   ]      Reject  [   ]      Defer  [   ]', { x: M, y: y - 52, size: 9, font: font, color: ink });
    pdf
      .getPages()
      .forEach((p, i, all) =>
        p.drawText(sanitize(cr.ref + '   Page ' + (i + 1) + ' of ' + all.length), { x: M, y: 22, size: 7.5, font: font, color: grey }),
      );
    return pdf.save();
  }

  function serialize(state, baseline) {
    return JSON.stringify({ app: 'change-requests', version: 1, state: state, baseline: baseline || {} }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved change log.');
    }
    const st = d && d.app === 'change-requests' ? d.state : null;
    if (!st || !Array.isArray(st.items)) throw new Error('That file is not a saved change log.');
    let s = create();
    st.items.slice(0, MAX).forEach((i) => {
      try {
        const r = add(s, {
          title: i.title,
          description: i.description,
          requestedBy: i.requestedBy,
          raised: OT.toIsoDate(i.raised),
          category: i.category,
          priority: i.priority,
          costImpact: i.costImpact,
          daysImpact: i.daysImpact,
        });
        s = r.state;
        const it = s.items[s.items.length - 1];
        if (STATUSES.indexOf(i.status) !== -1) it.status = i.status;
        it.decidedBy = norm(i.decidedBy).slice(0, 60);
        it.decidedOn = OT.toIsoDate(i.decidedOn) || '';
        it.decisionNote = norm(i.decisionNote).slice(0, 300);
      } catch (e) {
        /* skip a damaged change */
      }
    });
    const b = d.baseline || {};
    return { state: s, baseline: { budget: Number(b.budget) > 0 ? Number(b.budget) : 0, endDate: OT.toIsoDate(b.endDate) || '' } };
  }

  function sample(today) {
    let s = create();
    const mk = (title, desc, by, cat, pr, cost, days, ago) =>
      (s = add(s, {
        title: title,
        description: desc,
        requestedBy: by,
        raised: OT.addDays(today, -ago),
        category: cat,
        priority: pr,
        costImpact: cost,
        daysImpact: days,
      }).state);
    mk('Add UPI payments', 'Customers asked for UPI at checkout in addition to cards.', 'Sales head', 'Scope', 'High', '4,50,000', 12, 30);
    mk('Move go-live after festival week', 'Avoid launching during the peak holiday week.', 'Operations', 'Schedule', 'Medium', 0, 9, 20);
    mk(
      'Drop the loyalty module from phase 1',
      'Defer loyalty features to phase 2 to save effort.',
      'Product owner',
      'Scope',
      'Low',
      '-2,00,000',
      -8,
      14,
    );
    mk('Extra performance testing', 'Run a load test for 5,000 concurrent users.', 'QA lead', 'Quality', 'Medium', '1,20,000', 4, 6);
    s = setStatus(s, 1, 'Submitted');
    s = setStatus(s, 1, 'Approved', { by: 'Sponsor', date: OT.addDays(today, -25), note: 'Approved with revised budget.' });
    s = setStatus(s, 2, 'Submitted');
    s = setStatus(s, 3, 'Submitted');
    s = setStatus(s, 3, 'Approved', { by: 'Sponsor', date: OT.addDays(today, -10), note: '' });
    return s;
  }

  return {
    CATEGORIES: CATEGORIES,
    PRIORITIES: PRIORITIES,
    STATUSES: STATUSES,
    NEXT: NEXT,
    create: create,
    add: add,
    update: update,
    setStatus: setStatus,
    list: list,
    totals: totals,
    toCsv: toCsv,
    sanitize: sanitize,
    buildPdf: buildPdf,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
