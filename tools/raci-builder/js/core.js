/**
 * RACI Matrix Builder - core logic (pure).
 *
 * Text format: the first line names the people or roles, the other lines are tasks with one cell per person:
 *     Task | Asha | Ravi | Meera
 *     Define scope | A/R | C | I
 *     Build APIs | I | A | R
 * R = Responsible (does the work), A = Accountable (one owner who signs off), C = Consulted, I = Informed.
 * A cell may combine letters ("A/R", "AR", "R,C"). Blank means not involved.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RaciCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const LETTERS = ['A', 'R', 'C', 'I'];
  const MAX_TASKS = 200;
  const MAX_PEOPLE = 20;

  /** Parse the text. Returns { people:[name], tasks:[{ n, name, cells:[ 'RA', 'C', '' ... ] }], errors }. Letters in a cell are stored in A, R, C, I order. */
  function parse(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l, i) => ({ l: l.trim(), i: i + 1 }))
      .filter((x) => x.l && x.l[0] !== '#');
    const errors = [];
    if (!lines.length) return { people: [], tasks: [], errors: errors };
    const head = lines[0].l.split('|').map(norm);
    const people = head.slice(1).filter((p, k, arr) => p || k < arr.length - 1);
    if (!people.length || people.some((p) => !p)) errors.push('The first line must name the people or roles: Task | Asha | Ravi | Meera');
    const seen = new Set();
    people.forEach((p) => {
      if (p && seen.has(p.toLowerCase())) errors.push('"' + p + '" appears twice in the first line.');
      seen.add(p.toLowerCase());
    });
    if (people.length > MAX_PEOPLE) errors.push('Only the first ' + MAX_PEOPLE + ' people are used.');
    const cols = Math.min(people.length, MAX_PEOPLE);
    const tasks = [];
    lines.slice(1).forEach((x) => {
      const p = x.l.split('|').map(norm);
      const at = 'Line ' + x.i + ': ';
      if (!p[0]) return errors.push(at + 'the task has no name.');
      if (tasks.length >= MAX_TASKS) return errors.length < 3 && errors.push('Only the first ' + MAX_TASKS + ' tasks are used.');
      if (p.length - 1 > cols) errors.push(at + 'more cells than people; the extra cells were ignored.');
      const cells = [];
      for (let k = 0; k < cols; k++) {
        const raw = (p[k + 1] || '').toUpperCase();
        const bad = raw.replace(/[RACI\s/,&+-]/g, '');
        if (bad) errors.push(at + 'cell for ' + people[k] + ' has "' + bad[0] + '"; use only R, A, C or I.');
        cells.push(LETTERS.filter((c) => raw.indexOf(c) !== -1).join(''));
      }
      tasks.push({ n: tasks.length + 1, name: p[0].slice(0, 100), cells: cells });
    });
    return { people: people.slice(0, cols), tasks: tasks, errors: errors };
  }

  /** Back to text, with cells shown like A/R. */
  function toText(m) {
    const show = (c) => c.split('').join('/');
    return [['Task'].concat(m.people).join(' | ')].concat(m.tasks.map((t) => [t.name].concat(t.cells.map(show)).join(' | '))).join('\n');
  }

  /**
   * Problems: tasks with no A or more than one A, tasks with no R, people with no part at all,
   * people who are Responsible for more than `maxR` tasks. Each: { kind, task?, person?, message }
   */
  function check(m, maxR) {
    const limit = maxR === undefined ? 5 : maxR;
    const out = [];
    m.tasks.forEach((t) => {
      const a = t.cells.filter((c) => c.indexOf('A') !== -1).length;
      const r = t.cells.filter((c) => c.indexOf('R') !== -1).length;
      if (a === 0) out.push({ kind: 'no-accountable', task: t.n, message: 'Task ' + t.n + ' "' + t.name + '" has nobody Accountable.' });
      if (a > 1)
        out.push({
          kind: 'many-accountable',
          task: t.n,
          message: 'Task ' + t.n + ' "' + t.name + '" has ' + a + ' people Accountable; there should be exactly one.',
        });
      if (r === 0)
        out.push({
          kind: 'no-responsible',
          task: t.n,
          message: 'Task ' + t.n + ' "' + t.name + '" has nobody Responsible for doing the work.',
        });
    });
    load(m).forEach((p) => {
      if (m.tasks.length && p.R + p.A + p.C + p.I === 0)
        out.push({ kind: 'idle', person: p.person, message: p.person + ' has no part in any task.' });
      if (p.R > limit)
        out.push({
          kind: 'overloaded',
          person: p.person,
          message: p.person + ' is Responsible for ' + p.R + ' tasks (more than ' + limit + ').',
        });
    });
    return out;
  }

  /** Counts of each letter per person. */
  function load(m) {
    return m.people.map((person, k) => {
      const o = { person: person, R: 0, A: 0, C: 0, I: 0 };
      m.tasks.forEach((t) => LETTERS.forEach((c) => t.cells[k].indexOf(c) !== -1 && o[c]++));
      return o;
    });
  }

  const cell = (v) => {
    const t = String(v === null || v === undefined ? '' : v);
    const safe = /^[=+@]/.test(t) || /^-[^0-9]/.test(t) ? "'" + t : t;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  function toCsv(m) {
    const show = (c) => c.split('').join('/');
    const rows = [['Task'].concat(m.people)].concat(m.tasks.map((t) => [t.name].concat(t.cells.map(show))));
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }

  function sanitize(s) {
    return String(s)
      .replace(/₹/g, 'Rs.')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^ -~\u00a0-ÿ]/g, '?');
  }

  /** Landscape A4 chart with a key; long charts continue on more pages. meta: { title, company } */
  async function buildPdf(PDFLib, m, meta) {
    const md = meta || {};
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle(sanitize(md.title || 'RACI matrix'));
    pdf.setCreator('PM Pocket Tools');
    const W = 841.89;
    const H = 595.28;
    const M = 36;
    const grey = rgb(0.45, 0.47, 0.52);
    const ink = rgb(0.1, 0.1, 0.12);
    const fill = { R: rgb(0.74, 0.86, 0.98), A: rgb(0.99, 0.8, 0.8), C: rgb(0.99, 0.93, 0.7), I: rgb(0.86, 0.95, 0.88) };
    const nameW = Math.min(260, (W - 2 * M) * 0.4);
    const colW = Math.max(40, Math.min(90, (W - 2 * M - nameW) / Math.max(1, m.people.length)));
    const rowH = 22;
    let page;
    let y;
    const header = () => {
      page = pdf.addPage([W, H]);
      y = H - M;
      if (md.company) {
        page.drawText(sanitize(md.company), { x: M, y: y, size: 9, font: bold, color: grey });
        y -= 14;
      }
      page.drawText(sanitize(md.title || 'RACI matrix'), { x: M, y: y - 6, size: 17, font: bold, color: ink });
      y -= 34;
      page.drawRectangle({ x: M, y: y - 6, width: nameW + colW * m.people.length, height: 24, color: rgb(0.93, 0.94, 0.96) });
      page.drawText('Task', { x: M + 6, y: y + 2, size: 9, font: bold, color: ink });
      m.people.forEach((p, k) => {
        const lines = [];
        let cur = '';
        sanitize(p)
          .split(' ')
          .forEach((w) => {
            const t = cur ? cur + ' ' + w : w;
            if (bold.widthOfTextAtSize(t, 8.5) <= colW - 6) cur = t;
            else {
              if (cur) lines.push(cur);
              cur = w;
            }
          });
        lines.push(cur);
        lines
          .slice(0, 2)
          .forEach((l, i) => page.drawText(l, { x: M + nameW + k * colW + 4, y: y + 8 - i * 9, size: 8.5, font: bold, color: ink }));
      });
      y -= 30;
    };
    header();
    m.tasks.forEach((t) => {
      if (y < M + 50) header();
      page.drawLine({
        start: { x: M, y: y - 6 },
        end: { x: M + nameW + colW * m.people.length, y: y - 6 },
        thickness: 0.3,
        color: rgb(0.85, 0.86, 0.88),
      });
      let label = sanitize(t.n + '. ' + t.name);
      while (label.length > 3 && font.widthOfTextAtSize(label, 9.5) > nameW - 10) label = label.slice(0, -2);
      page.drawText(label.length < sanitize(t.n + '. ' + t.name).length ? label.trimEnd() + '...' : label, {
        x: M + 6,
        y: y,
        size: 9.5,
        font: font,
        color: ink,
      });
      t.cells.forEach((c, k) => {
        if (!c) return;
        const x = M + nameW + k * colW;
        page.drawRectangle({
          x: x + 3,
          y: y - 5,
          width: colW - 6,
          height: rowH - 6,
          color: fill[c.indexOf('A') !== -1 ? 'A' : c.indexOf('R') !== -1 ? 'R' : c.indexOf('C') !== -1 ? 'C' : 'I'],
        });
        const txt = c.split('').join('/');
        page.drawText(txt, { x: x + colW / 2 - bold.widthOfTextAtSize(txt, 10) / 2, y: y, size: 10, font: bold, color: ink });
      });
      y -= rowH;
    });
    const key = [
      'R = Responsible: does the work',
      'A = Accountable: one owner, signs off',
      'C = Consulted: two-way input before',
      'I = Informed: told afterwards',
    ];
    if (y < M + 40) header();
    y -= 14;
    key.forEach((k, i) => page.drawText(sanitize(k), { x: M + i * 190, y: y, size: 8, font: font, color: grey }));
    pdf
      .getPages()
      .forEach((p, i, all) =>
        p.drawText('Page ' + (i + 1) + ' of ' + all.length, { x: W - M - 50, y: 18, size: 7.5, font: font, color: grey }),
      );
    return pdf.save();
  }

  function serialize(state) {
    return JSON.stringify({ app: 'raci-builder', version: 1, state: state }, null, 2);
  }

  function parseFile(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved RACI chart.');
    }
    const s = d && d.app === 'raci-builder' ? d.state : null;
    if (!s || typeof s.text !== 'string') throw new Error('That file is not a saved RACI chart.');
    return { title: norm(s.title).slice(0, 80), text: s.text.slice(0, 100000) };
  }

  function sample() {
    return [
      'Task | Asha (PM) | Ravi (Tech lead) | Meera (Design) | Kiran (QA) | Sponsor',
      'Define scope and goals | R | C | C | I | A',
      'Create project plan | A/R | C | I | I | I',
      'Design screens | A | I | R | C | I',
      'Build backend | I | A/R | I | C | ',
      'Test and fix defects | I | R | I | A/R | ',
      'Business sign-off | R | I | I | I | A',
      'Go-live | A | R | I | R | C',
    ].join('\n');
  }

  return {
    parse: parse,
    toText: toText,
    check: check,
    load: load,
    toCsv: toCsv,
    sanitize: sanitize,
    buildPdf: buildPdf,
    serialize: serialize,
    parseFile: parseFile,
    sample: sample,
  };
});
