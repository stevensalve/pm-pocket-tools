/**
 * Risk Heat Map - core logic (pure).
 *
 * Works on plain rows (an array of objects keyed by column header), so the spreadsheet library is only used in app.js.
 * Columns (names are matched loosely): Risk, Probability, Impact, Owner, Category, Mitigation, Status,
 * and optionally Residual probability, Residual impact (the rating after mitigation).
 * Ratings are 1-5, or words: Very low, Low, Medium, High, Very high.
 * Score = probability x impact. 15 or more is High, 8 to 14 Medium, below 8 Low.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RiskMatrixCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const key = (s) =>
    norm(s)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const MAX = 2000;
  const WORDS = {
    verylow: 1,
    rare: 1,
    low: 2,
    unlikely: 2,
    medium: 3,
    moderate: 3,
    possible: 3,
    high: 4,
    likely: 4,
    veryhigh: 5,
    certain: 5,
    extreme: 5,
    critical: 5,
    minor: 2,
    major: 4,
    severe: 5,
    negligible: 1,
  };
  const ALIASES = {
    name: ['risk', 'riskdescription', 'description', 'title', 'name', 'item'],
    prob: ['probability', 'likelihood', 'prob', 'p'],
    impact: ['impact', 'severity', 'consequence', 'i'],
    rprob: ['residualprobability', 'residuallikelihood', 'residualp', 'postmitigationprobability', 'targetprobability'],
    rimpact: ['residualimpact', 'residualseverity', 'residuali', 'postmitigationimpact', 'targetimpact'],
    owner: ['owner', 'riskowner', 'assignedto', 'responsible'],
    category: ['category', 'type', 'area', 'theme'],
    mitigation: ['mitigation', 'response', 'action', 'mitigationplan', 'controls'],
    status: ['status', 'state'],
  };

  const level = (score) => (score >= 15 ? 'High' : score >= 8 ? 'Medium' : 'Low');

  /** Convert a cell to 1-5, or null. */
  function rating(v) {
    if (v === null || v === undefined || norm(v) === '') return null;
    if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
    const t = norm(v);
    if (/^[1-5]$/.test(t)) return Number(t);
    const w = WORDS[key(t)];
    return w || null;
  }

  function pick(row, names) {
    const map = {};
    Object.keys(row).forEach((k) => (map[key(k)] = row[k]));
    for (let i = 0; i < names.length; i++) if (map[names[i]] !== undefined && norm(map[names[i]]) !== '') return map[names[i]];
    return '';
  }

  /** rows -> { risks, problems }. Rows without a probability and impact are listed in problems. */
  function rowsToRisks(rows) {
    const risks = [];
    const problems = [];
    (rows || []).slice(0, MAX).forEach((row, i) => {
      const name = norm(pick(row, ALIASES.name));
      const empty = Object.keys(row).every((k) => norm(row[k]) === '');
      if (empty) return;
      const at = 'Row ' + (i + 2) + ': ';
      if (!name) return problems.push(at + 'no risk description.');
      const p = rating(pick(row, ALIASES.prob));
      const m = rating(pick(row, ALIASES.impact));
      if (!p || !m)
        return problems.push(at + '"' + name.slice(0, 40) + '" needs a probability and an impact from 1 to 5 (or Very low to Very high).');
      const rpRaw = pick(row, ALIASES.rprob);
      const riRaw = pick(row, ALIASES.rimpact);
      let rp = rating(rpRaw);
      let ri = rating(riRaw);
      if ((norm(rpRaw) && !rp) || (norm(riRaw) && !ri))
        problems.push(at + 'the residual rating for "' + name.slice(0, 40) + '" is not 1 to 5; it was ignored.');
      if (!rp || !ri) {
        rp = null;
        ri = null;
      }
      risks.push({
        n: risks.length + 1,
        name: name.slice(0, 140),
        probability: p,
        impact: m,
        score: p * m,
        level: level(p * m),
        residualProbability: rp,
        residualImpact: ri,
        residualScore: rp ? rp * ri : null,
        owner: norm(pick(row, ALIASES.owner)).slice(0, 60),
        category: norm(pick(row, ALIASES.category)).slice(0, 40),
        mitigation: norm(pick(row, ALIASES.mitigation)).slice(0, 300),
        status: norm(pick(row, ALIASES.status)).slice(0, 30),
      });
    });
    return { risks: risks, problems: problems };
  }

  const isClosed = (r) => /^(closed|done|resolved|retired|accepted)$/i.test(r.status);

  /**
   * 5x5 grid. which = 'inherent' or 'residual'. cells[impact-1][probability-1] = { ids:[n], level }, rows listed from probability 5 (top) to 1.
   * Closed risks are left out unless includeClosed.
   */
  function matrix(risks, which, includeClosed) {
    const grid = [];
    for (let p = 5; p >= 1; p--) {
      const row = [];
      for (let i = 1; i <= 5; i++) row.push({ probability: p, impact: i, score: p * i, level: level(p * i), ids: [] });
      grid.push(row);
    }
    let used = 0;
    risks.forEach((r) => {
      if (!includeClosed && isClosed(r)) return;
      const p = which === 'residual' ? r.residualProbability || r.probability : r.probability;
      const i = which === 'residual' ? r.residualImpact || r.impact : r.impact;
      grid[5 - p][i - 1].ids.push(r.n);
      used++;
    });
    return { grid: grid, count: used };
  }

  function summary(risks, topN) {
    const open = risks.filter((r) => !isClosed(r));
    const by = (arr, k) => {
      const m = {};
      arr.forEach((r) => (m[r[k] || '(none)'] = (m[r[k] || '(none)'] || 0) + 1));
      return Object.keys(m)
        .map((x) => ({ key: x, count: m[x] }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    };
    const withRes = open.filter((r) => r.residualScore !== null);
    const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);
    return {
      total: risks.length,
      open: open.length,
      closed: risks.length - open.length,
      high: open.filter((r) => r.level === 'High').length,
      medium: open.filter((r) => r.level === 'Medium').length,
      low: open.filter((r) => r.level === 'Low').length,
      average: open.length ? Math.round((sum(open, (r) => r.score) / open.length) * 10) / 10 : 0,
      residualCount: withRes.length,
      reductionPct:
        withRes.length && sum(withRes, (r) => r.score) > 0
          ? Math.round((1 - sum(withRes, (r) => r.residualScore) / sum(withRes, (r) => r.score)) * 100)
          : null,
      stillHigh: withRes.filter((r) => level(r.residualScore) === 'High').length,
      noOwner: open.filter((r) => !r.owner).length,
      noMitigation: open.filter((r) => !r.mitigation && r.level !== 'Low').length,
      top: open
        .slice()
        .sort((a, b) => b.score - a.score || a.n - b.n)
        .slice(0, topN || 5),
      byCategory: by(open, 'category'),
      byOwner: by(open, 'owner'),
    };
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(risks) {
    const head = [
      '#',
      'Risk',
      'Category',
      'Owner',
      'Status',
      'Probability',
      'Impact',
      'Score',
      'Level',
      'Residual probability',
      'Residual impact',
      'Residual score',
      'Mitigation',
    ];
    const rows = risks
      .slice()
      .sort((a, b) => b.score - a.score || a.n - b.n)
      .map((r) => [
        r.n,
        r.name,
        r.category,
        r.owner,
        r.status,
        r.probability,
        r.impact,
        r.score,
        r.level,
        r.residualProbability === null ? '' : r.residualProbability,
        r.residualImpact === null ? '' : r.residualImpact,
        r.residualScore === null ? '' : r.residualScore,
        r.mitigation,
      ]);
    return (
      '﻿' +
      [head]
        .concat(rows)
        .map((r) => r.map(cell).join(','))
        .join('\r\n')
    );
  }

  function sampleRows() {
    return [
      {
        Risk: 'Key engineer leaves before go-live',
        Probability: 3,
        Impact: 5,
        Owner: 'Priya',
        Category: 'People',
        Mitigation: 'Cross-train a second engineer',
        Status: 'Open',
        'Residual Probability': 2,
        'Residual Impact': 3,
      },
      {
        Risk: 'Vendor API rate limits unknown',
        Probability: 'High',
        Impact: 'Medium',
        Owner: 'Ravi',
        Category: 'Technical',
        Mitigation: 'Get limits in writing',
        Status: 'Open',
        'Residual Probability': 2,
        'Residual Impact': 2,
      },
      {
        Risk: 'Payment gateway sandbox delayed',
        Probability: 4,
        Impact: 4,
        Owner: 'Meera',
        Category: 'Vendor',
        Mitigation: '',
        Status: 'Open',
      },
      {
        Risk: 'Festival holidays shrink test window',
        Probability: 'Low',
        Impact: 'Low',
        Owner: 'Asha',
        Category: 'Schedule',
        Mitigation: 'Plan around holiday list',
        Status: 'Open',
      },
      {
        Risk: 'Data migration quality issues',
        Probability: 3,
        Impact: 4,
        Owner: '',
        Category: 'Technical',
        Mitigation: 'Trial migration in staging',
        Status: 'Open',
        'Residual Probability': 2,
        'Residual Impact': 3,
      },
      {
        Risk: 'Budget approval delayed',
        Probability: 2,
        Impact: 3,
        Owner: 'Priya',
        Category: 'Commercial',
        Mitigation: '',
        Status: 'Closed',
      },
      {
        Risk: 'Security audit finds gaps late',
        Probability: 2,
        Impact: 5,
        Owner: 'Kiran',
        Category: 'Security',
        Mitigation: 'Early pre-audit review',
        Status: 'Open',
      },
    ];
  }

  return { rating: rating, level: level, rowsToRisks: rowsToRisks, matrix: matrix, summary: summary, toCsv: toCsv, sampleRows: sampleRows };
});
