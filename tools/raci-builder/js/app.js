/* RACI Matrix Builder - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, safeFileName } = OT;
  const $ = (id) => document.getElementById(id);
  let model = { people: [], tasks: [] };

  function render() {
    model = RaciCore.parse($('text').value);
    setStatus($('status'), model.errors.slice(0, 5).join(' '), model.errors.length ? 'warn' : '');
    ['problems', 't-raci', 't-load'].forEach((id) => ($(id).textContent = ''));
    $('ok').hidden = true;
    if (!model.tasks.length || !model.people.length) return;
    const probs = RaciCore.check(model, Number($('maxr').value) || 5);
    probs.forEach((p) => $('problems').appendChild(el('li', { text: p.message })));
    $('ok').hidden = probs.length > 0;
    const t = $('t-raci');
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          [el('th', { scope: 'col', text: 'Task' })].concat(model.people.map((p) => el('th', { class: 'p', scope: 'col', text: p }))),
        ),
      ]),
    );
    const body = el('tbody');
    model.tasks.forEach((x) =>
      body.appendChild(
        el(
          'tr',
          {},
          [el('td', { text: x.n + '. ' + x.name })].concat(
            x.cells.map((c) =>
              el('td', {
                class: 'cx ' + (c ? ['A', 'R', 'C', 'I'].filter((l) => c.indexOf(l) !== -1)[0] : ''),
                text: c.split('').join('/'),
              }),
            ),
          ),
        ),
      ),
    );
    t.appendChild(body);
    const lt = $('t-load');
    lt.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Person', 'Responsible', 'Accountable', 'Consulted', 'Informed'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const lb = el('tbody');
    RaciCore.load(model).forEach((p) =>
      lb.appendChild(
        el('tr', {}, [
          el('td', { text: p.person }),
          el('td', { class: 'num', text: String(p.R) }),
          el('td', { class: 'num', text: String(p.A) }),
          el('td', { class: 'num', text: String(p.C) }),
          el('td', { class: 'num', text: String(p.I) }),
        ]),
      ),
    );
    lt.appendChild(lb);
  }

  ['title', 'maxr', 'text'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    $('text').value = RaciCore.sample();
    render();
  });
  const need = () => {
    if (!model.tasks.length) setStatus($('out-status'), 'Add a chart first.', 'error');
    return model.tasks.length > 0;
  };
  $('pdf').addEventListener('click', async () => {
    if (!need()) return;
    try {
      downloadBlob(
        await RaciCore.buildPdf(PDFLib, model, { title: $('title').value.trim() || 'RACI matrix', company: $('company').value.trim() }),
        safeFileName($('title').value || 'raci-matrix') + '.pdf',
        'application/pdf',
      );
      setStatus($('out-status'), 'PDF ready.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  $('csv').addEventListener('click', () => need() && downloadBlob(RaciCore.toCsv(model), 'raci-matrix.csv', 'text/csv;charset=utf-8'));
  $('print').addEventListener('click', () => window.print());
  $('save').addEventListener('click', () =>
    downloadBlob(
      RaciCore.serialize({ title: $('title').value.trim(), text: $('text').value }),
      safeFileName($('title').value || 'raci-matrix') + '.json',
      'application/json',
    ),
  );
  $('open-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const s = RaciCore.parseFile(await readText(f));
      $('title').value = s.title;
      $('text').value = s.text;
      render();
      setStatus($('out-status'), 'Chart opened.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
  });
  render();
})();
