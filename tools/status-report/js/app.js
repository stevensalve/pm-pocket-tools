/* Project Status Report - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');
  const d0 = new Date();
  const todayIso = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
  $('date').value = todayIso;
  const AREAS = [
    ['overall', 'Overall'],
    ['scope', 'Scope'],
    ['schedule', 'Schedule'],
    ['budget', 'Budget'],
  ];
  let parsing = false;

  AREAS.forEach((a) => {
    const set = el('fieldset', { class: 'ragset' }, [el('legend', { text: a[1] })]);
    const wrap = el('div', { class: 'rag' });
    ['G', 'A', 'R'].forEach((c) => {
      const r = el('input', { type: 'radio', name: 'rag-' + a[0], value: c, id: 'rag-' + a[0] + '-' + c });
      if (c === 'G') r.checked = true;
      r.addEventListener('change', render);
      wrap.appendChild(el('label', { class: c, for: 'rag-' + a[0] + '-' + c }, [r, StatusCore.RAG_WORD[c]]));
    });
    set.appendChild(wrap);
    $('rags').appendChild(set);
  });
  const rag = (k) => (document.querySelector('input[name="rag-' + k + '"]:checked') || {}).value || 'G';
  const setRag = (k, v) => ((document.getElementById('rag-' + k + '-' + v) || {}).checked = true);

  function read() {
    const pp = $('plan-pct').value;
    return {
      project: $('project').value.trim(),
      period: $('period').value.trim(),
      preparedBy: $('by').value.trim(),
      date: $('date').value,
      overall: rag('overall'),
      scope: rag('scope'),
      schedule: rag('schedule'),
      budget: rag('budget'),
      percent: Number($('pct').value) || 0,
      plannedPercent: pp === '' ? null : Number(pp),
      plannedEnd: $('plan-end').value,
      forecastEnd: $('fc-end').value,
      summary: $('summary').value.trim(),
      done: StatusCore.parseLines($('done').value),
      next: StatusCore.parseLines($('next').value),
      risks: StatusCore.parseLines($('risks').value),
      asks: StatusCore.parseLines($('asks').value),
    };
  }

  function write(doc) {
    parsing = true;
    $('project').value = doc.project;
    $('period').value = doc.period;
    $('by').value = doc.preparedBy;
    $('date').value = doc.date || todayIso;
    $('pct').value = doc.percent;
    $('plan-pct').value = doc.plannedPercent === null ? '' : doc.plannedPercent;
    $('plan-end').value = doc.plannedEnd;
    $('fc-end').value = doc.forecastEnd;
    $('summary').value = doc.summary;
    ['done', 'next', 'risks', 'asks'].forEach((k) => ($(k).value = doc[k].join('\n')));
    AREAS.forEach((a) => setRag(a[0], doc[a[0]]));
    parsing = false;
  }

  function render() {
    if (parsing) return;
    const doc = read();
    const g = StatusCore.suggest(doc);
    const bits = [];
    if (g.slip !== undefined)
      bits.push(
        g.slip > 0
          ? 'Forecast is ' + g.slip + ' days later than plan.'
          : g.slip < 0
            ? 'Forecast is ' + -g.slip + ' days ahead of plan.'
            : 'Forecast matches plan.',
      );
    if (g.schedule) bits.push('Suggested schedule colour: ' + StatusCore.RAG_WORD[g.schedule] + '.');
    bits.push('Suggested overall colour: ' + StatusCore.RAG_WORD[g.overall] + '.');
    $('suggest').textContent = bits.join(' ');
    const ul = $('problems');
    ul.textContent = '';
    StatusCore.validate(doc).forEach((p) => ul.appendChild(el('li', { text: p })));
    $('preview').textContent = StatusCore.toText(doc);
  }

  $('apply').addEventListener('click', () => {
    const g = StatusCore.suggest(read());
    if (g.schedule) setRag('schedule', g.schedule);
    setRag('overall', StatusCore.suggest(read()).overall);
    render();
  });
  $('demo').addEventListener('click', () => {
    write(StatusCore.sample(todayIso));
    render();
  });
  ['project', 'period', 'by', 'date', 'pct', 'plan-pct', 'plan-end', 'fc-end', 'summary', 'done', 'next', 'risks', 'asks'].forEach((id) =>
    $(id).addEventListener('input', render),
  );
  $('pdf').addEventListener('click', async () => {
    const doc = read();
    const probs = StatusCore.validate(doc);
    if (probs.length) return setStatus($('out-status'), probs.join(' '), 'error');
    try {
      downloadBlob(
        await StatusCore.buildPdf(PDFLib, doc),
        safeFileName('status-' + doc.project + '-' + doc.date) + '.pdf',
        'application/pdf',
      );
      setStatus($('out-status'), 'PDF ready.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  $('copy').addEventListener('click', async () => {
    const ok = await copyText(StatusCore.toText(read()));
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text below and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('save').addEventListener('click', () => {
    const doc = read();
    downloadBlob(StatusCore.serialize(doc), safeFileName('status-' + (doc.project || 'report')) + '.json', 'application/json');
  });
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      write(StatusCore.parse(await readText(f)));
      render();
      setStatus($('out-status'), 'Report opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
