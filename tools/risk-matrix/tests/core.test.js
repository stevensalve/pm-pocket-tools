'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rm = require('../js/core.js');

test('rating accepts numbers, digits and words', () => {
  assert.equal(rm.rating(3), 3);
  assert.equal(rm.rating('4'), 4);
  assert.equal(rm.rating('Very High'), 5);
  assert.equal(rm.rating('low'), 2);
  assert.equal(rm.rating('Medium'), 3);
  assert.equal(rm.rating(6), null);
  assert.equal(rm.rating(2.5), null);
  assert.equal(rm.rating('0'), null);
  assert.equal(rm.rating(''), null);
  assert.equal(rm.rating(null), null);
  assert.equal(rm.rating('banana'), null);
});

test('level thresholds', () => {
  assert.equal(rm.level(25), 'High');
  assert.equal(rm.level(15), 'High');
  assert.equal(rm.level(14), 'Medium');
  assert.equal(rm.level(8), 'Medium');
  assert.equal(rm.level(7), 'Low');
});

test('rowsToRisks: flexible headers, words, residuals and problems', () => {
  const r = rm.rowsToRisks([
    {
      'Risk Description': 'A',
      Likelihood: 'High',
      Severity: 5,
      'Risk Owner': 'Asha',
      Type: 'Tech',
      Action: 'Fix it',
      State: 'Open',
      'Residual Likelihood': 2,
      'Residual Severity': 2,
    },
    { Risk: 'B', Probability: 9, Impact: 3 },
    { Risk: '', Probability: 3, Impact: 3 },
    { Risk: 'C', Probability: 3, Impact: 3, 'Residual Probability': 'x', 'Residual Impact': 2 },
    { Risk: '', Probability: '', Impact: '' },
    { Risk: 'D', Probability: 1, Impact: 1 },
  ]);
  assert.equal(r.risks.length, 3);
  assert.deepEqual([r.risks[0].probability, r.risks[0].impact, r.risks[0].score, r.risks[0].level], [4, 5, 20, 'High']);
  assert.equal(r.risks[0].owner, 'Asha');
  assert.equal(r.risks[0].category, 'Tech');
  assert.equal(r.risks[0].residualScore, 4);
  assert.equal(r.risks[1].residualScore, null, 'a bad residual is ignored');
  assert.equal(r.problems.length, 3);
  assert.match(r.problems[0], /Row 3: "B" needs a probability and an impact/);
  assert.match(r.problems[1], /Row 4: no risk description/);
  assert.match(r.problems[2], /Row 5: the residual rating for "C"/);
  assert.equal(r.risks[2].n, 3, 'numbering follows accepted risks');
});

test('matrix places risks and drops closed ones', () => {
  const { risks } = rm.rowsToRisks(rm.sampleRows());
  const m = rm.matrix(risks, 'inherent');
  assert.equal(m.grid.length, 5);
  assert.equal(m.grid[0][0].probability, 5);
  assert.equal(m.grid[4][4].probability, 1);
  assert.deepEqual(m.grid[2][4].ids, [1], 'probability 3, impact 5');
  assert.deepEqual(m.grid[1][3].ids, [3], 'probability 4, impact 4');
  assert.equal(m.count, 6, 'one closed risk is left out');
  assert.equal(rm.matrix(risks, 'inherent', true).count, 7);
  const res = rm.matrix(risks, 'residual');
  assert.deepEqual(res.grid[2][4].ids, [], 'moved away from probability 3, impact 5');
  assert.deepEqual(res.grid[3][2].ids, [1, 5], 'residual 2x3 for risks 1 and 5');
  assert.deepEqual(res.grid[1][3].ids, [3], 'no residual rating: stays where it was');
  assert.equal(m.grid[0][4].level, 'High');
  assert.equal(m.grid[4][0].level, 'Low');
});

test('summary', () => {
  const { risks } = rm.rowsToRisks(rm.sampleRows());
  const s = rm.summary(risks, 3);
  assert.equal(s.total, 7);
  assert.equal(s.open, 6);
  assert.equal(s.closed, 1);
  assert.equal(s.high, 2);
  assert.equal(s.top.length, 3);
  assert.equal(s.top[0].name, 'Payment gateway sandbox delayed');
  assert.equal(s.residualCount, 3);
  assert.equal(s.reductionPct, Math.round((1 - (6 + 4 + 6) / (15 + 12 + 12)) * 100));
  assert.equal(s.stillHigh, 0);
  assert.equal(s.noOwner, 1);
  assert.equal(s.noMitigation, 1, 'Payment gateway: high risk with no mitigation');
  assert.equal(s.byCategory[0].key, 'Technical');
  assert.equal(rm.summary([]).average, 0);
  assert.equal(rm.summary([]).reductionPct, null);
});

test('CSV sorted by score and guarded', () => {
  const { risks } = rm.rowsToRisks([
    { Risk: '=bad', Probability: 1, Impact: 1 },
    { Risk: 'Big', Probability: 5, Impact: 5 },
  ]);
  const csv = rm.toCsv(risks).split('\r\n');
  assert.ok(csv[0].startsWith('﻿#,Risk'));
  assert.ok(csv[1].indexOf('Big') !== -1);
  assert.ok(csv[2].indexOf("'=bad") !== -1);
});
