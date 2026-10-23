/* Risk Heat Map - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readArrayBuffer, el } = OT;
  const $ = (id) => document.getElementById(id);
  let risks = [];

  function drawMatrix(tbl, m) {
    tbl.textContent = '';
    const head = el(
      'tr',
      {},
      [el('th', { text: 'P \\ I' })].concat([1, 2, 3, 4, 5].map((i) => el('th', { scope: 'col', text: String(i) }))),
    );
    tbl.appendChild(el('thead', {}, [head]));
    const body = el('tbody');
    m.grid.forEach((row) =>
      body.appendChild(
        el(
          'tr',
          {},
          [el('th', { scope: 'row', text: String(row[0].probability) })].concat(
            row.map((c) =>
              el('td', {
                class: c.level,
                title: 'Probability ' + c.probability + ' x impact ' + c.impact + ' = ' + c.score,
                text: c.ids.join(', '),
              }),
            ),
          ),
        ),
      ),
    );
    tbl.appendChild(body);
  }

  function show(rows, name) {
    const r = RiskMatrixCore.rowsToRisks(rows);
    risks = r.risks;
    ['stats', 'narrative', 't-list'].forEach((id) => ($(id).textContent = ''));
    if (!risks.length) {
      $('t-inh').textContent = '';
      $('res-box').hidden = true;
      return setStatus($('status'), 'No usable risks found in ' + name + '. ' + r.problems.slice(0, 3).join(' '), 'error');
    }
    setStatus(
      $('status'),
      name +
        ': ' +
        risks.length +
        ' risks.' +
        (r.problems.length
          ? ' ' + r.problems.slice(0, 4).join(' ') + (r.problems.length > 4 ? ' (and ' + (r.problems.length - 4) + ' more)' : '')
          : ''),
      r.problems.length ? 'warn' : 'ok',
    );
    const s = RiskMatrixCore.summary(risks, 5);
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    [
      stat('Open risks', s.open),
      stat('High', s.high, s.high > 0),
      stat('Medium', s.medium),
      stat('Low', s.low),
      stat('Average score', s.average),
      stat('No owner', s.noOwner, s.noOwner > 0),
      stat('High/Medium, no mitigation', s.noMitigation, s.noMitigation > 0),
    ].forEach((x) => $('stats').appendChild(x));
    drawMatrix($('t-inh'), RiskMatrixCore.matrix(risks, 'inherent'));
    $('res-box').hidden = !s.residualCount;
    if (s.residualCount) drawMatrix($('t-res'), RiskMatrixCore.matrix(risks, 'residual'));
    const t = [];
    if (s.residualCount)
      t.push(
        'Mitigation is expected to cut the total score of ' +
          s.residualCount +
          ' risks by ' +
          s.reductionPct +
          '%; ' +
          s.stillHigh +
          ' stay High.',
      );
    if (s.byCategory.length) t.push('Open risks by category: ' + s.byCategory.map((x) => x.key + ' ' + x.count).join(', ') + '.');
    $('narrative').textContent = t.join(' ');
    const tb = $('t-list');
    tb.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['#', 'Risk', 'P', 'I', 'Score', 'Residual', 'Owner', 'Status', 'Mitigation'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const body = el('tbody');
    risks
      .slice()
      .sort((a, b) => b.score - a.score || a.n - b.n)
      .forEach((x) =>
        body.appendChild(
          el('tr', {}, [
            el('td', { text: String(x.n) }),
            el('td', { text: x.name }),
            el('td', { text: String(x.probability) }),
            el('td', { text: String(x.impact) }),
            el('td', {}, [el('span', { class: 'pill ' + x.level, text: x.score + ' ' + x.level })]),
            el('td', { text: x.residualScore === null ? '' : String(x.residualScore) }),
            el('td', { text: x.owner }),
            el('td', { text: x.status }),
            el('td', { text: x.mitigation }),
          ]),
        ),
      );
    tb.appendChild(body);
  }

  async function load(file) {
    try {
      const wb = XLSX.read(await readArrayBuffer(file), { type: 'array', cellDates: false });
      show(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true, blankrows: false }), file.name);
    } catch (e) {
      setStatus($('status'), 'Could not read that file.', 'error');
    }
  }

  OT.bindDropzone($('drop'), $('file'), (files) => files[0] && load(files[0]));
  $('demo').addEventListener('click', () => show(RiskMatrixCore.sampleRows(), 'Sample'));
  $('csv').addEventListener('click', () =>
    risks.length
      ? downloadBlob(RiskMatrixCore.toCsv(risks), 'risk-register.csv', 'text/csv;charset=utf-8')
      : setStatus($('out-status'), 'Load some risks first.', 'error'),
  );
  $('print').addEventListener('click', () => window.print());
})();
