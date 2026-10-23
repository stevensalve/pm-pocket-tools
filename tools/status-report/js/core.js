/**
 * Project Status Report - core logic (pure).
 *
 * Doc: { project, period, preparedBy, date (ISO), overall, scope, schedule, budget  ('G'|'A'|'R'),
 *        percent (0-100), plannedPercent (0-100 or null), plannedEnd, forecastEnd (ISO or ""),
 *        summary, done[], next[], risks[], asks[] }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./common.js'));
  } else {
    root.StatusCore = factory(root.OT);
  }
})(typeof self !== 'undefined' ? self : this, function (OT) {
  'use strict';

  const norm = (s) =>
    String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  const RAG = ['G', 'A', 'R'];
  const RAG_WORD = { G: 'Green', A: 'Amber', R: 'Red' };
  const MAX_LINES = 12;
  const DAY = 86400000;

  const create = () => ({
    project: '',
    period: '',
    preparedBy: '',
    date: '',
    overall: 'G',
    scope: 'G',
    schedule: 'G',
    budget: 'G',
    percent: 0,
    plannedPercent: null,
    plannedEnd: '',
    forecastEnd: '',
    summary: '',
    done: [],
    next: [],
    risks: [],
    asks: [],
  });

  /** One item per line; leading bullets and numbers removed; blank lines skipped. */
  function parseLines(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((l) => norm(l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')))
      .filter(Boolean)
      .slice(0, MAX_LINES)
      .map((l) => l.slice(0, 200));
  }

  /** Worst of the given RAG values. */
  function worst(list) {
    let w = 0;
    list.forEach((r) => (w = Math.max(w, RAG.indexOf(r))));
    return RAG[w];
  }

  /** Days the forecast finish is later than the plan (negative = early). */
  function slipDays(plannedEnd, forecastEnd) {
    return Math.round((OT.parseIsoDate(forecastEnd) - OT.parseIsoDate(plannedEnd)) / DAY);
  }

  /** Suggested RAG for schedule from slip in days: up to 0 green, up to 10 amber, beyond red. */
  function ragFromSlip(days) {
    return days <= 0 ? 'G' : days <= 10 ? 'A' : 'R';
  }

  /** Suggested RAG from progress behind plan in percentage points: up to 5 green, up to 15 amber, beyond red. */
  function ragFromProgress(percent, plannedPercent) {
    const gap = plannedPercent - percent;
    return gap <= 5 ? 'G' : gap <= 15 ? 'A' : 'R';
  }

  /** Suggestions the user can accept: { schedule, schedulePercent, slip, overall } */
  function suggest(doc) {
    const out = {};
    const parts = [];
    if (doc.plannedEnd && doc.forecastEnd) {
      out.slip = slipDays(doc.plannedEnd, doc.forecastEnd);
      parts.push(ragFromSlip(out.slip));
    }
    if (doc.plannedPercent !== null && doc.plannedPercent !== '' && doc.plannedPercent !== undefined) {
      out.progress = ragFromProgress(doc.percent, Number(doc.plannedPercent));
      parts.push(out.progress);
    }
    if (parts.length) out.schedule = worst(parts);
    out.overall = worst([doc.scope, out.schedule || doc.schedule, doc.budget]);
    return out;
  }

  function validate(doc) {
    const p = [];
    if (!norm(doc.project)) p.push('Add the project name.');
    if (!doc.date) p.push('Add the report date.');
    else {
      try {
        OT.parseIsoDate(doc.date);
      } catch (e) {
        p.push('The report date is not a real date.');
      }
    }
    ['overall', 'scope', 'schedule', 'budget'].forEach((k) => RAG.indexOf(doc[k]) === -1 && p.push('Choose a colour for ' + k + '.'));
    if (!(doc.percent >= 0 && doc.percent <= 100)) p.push('Percent complete must be 0 to 100.');
    if (doc.plannedPercent !== null && doc.plannedPercent !== '' && !(doc.plannedPercent >= 0 && doc.plannedPercent <= 100))
      p.push('Planned percent must be 0 to 100.');
    ['plannedEnd', 'forecastEnd'].forEach((k) => {
      if (doc[k]) {
        try {
          OT.parseIsoDate(doc[k]);
        } catch (e) {
          p.push('The ' + (k === 'plannedEnd' ? 'planned' : 'forecast') + ' finish is not a real date.');
        }
      }
    });
    if ((doc.overall === 'R' || doc.overall === 'A') && !norm(doc.summary) && !doc.asks.length)
      p.push('The overall status is not green: say why in the summary or add what you need from the reader.');
    return p;
  }

  const sectionList = [
    ['Accomplished this period', 'done'],
    ['Planned next', 'next'],
    ['Risks and issues', 'risks'],
    ['Decisions and help needed', 'asks'],
  ];

  /** Plain-text version, ready to paste into an e-mail. */
  function toText(doc) {
    const L = [];
    L.push('PROJECT STATUS: ' + (doc.project || 'Untitled') + (doc.period ? ' (' + doc.period + ')' : ''));
    L.push(
      'Overall: ' +
        RAG_WORD[doc.overall].toUpperCase() +
        '   Scope: ' +
        RAG_WORD[doc.scope] +
        '   Schedule: ' +
        RAG_WORD[doc.schedule] +
        '   Budget: ' +
        RAG_WORD[doc.budget],
    );
    const prog = ['Progress: ' + doc.percent + '% complete'];
    if (doc.plannedPercent !== null && doc.plannedPercent !== '') prog.push('plan ' + doc.plannedPercent + '%');
    if (doc.plannedEnd) prog.push('planned finish ' + OT.formatDate(doc.plannedEnd, 'dmy'));
    if (doc.forecastEnd) prog.push('forecast ' + OT.formatDate(doc.forecastEnd, 'dmy'));
    L.push(prog.join(', ') + '.');
    if (norm(doc.summary)) L.push('', norm(doc.summary));
    sectionList.forEach((s) => {
      if (doc[s[1]].length) {
        L.push('', s[0] + ':');
        doc[s[1]].forEach((x) => L.push('- ' + x));
      }
    });
    if (doc.preparedBy || doc.date)
      L.push('', 'Prepared by ' + (doc.preparedBy || '-') + (doc.date ? ' on ' + OT.formatDate(doc.date, 'dmy') : '') + '.');
    return L.join('\n');
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

  const COLORS = { G: [0.13, 0.65, 0.33], A: [0.96, 0.62, 0.04], R: [0.86, 0.15, 0.15] };

  /** One-page (or more) A4 status report. */
  async function buildPdf(PDFLib, doc) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.setTitle(sanitize('Status report - ' + (doc.project || 'project')));
    pdf.setCreator('PM Pocket Tools');
    const W = 595.28;
    const H = 841.89;
    const M = 42;
    const grey = rgb(0.45, 0.47, 0.52);
    const ink = rgb(0.1, 0.1, 0.12);
    let page = pdf.addPage([W, H]);
    let y = H - M;
    const text = (s, x, size, f, right, color) => {
      const v = sanitize(s);
      const ff = f || font;
      page.drawText(v, { x: right ? x - ff.widthOfTextAtSize(v, size) : x, y: y, size: size, font: ff, color: color || ink });
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
    para(doc.project || 'Untitled project', 19, bold, M, W - 2 * M, 24);
    para('PROJECT STATUS REPORT' + (doc.period ? '  |  ' + doc.period : ''), 9, font, M, W - 2 * M, 16);
    y -= 4;
    const chips = [
      ['Overall', doc.overall],
      ['Scope', doc.scope],
      ['Schedule', doc.schedule],
      ['Budget', doc.budget],
    ];
    const cw = (W - 2 * M - 30) / 4;
    chips.forEach((c, i) => {
      const x = M + i * (cw + 10);
      page.drawRectangle({ x: x, y: y - 30, width: cw, height: 34, color: rgb.apply(null, COLORS[c[1]]) });
      page.drawText(sanitize(c[0]), { x: x + 8, y: y - 10, size: 8, font: font, color: rgb(1, 1, 1) });
      page.drawText(RAG_WORD[c[1]], { x: x + 8, y: y - 24, size: 12, font: bold, color: rgb(1, 1, 1) });
    });
    y -= 52;
    const bw = W - 2 * M;
    text('Progress ' + doc.percent + '% complete', M, 10, bold);
    y -= 8;
    page.drawRectangle({ x: M, y: y - 8, width: bw, height: 8, color: rgb(0.9, 0.91, 0.93) });
    page.drawRectangle({
      x: M,
      y: y - 8,
      width: (bw * Math.max(0, Math.min(100, doc.percent))) / 100,
      height: 8,
      color: rgb(0.23, 0.45, 0.85),
    });
    if (doc.plannedPercent !== null && doc.plannedPercent !== '') {
      const px = M + (bw * Math.max(0, Math.min(100, Number(doc.plannedPercent)))) / 100;
      page.drawLine({ start: { x: px, y: y - 12 }, end: { x: px, y: y + 3 }, thickness: 1.5, color: ink });
    }
    y -= 24;
    const facts = [];
    if (doc.plannedPercent !== null && doc.plannedPercent !== '') facts.push('Plan: ' + doc.plannedPercent + '% (marker)');
    if (doc.plannedEnd) facts.push('Planned finish: ' + OT.formatDate(doc.plannedEnd, 'dmy'));
    if (doc.forecastEnd) {
      let f = 'Forecast finish: ' + OT.formatDate(doc.forecastEnd, 'dmy');
      if (doc.plannedEnd) {
        const sl = slipDays(doc.plannedEnd, doc.forecastEnd);
        f += sl > 0 ? ' (' + sl + ' days late)' : sl < 0 ? ' (' + -sl + ' days early)' : ' (on plan)';
      }
      facts.push(f);
    }
    if (facts.length) para(facts.join('   |   '), 9, font, M, W - 2 * M, 14);
    if (norm(doc.summary)) {
      y -= 4;
      text('Summary', M, 11, bold);
      y -= 15;
      para(doc.summary, 10, font, M, W - 2 * M, 13.5);
    }
    sectionList.forEach((s) => {
      const items = doc[s[1]];
      if (!items.length) return;
      y -= 8;
      need(40);
      text(s[0], M, 11, bold);
      y -= 15;
      items.forEach((it) => {
        const lines = wrap(font, it, 10, W - 2 * M - 14);
        need(lines.length * 13 + 4);
        page.drawCircle({ x: M + 3, y: y + 3.5, size: 1.6, color: ink });
        lines.forEach((l) => {
          text(l, M + 14, 10, font);
          y -= 13;
        });
        y -= 1.5;
      });
    });
    const foot = 'Prepared by ' + (doc.preparedBy || '-') + (doc.date ? ' on ' + OT.formatDate(doc.date, 'dmy') : '');
    pdf
      .getPages()
      .forEach((p, i, all) =>
        p.drawText(sanitize(foot + '   Page ' + (i + 1) + ' of ' + all.length), { x: M, y: 22, size: 7.5, font: font, color: grey }),
      );
    return pdf.save();
  }

  function serialize(doc) {
    return JSON.stringify({ app: 'status-report', version: 1, doc: doc }, null, 2);
  }

  function parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved status report.');
    }
    const s = d && d.app === 'status-report' ? d.doc : null;
    if (!s || typeof s !== 'object') throw new Error('That file is not a saved status report.');
    const doc = create();
    ['project', 'period', 'preparedBy'].forEach((k) => (doc[k] = norm(s[k]).slice(0, 120)));
    doc.summary = norm(s.summary).slice(0, 1500);
    ['overall', 'scope', 'schedule', 'budget'].forEach((k) => (doc[k] = RAG.indexOf(s[k]) !== -1 ? s[k] : 'G'));
    doc.percent = Number(s.percent) >= 0 && Number(s.percent) <= 100 ? Number(s.percent) : 0;
    doc.plannedPercent =
      s.plannedPercent === null || s.plannedPercent === '' || s.plannedPercent === undefined
        ? null
        : Number(s.plannedPercent) >= 0 && Number(s.plannedPercent) <= 100
          ? Number(s.plannedPercent)
          : null;
    ['date', 'plannedEnd', 'forecastEnd'].forEach((k) => (doc[k] = OT.toIsoDate(s[k]) || ''));
    ['done', 'next', 'risks', 'asks'].forEach((k) => (doc[k] = parseLines(Array.isArray(s[k]) ? s[k].join('\n') : '')));
    return doc;
  }

  function sample(today) {
    const d = create();
    d.project = 'Customer portal';
    d.period = 'Week ending ' + OT.formatDate(today, 'dmy');
    d.preparedBy = 'Priya';
    d.date = today;
    d.percent = 42;
    d.plannedPercent = 50;
    d.plannedEnd = OT.addDays(today, 60);
    d.forecastEnd = OT.addDays(today, 68);
    d.scope = 'G';
    d.budget = 'A';
    d.schedule = 'A';
    d.overall = 'A';
    d.summary = 'Build is progressing but the payment gateway sandbox is late, which pushes testing by about a week.';
    d.done = parseLines('Backend APIs for login and profile completed\nUI designs signed off by the business\nStaging environment set up');
    d.next = parseLines('Start payment integration once sandbox arrives\nBegin UAT planning with department heads');
    d.risks = parseLines('Sandbox from the bank is 10 days late (owner: Meera)\nOne backend engineer on notice period');
    d.asks = parseLines('Sponsor to escalate sandbox access with the bank by Friday');
    return d;
  }

  return {
    RAG_WORD: RAG_WORD,
    create: create,
    parseLines: parseLines,
    worst: worst,
    slipDays: slipDays,
    ragFromSlip: ragFromSlip,
    ragFromProgress: ragFromProgress,
    suggest: suggest,
    validate: validate,
    toText: toText,
    sanitize: sanitize,
    buildPdf: buildPdf,
    serialize: serialize,
    parse: parse,
    sample: sample,
  };
});
