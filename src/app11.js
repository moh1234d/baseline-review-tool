/* ===== APP PART 11: delay analysis – narrative report (Word) with diagrams and flow charts ===== */
const DLF = 'font-family="Segoe UI, Calibri, Arial, sans-serif"';
function dlPngSvg(svg) { return svg.replace(/<svg viewBox="0 0 (\d+) (\d+)"[^>]*>/, (m, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${DLF}>`); }
function dlSize(svg) { const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg); return [+m[1], +m[2]]; }
const dlArrowDefs = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7b8794"/></marker></defs>`;

/* flow chart: how the earlier finish became the current finish, one box per delay event */
function dlFlowSVG(target, rows, partyOf) {
  const nodes = [{ k: 'start', t: 'Earlier finish', s: E.fmtDate(target.fE) }]; let cum = 0;
  rows.forEach(x => { cum += x.e.own; nodes.push({ k: 'ev', x, cum }); });
  const resid = (target.slip || 0) - cum; if (Math.abs(resid) >= 1) nodes.push({ k: 'small', v: resid });
  nodes.push({ k: 'end', t: 'Current finish', s: E.fmtDate(target.fL), v: target.slip });
  const W = 214, H = 92, G = 50, PER = 3, VW = PER * W + (PER - 1) * G + 24, nr = Math.ceil(nodes.length / PER), VH = nr * (H + 46) + 10;
  let s = `<svg viewBox="0 0 ${VW} ${VH}" ${DLF}>${dlArrowDefs('fa')}`;
  const pos = nodes.map((n, i) => ({ x: 12 + (i % PER) * (W + G), y: 8 + Math.floor(i / PER) * (H + 46) }));
  nodes.forEach((n, i) => { if (!i) return; const a = pos[i - 1], b = pos[i];
    if (a.y === b.y) s += `<line x1="${a.x + W}" y1="${a.y + H / 2}" x2="${b.x - 2}" y2="${b.y + H / 2}" stroke="#7b8794" stroke-width="2" marker-end="url(#fa)"/>`;
    else s += `<path d="M${a.x + W / 2} ${a.y + H} V${a.y + H + 23} H${b.x + W / 2} V${b.y - 3}" fill="none" stroke="#7b8794" stroke-width="2" marker-end="url(#fa)"/>`; });
  nodes.forEach((n, i) => { const { x, y } = pos[i];
    if (n.k === 'start' || n.k === 'end') { const slipc = n.k === 'end' ? (n.v > 0 ? '#c0392b' : n.v < 0 ? '#2e8b57' : '#1b2a41') : '#1b2a41';
      s += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="14" fill="#1b2a41"/><text x="${x + W / 2}" y="${y + 28}" text-anchor="middle" font-size="12" fill="#b9c4d2" letter-spacing="1">${esc(n.t.toUpperCase())}</text><text x="${x + W / 2}" y="${y + 56}" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">${esc(n.s)}</text>${n.k === 'end' ? `<text x="${x + W / 2}" y="${y + 78}" text-anchor="middle" font-size="13" font-weight="700" fill="${n.v > 0 ? '#ff9b8f' : n.v < 0 ? '#8be0ac' : '#b9c4d2'}">${n.v ? dsg(n.v) + ' days' : 'no change'}</text>` : ''}`; return; }
    if (n.k === 'small') { s += `<rect x="${x}" y="${y + 14}" width="${W}" height="${H - 28}" rx="12" fill="#f4f6f8" stroke="#9aa5b1" stroke-dasharray="5 4"/><text x="${x + W / 2}" y="${y + 42}" text-anchor="middle" font-size="12" fill="#5b6b7b">Small movements</text><text x="${x + W / 2}" y="${y + 60}" text-anchor="middle" font-size="13" font-weight="700" fill="#5b6b7b">${dsg(Math.round(n.v * 10) / 10)} d</text>`; return; }
    const e = n.x.e, up = e.own > 0, col = up ? '#c0392b' : '#2e8b57', pt = partyOf ? partyOf(n.x.key) : '';
    s += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="14" fill="${up ? '#fdecea' : '#e8f6ee'}" stroke="${col}" stroke-width="2"/><text x="${x + 12}" y="${y + 20}" font-size="11.5" font-weight="700" fill="#1b2a41">${esc(dtr(e.code, 30))}</text><text x="${x + 12}" y="${y + 37}" font-size="11.5" fill="#334155">${esc(dtr(e.name, 34))}</text><text x="${x + 12}" y="${y + 66}" font-size="22" font-weight="700" fill="${col}">${dsg(e.own)} d</text><text x="${x + W - 12}" y="${y + 60}" text-anchor="end" font-size="11.5" fill="${col}" font-weight="600">${esc(e.cause)}</text><text x="${x + W - 12}" y="${y + 78}" text-anchor="end" font-size="11" fill="#5b6b7b">${esc(pt && pt !== 'Unassigned' ? pt : '')}</text><text x="${x + 12}" y="${y + 84}" font-size="10" fill="#6b7785">finish so far ${dsg(Math.round(n.cum * 10) / 10)} d</text>`; });
  return s + '</svg>';
}
function dlMethodSVG(mode) {
  const st = [['1', 'Load schedules', mode === 'B' ? 'Baseline + updates, in date order' : 'Baseline + progress update'], ['2', 'Trace the driving path', 'Walk back from the finish through the links that drive each start'], ['3', 'Compare the dates', mode === 'B' ? 'Window by window: each update against the previous one' : 'Each activity against the baseline'], ['4', 'Split the delay', 'Inherited delay vs delay added by the activity itself'], ['5', 'Classify the cause', 'Late start, longer duration, logic change, recovery'], ['6', 'Assign responsibility', 'Tag each event: Employer, Contractor or Neutral']];
  const W = 214, H = 96, G = 50, PER = 3, VW = PER * W + (PER - 1) * G + 24, VH = 2 * (H + 40) + 6; let s = `<svg viewBox="0 0 ${VW} ${VH}" ${DLF}>${dlArrowDefs('ma')}`;
  const pos = st.map((n, i) => ({ x: 12 + (i % PER) * (W + G), y: 4 + Math.floor(i / PER) * (H + 40) }));
  st.forEach((n, i) => { if (!i) return; const a = pos[i - 1], b = pos[i]; if (a.y === b.y) s += `<line x1="${a.x + W}" y1="${a.y + H / 2}" x2="${b.x - 2}" y2="${b.y + H / 2}" stroke="#7b8794" stroke-width="2" marker-end="url(#ma)"/>`; else s += `<path d="M${a.x + W / 2} ${a.y + H} V${a.y + H + 20} H${b.x + W / 2} V${b.y - 3}" fill="none" stroke="#7b8794" stroke-width="2" marker-end="url(#ma)"/>`; });
  st.forEach((n, i) => { const { x, y } = pos[i], fill = i === 5 ? '#e8f0fa' : '#f4f6f8'; const words = n[2].split(' '); let l1 = '', l2 = ''; words.forEach(w => { if ((l1 + ' ' + w).length < 30 && !l2) l1 = (l1 + ' ' + w).trim(); else l2 = (l2 + ' ' + w).trim(); });
    s += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="14" fill="${fill}" stroke="#c9d2db"/><circle cx="${x + 26}" cy="${y + 28}" r="14" fill="#1b2a41"/><text x="${x + 26}" y="${y + 33}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${n[0]}</text><text x="${x + 48}" y="${y + 33}" font-size="13.5" font-weight="700" fill="#1b2a41">${esc(n[1])}</text><text x="${x + 14}" y="${y + 62}" font-size="11.5" fill="#475569">${esc(l1)}</text><text x="${x + 14}" y="${y + 78}" font-size="11.5" fill="#475569">${esc(l2)}</text>`; });
  return s + '</svg>';
}
function dlSplitSVG(obj, colors, total, title) {
  const k = Object.keys(obj).sort((a, b) => obj[b] - obj[a]); const pc = dlPct(obj, total); const RH = 34, VW = 700, VH = Math.max(1, k.length) * RH + 38;
  let s = `<svg viewBox="0 0 ${VW} ${VH}" ${DLF}><text x="4" y="18" font-size="13" font-weight="700" fill="#1b2a41">${esc(title)}</text>`;
  k.forEach((n, i) => { const y = 30 + i * RH, w = Math.max(4, obj[n] / total * 380); s += `<text x="4" y="${y + 17}" font-size="12.5" fill="#334155">${esc(n)}</text><rect x="190" y="${y + 3}" width="380" height="18" rx="9" fill="#eef1f5"/><rect x="190" y="${y + 3}" width="${w}" height="18" rx="9" fill="${colors[n] || '#4a6fa5'}"/><text x="${580}" y="${y + 17}" font-size="12.5" font-weight="700" fill="#1b2a41">${dsg(Math.round(obj[n] * 10) / 10)} d · ${pc[n]}%</text>`; });
  return s + '</svg>';
}

/* ---------- narrative wording (written the way a planning engineer would put it) ---------- */
const dlPct = (obj, total) => { const k = Object.keys(obj), raw = k.map(n => obj[n] / total * 100), fl = raw.map(Math.floor); let rest = 100 - fl.reduce((a, b) => a + b, 0); raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } }); const o = {}; k.forEach((n, i) => o[n] = fl[i]); return o; };
const dlDays = n => { n = Math.round(Math.abs(n) * 10) / 10; return n + (n === 1 ? ' day' : ' days'); };
function dlNarr(r) {
  const e = r.row, own = r.own, spE = e.spanE + 1, spL = e.spanL + 1, nm = '“' + dtr(r.name, 70) + '”';
  const plan = e.sE != null ? `${nm} was planned to run from ${dsh(e.sE)} to ${dsh(e.fE)} (${spE} days).` : nm + '.';
  const now = e.sE != null ? ` It is now forecast ${dsh(e.sL)} to ${dsh(e.fL)}.` : '';
  if (r.cause === E.DL_CAUSES.DUR) return `${plan}${now} That is ${spL} days against ${spE} planned, a growth of ${dlDays(spL - spE)}. The activity is on the driving path, so the finish date moved by ${dlDays(own)} because of it.`;
  if (r.cause === E.DL_CAUSES.LATE) return `${plan}${now} ${e.gapWd ? `Its driving predecessor finished ${e.gapWd} working days before it actually started, and nothing in the logic explains that gap.` : 'It started later than the logic required.'} Those days of waiting cost the programme ${dlDays(own)}.`;
  if (r.cause === E.DL_CAUSES.LOGIC) return `${plan}${now} The relationship feeding this activity was changed between the two schedules (${e.logic || 'link edited'}), and that change alone pushed the finish by ${dlDays(own)}.`;
  if (r.cause === E.DL_CAUSES.REC) return `${plan}${now} This activity gave back ${dlDays(own)}, either through a shorter duration or an earlier start, which offsets part of the delay it inherited from earlier activities.`;
  return plan;
}
const dlOneLine = (x, note) => `${x.e.code} “${dtr(x.e.name, 60)}”: ${x.e.own > 0 ? 'added ' : 'recovered '}${dlDays(x.e.own)} (${x.e.cause.toLowerCase()})${note ? '; ' + note : ''}`;

/* ---------- the report ---------- */
async function dlReport() {
  const r = S.dl.res; if (!r) return; toast('Building the report…'); await sleep(30);
  const D = await lib('docx'); const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle, ImageRun, HeadingLevel, PageBreak, Footer, Header, PageNumber, TableLayoutType, VerticalAlign } = D;
  const INK = '1B2A41', GREY = '5B6B7B', RED = 'C0392B', GRN = '2E8B57', BLUE = '2B6CB0', F = 'Calibri';
  const FW = 9906; let fig = 0; const ch = [];
  const run = (t, o) => new TextRun(Object.assign({ text: String(t), size: 21, font: F, color: '27323F' }, o || {}));
  const P = (t, o) => new Paragraph(Object.assign({ spacing: { after: 110, line: 276 }, children: [run(t, o && o.run)] }, o && o.p));
  const bullet = t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 70, line: 264 }, children: [run(t)] });
  const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'C9D2DB', space: 4 } }, children: [run(t, { size: 31, bold: true, color: INK })] });
  const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 250, after: 80 }, keepNext: true, children: [run(t, { size: 24, bold: true, color: INK })] });
  const bd = { style: BorderStyle.SINGLE, size: 4, color: 'D5DCE4' }, borders = { top: bd, bottom: bd, left: bd, right: bd }, none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, noB = { top: none, bottom: none, left: none, right: none };
  const cell = (kids, w, fill, o) => new TableCell(Object.assign({ children: Array.isArray(kids) ? kids : [kids], width: { size: w, type: WidthType.DXA }, borders, shading: fill ? { type: ShadingType.CLEAR, fill } : undefined, margins: { top: 70, bottom: 70, left: 110, right: 110 }, verticalAlign: VerticalAlign.CENTER }, o || {}));
  const tbl = (rows, cols) => new Table({ rows, columnWidths: cols, layout: TableLayoutType.FIXED, width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA } });
  const sm = (t, o) => P(t, { run: Object.assign({ size: 18 }, o), p: { spacing: { after: 40 } } });
  const grid = (head, rows, cols) => tbl([new TableRow({ tableHeader: true, children: head.map((h, i) => cell(sm(h, { bold: true, color: 'FFFFFF' }), cols[i], INK)) }), ...rows.map((rw, ri) => new TableRow({ cantSplit: true, children: rw.map((v, i) => cell(Array.isArray(v) ? v : sm(v), cols[i], ri % 2 ? 'F7F9FB' : undefined)) }))], cols);
  const image = async (svg, caption, maxW) => { try { const [w, h] = dlSize(svg), png = await svgToPng(dlPngSvg(svg), 2), buf = new Uint8Array(await png.arrayBuffer()), mw = maxW || 640, k = Math.min(1, mw / w); fig++; ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 }, keepNext: true, children: [new ImageRun({ data: buf, transformation: { width: Math.round(w * k), height: Math.round(h * k) }, type: 'png' })] })); ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [run('Figure ' + fig + ' – ' + caption, { size: 18, italics: true, color: GREY })] })); } catch (e) { console.warn('figure skipped', e); } };
  const tile = (label, val, sub, col, w) => cell([sm(label.toUpperCase(), { color: GREY, size: 15, bold: true }), P(val, { run: { size: 30, bold: true, color: col || INK }, p: { spacing: { after: 20 } } }), sm(sub, { color: GREY })], w, 'F4F6F9', { borders: { top: { style: BorderStyle.SINGLE, size: 18, color: col || INK }, bottom: bd, left: bd, right: bd } });
  const T = r.target, rowsAll = dlEventRows(r), sp = dlSplit(rowsAll), proj = S.cfg.projectName || (dlModels()[0] ? dlModels()[0].M.proj.proj_short_name : 'Project'), today = E.fmtDate(Math.floor(Date.now() / 86400000));
  const partyOf = k => dlParty(k), tag = k => S.dl.tags[k] || {}; 
  const sgc = n => n > 0 ? RED : n < 0 ? GRN : INK;

  /* cover */
  ch.push(tbl([new TableRow({ children: [new TableCell({ width: { size: FW, type: WidthType.DXA }, borders: noB, shading: { type: ShadingType.CLEAR, fill: INK }, margins: { top: 380, bottom: 380, left: 360, right: 360 }, children: [P('DELAY ANALYSIS REPORT', { run: { size: 18, bold: true, color: 'B9C4D2', characterSpacing: 60 }, p: { spacing: { after: 100 } } }), P('Delay assessment – activities delayed and driving the finish', { run: { size: 40, bold: true, color: 'FFFFFF' }, p: { spacing: { after: 100 } } }), P(proj, { run: { size: 24, color: 'DCE3EC' }, p: { spacing: { after: 0 } } })] })] })], [FW]));
  ch.push(P(' ', { p: { spacing: { after: 60 } } }));
  const kv = [['Analysed activity', T.code + ' – ' + T.name], ['Method', r.mode === 'A' ? 'Option A – baseline against current update' : 'Option B – windows analysis (' + r.windows.length + ' window' + (r.windows.length === 1 ? '' : 's') + ')'], ['Schedules', r.mode === 'A' ? r.from.name + '  →  ' + r.to.name : r.models.map(m => m.name).join('  →  ')], ['Data date(s)', r.mode === 'A' ? E.fmtDate(r.from.dd) + '  →  ' + E.fmtDate(r.to.dd) : r.models.map(m => E.fmtDate(m.dd)).join('  →  ')], ['Prepared by', S.cfg.preparedBy || 'Engr. Mohamed Hamdi'], ['Date', today]];
  ch.push(tbl(kv.map(([a, b]) => new TableRow({ children: [cell(sm(a, { bold: true, color: INK }), 2500, 'EEF2F6'), cell(sm(b), FW - 2500)] })), [2500, FW - 2500]));

  /* 1 executive summary */
  ch.push(H1('1. Executive summary'));
  const events1 = r.mode === 'A' ? r.paths[0].events.filter(e => Math.abs(e.own) >= 1) : [];
  if (r.mode === 'A') {
    const pos = rowsAll.filter(x => x.path === 1 && x.e.own > 0).sort((a, b) => b.e.own - a.e.own);
    const dirw = T.slip > 0 ? 'later by ' + dlDays(T.slip) : T.slip < 0 ? 'earlier by ' + dlDays(T.slip) : 'not at all';
    ch.push(P(`Since the baseline, the finish of “${T.name}” has moved ${dirw}${T.slip ? ', from ' + E.fmtDate(T.fE) + ' to ' + E.fmtDate(T.fL) : ' (' + E.fmtDate(T.fL) + ')'}.` + (pos.length && T.slip > 0 ? ` Almost all of it comes from a few activities on the driving path: ${pos.slice(0, 3).map(x => x.e.code + ' (' + dsg(x.e.own) + ' days)').join(', ')}.` : ''), { run: { size: 24, bold: true, color: INK }, p: { spacing: { after: 140, line: 300 } } }));
    ch.push(P('Delay assessment only. No entitlement or extension of time is assessed in this report. It identifies the activities that are driving the finish and the activities that are delayed (section 7).', { run: { bold: true, color: RED } }));
    const w4 = [2476, 2476, 2477, 2477];
    ch.push(tbl([new TableRow({ children: [tile('Earlier finish', E.fmtDate(T.fE), 'baseline', INK, w4[0]), tile('Current finish', E.fmtDate(T.fL), T.slip ? dsg(T.slip) + ' days' : 'no change', sgc(T.slip), w4[1]), tile('Driving now', String(r.lists.now.length), 'activities on the driving path', INK, w4[2]), tile('Delayed and driving', String(r.lists.drv.length), r.lists.prov.length ? 'provisional result' : 'finish later than before', r.lists.drv.length ? RED : GRN, w4[3])] })], w4));
    ch.push(P(' ', { p: { spacing: { after: 40 } } }));
    ch.push(P('Figure 1 follows the delay from the earlier finish date to the current one. Each box is an activity on the driving path and the days it added or gave back.'));
    await image(dlFlowSVG(T, r.paths[0].events.filter(e => Math.abs(e.own) >= 1).map(e => rowsAll.find(x => x.path === 1 && x.e === e)).filter(Boolean), partyOf), 'How the delay reached the finish date', 660);
    if (r.concurrent.length) ch.push(P(`${r.concurrent.length === 1 ? 'One other path is' : r.concurrent.length + ' other paths are'} also slipping at the same time. That matters for who is responsible, and is covered in section 4.`));
  } else {
    const sorted = r.windows.slice().sort((a, b) => Math.abs(b.target.slip) - Math.abs(a.target.slip));
    ch.push(P(`Across the ${r.windows.length} windows the finish of “${T.name}” moved ${T.slip ? (T.slip > 0 ? 'later by ' + dlDays(T.slip) : 'earlier by ' + dlDays(T.slip)) + ', from ' + E.fmtDate(T.fE) + ' to ' + E.fmtDate(T.fL) : 'by nothing'}.` + (sorted.length ? ` Window ${sorted[0].idx} had the biggest effect (${dsg(sorted[0].target.slip)} days).` : ''), { run: { size: 24, bold: true, color: INK }, p: { spacing: { after: 140, line: 300 } } }));
    ch.push(P('Delay assessment only. No entitlement or extension of time is assessed in this report. It identifies the activities that are driving the finish and the activities that are delayed (section 7).', { run: { bold: true, color: RED } }));
    const w4 = [2476, 2476, 2477, 2477];
    ch.push(tbl([new TableRow({ children: [tile('First finish', E.fmtDate(T.fE), r.models[0].name.slice(0, 28), INK, w4[0]), tile('Latest finish', E.fmtDate(T.fL), T.slip ? dsg(T.slip) + ' days' : 'no change', sgc(T.slip), w4[1]), tile('Windows', String(r.windows.length), 'analysed one by one', INK, w4[2]), tile('Driving activities', String(r.windows.reduce((a, w) => a + w.lists.drv.length, 0)), 'delayed and driving, all windows', RED, w4[3])] })], w4));
    ch.push(P(' ', { p: { spacing: { after: 40 } } }));
    await image(dlBarsByWindow(r), 'Finish movement in each window', 600);
    ch.push(grid(['Window', 'Period (data dates)', 'Finish before', 'Finish after', 'Movement', 'Critical path still driving'], r.windows.map(w => [String(w.idx), dsh(w.ddE) + ' → ' + dsh(w.ddL), E.fmtDate(w.target.fE), E.fmtDate(w.target.fL), dsg(w.target.slip) + ' d', w.overlap == null ? '–' : w.overlap + '%']), [900, 2300, 1600, 1600, 1500, 2006]));
    ch.push(P(' ', { p: { spacing: { after: 40 } } }));
  }

  /* 2 method */
  ch.push(H1('2. Scope and method'));
  ch.push(P(r.mode === 'A' ? `We compared the baseline with the current progress update. Working back from “${T.name}”, we followed the chain of activities that actually controls the finish date (the driving path) in the update, then checked how far each of those activities has moved against the baseline.` : `We took the updates in date order and looked at each period between two consecutive schedules on its own. At the start of every window we found the driving path to “${T.name}”, and measured only what moved during that window. This shows when each delay happened, and it copes with the critical path changing from one update to the next.`));
  await image(dlMethodSVG(r.mode), 'Analysis steps', 660);
  ch.push(grid(['Term', 'Meaning'], [['Driving path', 'The chain of activities where each start is controlled by the finish (or start) of the activity before it. A delay anywhere on it moves the finish date.'], ['Delay added', 'Days of delay introduced by an activity itself, after removing the delay it simply inherited from the activity before it.'], ['Late start / waiting', 'The activity started later than the logic required, so time was lost between two linked activities.'], ['Duration growth', 'The activity takes longer than it was planned to take.'], ['Logic change', 'A relationship or lag into the activity was added, removed or changed.'], ['Recovery', 'An activity that gained time back (shorter duration or earlier start).'], ['Concurrent delay', 'Delay on a second path happening at the same time as delay on the driving path.']], [2200, FW - 2200]));
  ch.push(P(' ', { p: { spacing: { after: 20 } } }));
  ch.push(sm('Dates are compared in calendar days. Movements under ' + (S.dl.min || 3) + ' day(s) are ignored, because weekends and holidays produce one-day differences that are not real delay. The schedules tell us where the delay entered the path and by how much; they do not tell us why. The reasons and the party responsible come from our own review of the project records.', { italics: true, color: GREY }));

  /* 3 findings */
  const eventBlock = async (evRows, win, withNarr) => {
    let n = 0; for (const x of evRows) { n++; const e = x.e, t = tag(x.key);
      if (withNarr) {
        ch.push(H2('Event ' + n + ' – ' + e.code + ' “' + dtr(e.name, 80) + '”'));
        ch.push(P(dlNarr(e), { p: { spacing: { after: 90 } } }));
      }
      ch.push(tbl([new TableRow({ cantSplit: true, children: [cell([sm('DELAY ADDED', { size: 14, bold: true, color: GREY }), P(dsg(e.own) + ' days', { run: { size: 26, bold: true, color: e.own > 0 ? RED : GRN }, p: { spacing: { after: 0 } } })], 1900, 'F4F6F9'), cell([sm('CAUSE', { size: 14, bold: true, color: GREY }), sm(e.cause, { bold: true })], 2300, 'F4F6F9'), cell([sm('RESPONSIBLE', { size: 14, bold: true, color: GREY }), sm(t.party || 'Unassigned', { bold: true, color: t.party === 'Employer' ? BLUE : t.party === 'Contractor' ? RED : t.party === 'Neutral' ? GRN : GREY })], 1900, 'F4F6F9'), cell([sm('EVIDENCE / REASON', { size: 14, bold: true, color: GREY }), sm(t.note || 'Not recorded', { italics: !t.note, color: t.note ? '27323F' : GREY })], 3806, 'F4F6F9')] })], [1900, 2300, 1900, 3806]));
      if (e.flags.length) ch.push(sm('Schedule notes: ' + e.flags.join('; '), { color: GREY }));
      ch.push(P(' ', { p: { spacing: { after: 30 } } }));
    }
  };
  if (r.mode === 'A') {
    ch.push(H1('3. Delay events on the driving path'));
    ch.push(P('The driving path to the finish runs through ' + r.paths[0].len + ' activities. ' + (events1.length ? events1.length + ' of them added or gave back time. They are taken in order below, from the start of the path to the finish.' : 'None of them added or gave back a significant amount of time.')));
    await image(dlWaterfall(r, r.paths[0]), 'Delay added by each activity on the driving path', 660);
    await eventBlock(r.paths[0].events.map(e => rowsAll.find(x => x.path === 1 && x.e === e)).filter(Boolean), 0, true);
    await image(dlDiagram(r.paths[0], 'A'), 'Network diagram of the driving path (red = delay entered here, amber = delay carried, green = on time or recovered)', 680);
    if (Object.keys(sp.byC).length) { await image(dlSplitSVG(sp.byC, DL_CCOL, sp.pos || 1, 'Delay added by cause'), 'Delay added on the driving path by cause'); }
    ch.push(H1('4. Parallel and near-critical paths'));
    ch.push(P('The paths with the next lowest float are shown below, so that delay happening in parallel, and paths that could become critical, are not missed.'));
    for (const p of r.paths.slice(1)) { ch.push(H2('Path ' + p.rank + ' – ends at ' + p.end.code + ' “' + dtr(p.end.name, 70) + '”')); const last = (p.rows[p.rows.length - 1] || {}).dF || 0; ch.push(P('This path has ' + p.len + ' activities' + (p.tf != null ? ' and about ' + (Math.round(p.tf * 10) / 10) + ' working days of float' : '') + '. Its finish has moved by ' + dsg(last) + ' days' + (p.events.filter(e => e.own > 0).length ? ', with ' + (p.events.filter(e => e.own > 0).length === 1 ? 'one activity' : p.events.filter(e => e.own > 0).length + ' activities') + ' adding delay.' : '.')));
      await image(dlDiagram(p, 'A'), 'Network diagram of path ' + p.rank, 680);
      const pe = p.events.filter(e => e.own > 0); if (pe.length) ch.push(grid(['ID', 'Activity', 'Delay added', 'Cause'], pe.map(e => [e.code, e.name, dsg(e.own) + ' d', e.cause]), [1900, 4806, 1400, 1800])); }
    if (r.concurrent.length) ch.push(P('Paths that slipped at the same time as the driving path: ' + r.concurrent.map(c => 'path ' + c.rank + ' (' + dsg(c.endSlip) + ' days)').join(', ') + '. Responsibility for delay in the same period has to be looked at as concurrent delay.', { run: { bold: true } }));
  } else {
    ch.push(H1('3. Window-by-window findings'));
    ch.push(P('Each window below starts from the critical path as it stood at the beginning of that window and shows what moved the finish during it.'));
    for (const w of r.windows) {
      const wr = dlEventRows({ mode: 'B', windows: [w] }).filter(x => x.path === 1 && Math.abs(x.e.own) >= 1);
      ch.push(H2('Window ' + w.idx + ' – ' + dsh(w.ddE) + ' to ' + dsh(w.ddL) + '   (' + dsg(w.target.slip) + ' days)'));
      { const ev = w.paths[0].events.filter(e => e.own > 0).sort((x, y) => y.own - x.own); ch.push(P(`In this window the finish moved ${w.target.slip > 0 ? 'later by ' + dlDays(w.target.slip) : w.target.slip < 0 ? 'earlier by ' + dlDays(w.target.slip) : 'by nothing'} (${E.fmtDate(w.target.fE)} → ${E.fmtDate(w.target.fL)}).` + (ev.length && w.target.slip > 0 ? ` ${ev.length === 1 ? 'One activity' : ev.length + ' activities'} on the driving path explain${ev.length === 1 ? 's' : ''} it; the largest is ${ev[0].code} “${dtr(ev[0].name, 50)}” at ${dlDays(ev[0].own)} (${ev[0].cause.toLowerCase()}).` : ''), { run: { bold: true, color: INK } })); }
      if (w.overlap != null && w.overlap < 60) ch.push(P('The critical path shifted during this window: only ' + w.overlap + '% of the path driving the finish at the end of it was on the path at the start.', { run: { color: RED } }));
      if (wr.length) { await image(dlFlowSVG(w.target, wr, partyOf), 'Window ' + w.idx + ' – how the delay reached the finish date', 660); await eventBlock(wr, w.idx, false); wr.forEach(x => ch.push(bullet(dlOneLine(x, '')))); }
      else ch.push(P('Nothing on the driving path added or gave back a significant amount of time in this window.'));
      await image(dlDiagram(w.paths[0], 'B'), 'Window ' + w.idx + ' – network diagram of the driving path', 680);
      if (w.concurrent.length) ch.push(grid(['Parallel path', 'Ends at', 'Finish moved'], w.concurrent.map(c => ['Path ' + c.rank, c.end.code + ' ' + dtr(c.end.name, 50), dsg(c.endSlip) + ' d']), [1800, 6106, 2000]));
    }
    ch.push(H1('4. Cause and responsibility across all windows'));
    if (Object.keys(sp.byC).length) await image(dlSplitSVG(sp.byC, DL_CCOL, sp.pos || 1, 'Delay added by cause'), 'Delay added by cause, all windows');
  }

  /* 5 responsibility */
  ch.push(H1('5. Party notes (optional, no entitlement assessed)'));
  if (sp.pos) { await image(dlSplitSVG(sp.byP, DL_PCOL, sp.pos, 'Delay added by responsible party'), 'Delay added on the driving path by responsible party'); ch.push(grid(['Party', 'Days of delay added', 'Share'], Object.keys(sp.byP).sort((a, b) => sp.byP[b] - sp.byP[a]).map(k => [k, dsg(Math.round(sp.byP[k] * 10) / 10) + ' d', dlPct(sp.byP, sp.pos)[k] + '%']), [4000, 3000, 2906])); ch.push(sm('Based on the party entered for each delay event. Only delay added on the driving path is counted; recoveries are left out.', { italics: true, color: GREY })); }
  else ch.push(P('The driving path did not add any delay, so there is nothing to allocate.'));

  /* 6 reliability */
  ch.push(H1('6. Reliability of the schedules'));
  ch.push(P('A driving path is only as good as the logic behind it, so we checked each schedule before relying on the result.'));
  (r.baseWarn || []).forEach(w => ch.push(P('Warning: ' + w, { run: { color: RED } })));
  ch.push(grid(['Schedule', 'Check', 'Count'], r.integrity.flatMap(g => g.issues.length ? g.issues.map(i => [dtr(g.label, 40), i.title, String(i.n)]) : [[dtr(g.label, 40), 'No problems found', '0']]), [2700, 6006, 1200]));

  /* 7 driving activities */
  ch.push(H1('7. Activities driving the finish'));
  ch.push(P('Delay assessment only. No entitlement assessed. An activity is driving when a one-day delay to it would move the finish date by one day: it is on the longest path and the link into it has no gap.', { run: { bold: true, color: RED } }));
  const drvBlock = (L, ttl) => {
    ch.push(H2(ttl));
    if (L.prov.length) { ch.push(P('The result is provisional because of the following:', { run: { bold: true } })); L.prov.forEach(t => ch.push(bullet(t))); }
    ch.push(sm('A. Driving now', { bold: true, color: INK }));
    ch.push(grid(['#', 'ID', 'Activity', 'Finish', 'Why it is driving'], L.now.map((x, i) => [String(i + 1), x.code, dtr(x.name, 60), dsh(x.fL), x.why + (x.tie.length ? ' (tie with ' + x.tie.join(', ') + ')' : '')]), [500, 1500, 3300, 1000, 3606]));
    ch.push(P(' ', { p: { spacing: { after: 40 } } }));
    ch.push(sm('B. Delayed and driving', { bold: true, color: INK }));
    if (L.drv.length) ch.push(grid(['ID', 'Activity', 'Finish moved', 'Added here', 'What happened'], L.drv.map(x => [x.code, dtr(x.name, 60), dsg(x.dF) + ' d', x.carried ? '-' : dsg(x.added) + ' d', x.carried ? 'Carries delay from an earlier activity' : x.cause]), [1500, 3800, 1200, 1200, 2206])); else ch.push(P('No activity on the driving path finishes later than before.'));
    ch.push(P(' ', { p: { spacing: { after: 40 } } }));
    ch.push(sm('C. Delayed but not driving' + (L.offTotal ? ' (' + L.offTotal + ' in total' + (L.offTotal > 25 ? ', largest 25 shown' : '') + ')' : ''), { bold: true, color: INK }));
    if (L.off.length) ch.push(grid(['ID', 'Activity', 'Finish moved', 'Float (wd)', 'Note'], L.off.slice(0, 25).map(x => [x.code, dtr(x.name, 60), dsg(x.dF) + ' d', x.tf == null ? '-' : String(Math.round(x.tf * 10) / 10), x.crit ? 'Critical, not on this path' : x.tf != null && x.tf < 10 ? 'Near-critical' : 'Has float']), [1500, 3800, 1200, 1100, 2306])); else ch.push(P('No other activity slipped by the threshold.'));
  };
  if (r.mode === 'A') drvBlock(r.lists, '7.1 Current update'); else r.windows.forEach(w => drvBlock(w.lists, '7.' + w.idx + ' Window ' + w.idx + ' (' + dsh(w.ddE) + ' to ' + dsh(w.ddL) + ')'));
  const conc = r.mode === 'A' ? r.concurrent : r.windows.flatMap(w => w.concurrent);
  if (conc.length) ch.push(P('Parallel paths slipped in the same periods as the driving path (' + conc.slice(0, 3).map(c => 'path ' + c.rank + ' ending at ' + c.end.code + ', ' + dsg(c.endSlip) + ' days').join('; ') + '). They have little float left and may become critical.'));
  if ((r.integrity || []).some(g => g.sev === 'bad')) ch.push(P('The schedules contain logic problems (see section 6). They can distort the driving path. Correct them and re-run the analysis before the findings are used formally.'));
  (r.baseWarn || []).forEach(w => ch.push(P('Baseline check: ' + w)));
  ch.push(sm('This report is based on the schedule files named on the first page. It shows where and by how much the finish moved. It does not assess entitlement, extension of time, cost or contractual responsibility. Any party notes entered are labels for the reader only.', { italics: true, color: GREY }));

  /* appendix */
  if (r.mode === 'A') { ch.push(new Paragraph({ children: [new PageBreak()] })); ch.push(H1('Appendix – Driving path activities')); ch.push(grid(['ID', 'Activity', 'Current finish', 'Finish moved', 'Added here'], r.paths[0].rows.map(x => [x.code, x.name, x.fL != null ? dsh(x.fL) : '–', x.dF == null ? '' : dsg(x.dF) + ' d', x.cause ? dsg(x.own) + ' d' : '']), [1900, 4306, 1300, 1200, 1200])); }

  const doc = new Document({ creator: S.cfg.preparedBy || 'Baseline Review Tool', title: 'Delay analysis report', styles: { default: { document: { run: { font: F, size: 21 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(proj + ' · Delay analysis report · page ', { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: F })] })] }) }, children: ch }] });
  const blob = await Packer.toBlob(doc); download(blob, proj + '_Delay_Analysis_Report.docx'); toast('Delay analysis report created', 'ok');
}
document.addEventListener('click', e => { if (S.step === 'delay' && e.target.closest('[data-dr]')) dlReport().catch(err => { console.error(err); toast(err.message, 'bad'); }); });
