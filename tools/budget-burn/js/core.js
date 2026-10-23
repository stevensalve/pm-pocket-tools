/**
 * Budget Burn & Forecast - core logic (pure; the as-of date is always passed in).
 *
 * Entry line: date | amount | category | note        (amount may be negative for a refund; rupee signs and commas are fine)
 * Spend is split into "paid" entries and "committed" entries (orders placed, not yet paid).
 * Forecast at completion = paid + committed + (burn rate x days still to run).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.BurnCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const DAY = 86400000;
  const MAX_ENTRIES = 5000;
  const days = (a, b) => Math.round((OT.parseIsoDate(b) - OT.parseIsoDate(a)) / DAY);
  const r2 = (n) => Math.round(n * 100) / 100;

  function amount(text) {
    const t = String(text === null || text === undefined ? '' : text)
      .replace(/(?:₹|rs\.?|inr)/gi, '')
      .replace(/[,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    return Number(t);
  }

  /** Parse entry lines. Returns { entries:[{date, amount, category, note}], errors }. */
  function parseEntries(text, label) {
    const entries = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const p = line.split('|').map(norm);
        const at = label + ' line ' + (i + 1) + ': ';
        const d = OT.toIsoDate(p[0]);
        if (!d) return errors.push(at + '"' + p[0] + '" is not a date.');
        const a = amount(p[1]);
        if (a === null) return errors.push(at + '"' + (p[1] || '') + '" is not an amount.');
        if (entries.length >= MAX_ENTRIES) return errors.push('Only the first ' + MAX_ENTRIES + ' entries are used.');
        entries.push({ date: d, amount: r2(a), category: (p[2] || 'Uncategorised').slice(0, 40), note: (p[3] || '').slice(0, 120) });
      });
    return { entries: entries, errors: errors };
  }

  /**
   * summary(cfg, paid, committed, asOf): cfg = { budget, start, end, basis: 'overall' | 'recent' }
   * Returns money figures, time figures, burn rates, forecast, run-out date and a verdict.
   */
  function summary(cfg, paid, committed, asOf) {
    OT.parseIsoDate(asOf);
    OT.parseIsoDate(cfg.start);
    OT.parseIsoDate(cfg.end);
    if (!(cfg.budget > 0)) throw new Error('Enter the total budget.');
    if (cfg.end < cfg.start) throw new Error('The end date is before the start date.');
    const total = days(cfg.start, cfg.end) + 1;
    const elapsed = Math.max(0, Math.min(total, days(cfg.start, asOf) + 1));
    const remainingDays = total - elapsed;
    const upto = paid.filter((e) => e.date <= asOf);
    const later = paid.length - upto.length;
    const spent = r2(upto.reduce((a, e) => a + e.amount, 0));
    const commit = r2(committed.reduce((a, e) => a + e.amount, 0));
    const windowStart = OT.addDays(asOf, -29);
    const recentSpend = upto.filter((e) => e.date >= windowStart).reduce((a, e) => a + e.amount, 0);
    const recentDays = Math.max(1, Math.min(30, elapsed));
    const dailyOverall = elapsed > 0 ? spent / elapsed : 0;
    const dailyRecent = elapsed > 0 ? recentSpend / recentDays : 0;
    const daily = cfg.basis === 'recent' ? dailyRecent : dailyOverall;
    const free = r2(cfg.budget - spent - commit);
    const forecast = r2(spent + commit + Math.max(0, daily) * remainingDays);
    let runOut = null;
    let runOutStatus = 'none';
    if (free <= 0) runOutStatus = 'already';
    else if (daily > 0) {
      runOut = OT.addDays(asOf, Math.ceil(free / daily));
      runOutStatus = runOut > cfg.end ? 'after-end' : 'before-end';
    }
    const plannedPct = (elapsed / total) * 100;
    const spentPct = (spent / cfg.budget) * 100;
    const variance = r2(forecast - cfg.budget);
    const verdict = free < 0 ? 'over' : variance > cfg.budget * 0.05 ? 'at-risk' : variance > 0 ? 'watch' : 'on-track';
    return {
      budget: cfg.budget,
      spent: spent,
      committed: commit,
      remaining: free,
      spentPct: Math.round(spentPct * 10) / 10,
      committedPct: Math.round((commit / cfg.budget) * 1000) / 10,
      elapsedDays: elapsed,
      totalDays: total,
      remainingDays: remainingDays,
      timePct: Math.round(plannedPct * 10) / 10,
      paceGap: Math.round((spentPct - plannedPct) * 10) / 10,
      dailyOverall: r2(dailyOverall),
      dailyRecent: r2(dailyRecent),
      monthlyBurn: r2(daily * 30.4375),
      forecast: forecast,
      variance: variance,
      runOut: runOut,
      runOutStatus: runOutStatus,
      verdict: verdict,
      ignoredFuture: later,
    };
  }

  /** Month-by-month spend with cumulative spend and a straight-line plan. */
  function monthly(cfg, paid, asOf) {
    const total = days(cfg.start, cfg.end) + 1;
    const months = [];
    let y = Number(cfg.start.slice(0, 4));
    let m = Number(cfg.start.slice(5, 7));
    const endKey = cfg.end.slice(0, 7);
    for (let guard = 0; guard < 120; guard++) {
      const key = y + '-' + String(m).padStart(2, '0');
      months.push(key);
      if (key >= endKey) break;
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
    let cum = 0;
    return months.map((key) => {
      const spend = r2(paid.filter((e) => e.date.slice(0, 7) === key && e.date <= asOf).reduce((a, e) => a + e.amount, 0));
      cum = r2(cum + spend);
      const last = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
      const monthEnd = key + '-' + String(last).padStart(2, '0');
      const through = Math.max(0, Math.min(total, days(cfg.start, monthEnd < cfg.end ? monthEnd : cfg.end) + 1));
      return {
        month: key,
        spend: spend,
        cumulative: cum,
        plannedCumulative: r2((cfg.budget * through) / total),
        future: key + '-01' > asOf,
      };
    });
  }

  function byCategory(paid, committed, asOf) {
    const m = {};
    paid
      .filter((e) => e.date <= asOf)
      .forEach((e) => ((m[e.category] = m[e.category] || { category: e.category, paid: 0, committed: 0 }).paid += e.amount));
    committed.forEach((e) => ((m[e.category] = m[e.category] || { category: e.category, paid: 0, committed: 0 }).committed += e.amount));
    return Object.keys(m)
      .map((k) => ({ category: k, paid: r2(m[k].paid), committed: r2(m[k].committed), total: r2(m[k].paid + m[k].committed) }))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(cfg, paid, committed, asOf) {
    const head = ['Month', 'Spend', 'Cumulative', 'Planned cumulative'];
    const rows = monthly(cfg, paid, asOf).map((r) => [r.month, r.spend, r.cumulative, r.plannedCumulative]);
    const cats = [[], ['Category', 'Paid', 'Committed', 'Total']].concat(
      byCategory(paid, committed, asOf).map((c) => [c.category, c.paid, c.committed, c.total]),
    );
    return (
      '﻿' +
      [head]
        .concat(rows, cats)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function serialize(state) {
    return JSON.stringify({ app: 'budget-burn', version: 1, state: state }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved budget.');
    }
    const s = d && d.app === 'budget-burn' ? d.state : null;
    if (!s || typeof s.paid !== 'string' || typeof s.committed !== 'string') throw new Error('That file is not a saved budget.');
    return {
      name: norm(s.name).slice(0, 80),
      budget: Number(s.budget) > 0 ? Number(s.budget) : 0,
      start: OT.toIsoDate(s.start) || '',
      end: OT.toIsoDate(s.end) || '',
      basis: s.basis === 'recent' ? 'recent' : 'overall',
      paid: s.paid.slice(0, 300000),
      committed: s.committed.slice(0, 300000),
    };
  }

  function sample(today) {
    const start = OT.addDays(today, -75);
    const at = (n) => OT.addDays(start, n);
    return {
      name: 'Customer portal',
      budget: 5000000,
      start: start,
      end: OT.addDays(today, 105),
      basis: 'overall',
      paid: [
        at(3) + ' | 4,50,000 | Vendor licences | Annual licence',
        at(10) + ' | 3,20,000 | People | Contractor, month 1',
        at(25) + ' | 3,20,000 | People | Contractor, month 2',
        at(33) + ' | 1,75,000 | Cloud | Setup and first quarter',
        at(48) + ' | 3,20,000 | People | Contractor, month 3',
        at(60) + ' | 2,10,000 | Training | Workshops',
        at(70) + ' | 3,20,000 | People | Contractor, month 4',
      ].join('\n'),
      committed: [
        OT.addDays(today, 10) + ' | 6,00,000 | Vendor licences | Integration PO',
        OT.addDays(today, 20) + ' | 2,50,000 | Testing | UAT partner PO',
      ].join('\n'),
    };
  }

  return {
    amount: amount,
    parseEntries: parseEntries,
    summary: summary,
    monthly: monthly,
    byCategory: byCategory,
    toCsv: toCsv,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
