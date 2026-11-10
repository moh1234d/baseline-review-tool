/* ===== APP PART 3: report, diagram, exports ===== */
const GROUP_ORDER = ['Contract & time', 'Scope & BOQ', 'Cost & resources', 'Calendars', 'Consistency', 'Schedule logic', 'Submitted documents'];
const WHY = {
  T1: 'The commencement date fixes every contractual date that follows; a programme that starts on another date cannot be measured against the contract.',
  T2: 'The Contract allows a fixed time for completion, so the baseline should finish on the contract completion date.',
  T3: 'Contractual milestones are binding dates; the baseline must show them exactly.',
  T4: 'Review periods are set by the Contract and drive the time allowed for approvals in the programme.',
  L1: 'Open ends let activities float freely, so delay to them does not move the project finish and the critical path is understated.',
  L2: 'Start-to-Finish links and overlaps longer than the activities themselves make the sequence illogical and hide the true driving path.',
  L3: 'Negative lags compress the sequence artificially and make dates unreliable.',
  L4: 'Lags hide waiting time inside logic links where it cannot be monitored or claimed against.',
  L5: 'Constraints override logic and hide the real critical path.',
  L6: 'Invalid links and loops stop the schedule from calculating correctly.',
  L7: 'Zero-duration tasks and milestones with duration distort the dates and the milestone reporting.',
  L8: 'Excess float shows that logic is missing, so delay to those activities would not be detected.',
  L9: 'Long activities cannot be progressed or measured accurately.',
  L10a: 'Using the wrong calendar changes durations and dates: work cannot be scheduled on days the Contract does not allow, and approval periods follow the authority\'s working week.',
  L10b: 'Calendar definitions drive every date in the programme.',
  L10c: 'Public holidays are non-working days under the Contract; leaving them as working days makes the dates unachievable.',
  L11a: 'The WBS controls how progress rolls up and how the schedule is reported; if it disagrees with the activity name, the programme tells the wrong story.',
  L11b: 'A wrong ID or code spoils filtering and reports by zone and discipline.',
  R1: 'The progress resource is the basis of earned progress; it must carry the full contract value with the agreed phase weights.',
  R2: 'The cost resource carries the BOQ amounts; if it is priced, the budget is counted twice.',
  R3: 'An activity with no progress resource has no weight, so its progress will not show in Primavera.',
  R4: 'Every BOQ amount must sit on an activity or part of the contract value is missing from the programme.',
  R5: 'Without labour and equipment the durations cannot be justified.',
  R6: 'Labour and equipment priced above zero count the budget a second time.',
  L13: 'A baseline must not contain progress or dates before the data date.',
  L14: 'If engineering, approvals, procurement and mobilization do not drive construction, a delay in them will never move the construction dates.',
  L15: 'Milestones that do not drive anything cannot be used to monitor the project.',
  L17: 'Duplicate links add nothing and make the logic harder to maintain.',
  S1: 'The BOQ total and the contract value must agree.', S2: 'Every BOQ item must be planned; an unplanned item is outside the programme.', S3: 'The mapping sheet must refer to activities that exist.', S4: 'The scheduled value of each item must equal its BOQ amount.',
  D1: 'The S-curve is the contractor\'s statement of planned progress and must match the baseline.', D2: 'The cash flow must be consistent with the baseline.', D3: 'The histogram must agree with the labour planned in the schedule.', D4: 'Resource calculations justify durations and must agree with the schedule.', D6: 'The narrative must describe the programme as submitted.', D7: 'The zones and roads in the programme must match the project layout.'
};
S.edits = {};
const edit = (r) => Object.assign({ why: WHY[r.id] || '', action: r.action || '' }, S.edits[r.id] || {});
const stat = r => r.status;
const chip = r => ({ fail: '<span class="chip bad">Fail</span>', pass: '<span class="chip ok">Pass</span>', notrun: '<span class="chip">Not run</span>', info: '<span class="chip info">Info</span>' })[r.status];
function prevStatus(r) {
  const last = S.history[S.history.length - 1]; if (!last) return ''; const p = last.checks[r.id];
  if (r.status === 'fail') return !p || p.status !== 'fail' ? '<span class="chip new">New</span>' : `<span class="chip open">Still open (${p.count} → ${r.count})</span>`;
  if (r.status === 'pass' && p && p.status === 'fail') return '<span class="chip ok">Fixed</span>'; return '';
}
function viewReport() {
  const o = S.out; if (!o) { $('#main').innerHTML = '<header class="ph"><h1>Report</h1></header><section class="card"><p>Run the checks first.</p></section><footer class="pf"><button class="btn primary" data-go="run">Go to Run</button></footer>'; return; }
  const R = o.results, cnt = k => R.filter(r => r.status === k).length; const tab = S.ui.tab || 'checks';
  $('#main').innerHTML = `<header class="ph"><h1>Review report</h1><p>${esc(S.cfg.projectName)} · ${esc(S.xerName || '')} · data date ${E.fmtDate(S.M.dataDate)} · review ${S.cfg.reviewNo || S.history.length + 1}</p></header>
  <div class="tiles"><div class="tile bad"><b>${cnt('fail')}</b><span>Failed</span></div><div class="tile ok"><b>${cnt('pass')}</b><span>Passed</span></div><div class="tile"><b>${cnt('notrun')}</b><span>Not run</span></div><div class="tile info"><b>${cnt('info')}</b><span>Information</span></div></div>
  <nav class="tabs"><button class="${tab === 'checks' ? 'on' : ''}" data-tab="checks">Checks</button><button class="${tab === 'diagram' ? 'on' : ''}" data-tab="diagram">Programme overview</button><button class="${tab === 'ai' ? 'on' : ''}" data-tab="ai">AI reviews</button><button class="${tab === 'export' ? 'on' : ''}" data-tab="export">Export</button></nav>
  <div id="tab-body"></div>`;
  ({ checks: renderChecks, diagram: renderDiagram, ai: renderAi, export: renderExport })[tab]();
}
function renderChecks() {
  const R = S.out.results, f = S.ui.filter;
  const wasFail = r => { const l = S.history[S.history.length - 1]; return l && r.status === 'pass' && l.checks[r.id] && l.checks[r.id].status === 'fail'; };
  const show = r => f === 'all' || (f === 'fail' && (r.status === 'fail' || r.status === 'info' || wasFail(r))) || (f === 'notrun' && r.status === 'notrun');
  let h = (() => { const l = S.history[S.history.length - 1]; if (!l) return ''; let fx = 0, op = 0, nw = 0; R.forEach(r => { const p = l.checks[r.id]; if (r.status === 'fail') { p && p.status === 'fail' ? op++ : nw++; } else if (r.status === 'pass' && p && p.status === 'fail') fx++; }); return `<div class="card"><b>Compared with review ${l.rev} (${l.date}):</b> <span class="chip ok">${fx} fixed</span> <span class="chip open">${op} still open</span> <span class="chip new">${nw} new</span></div>`; })() + `<div class="chips"><button class="${f === 'fail' ? 'on' : ''}" data-filter="fail">Failures &amp; information</button><button class="${f === 'notrun' ? 'on' : ''}" data-filter="notrun">Not run</button><button class="${f === 'all' ? 'on' : ''}" data-filter="all">All checks</button></div>`;
  for (const g of GROUP_ORDER) {
    let rs = R.filter(r => r.group === g && show(r)); if (!rs.length) continue; rs = rs.slice().sort((a, b) => (b.tier === 'major') - (a.tier === 'major'));
    h += `<section class="grp"><h2>${g}</h2>`;
    for (const r of rs) h += `<article class="chk ${r.status}${r.status === 'fail' && S.held[r.id] ? ' held' : ''}" data-id="${r.id}">${r.status === 'fail' ? `<label class="inc"><input type="checkbox" data-inc="${r.id}" ${S.held[r.id] ? '' : 'checked'}> in contractor report</label>` : ''}<button class="chk-h" data-toggle="${r.id}">${chip(r)}<span class="cid">${r.id}</span><b>${esc(r.title)}</b>${r.tier === 'major' ? '<span class="chip major">Major</span>' : ''}${prevStatus(r)}<span class="cnt">${r.status === 'fail' && r.count ? fmtN(r.count) + (r.total ? ' <small>of ' + fmtN(r.total) + '</small>' : '') : ''}</span></button><p class="sum">${esc(r.summary || '')}</p>${r.status === 'notrun' ? fixButtons(r) : ''}<div class="chk-b" id="b-${r.id}" hidden></div></article>`;
    h += '</section>';
  }
  $('#tab-body').innerHTML = h || '<p>Nothing to show.</p>';
}
function checkBody(r) {
  const e = edit(r); const N = S.ui.limit && S.ui.limit[r.id] || 40; const items = r.items.slice(0, N);
  const flagged = r.id === 'L16' ? '' : '';
  return `<div class="det"><p><b>Requirement.</b> ${esc(r.rule)}${r.source ? ' <small class="mut">(' + esc(r.source) + ')</small>' : ''}</p>
  ${r.evidence.length ? '<ul class="ev">' + r.evidence.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}
  ${items.length ? `<div class="scroll"><table class="tbl compact"><thead><tr><th>ID</th><th>Name</th><th>WBS / reference</th><th>Issue</th><th>Value</th><th>Note</th></tr></thead><tbody>${items.map(i => `<tr><td class="nw">${esc(i.id)}</td><td>${esc(i.name)}</td><td class="mut">${esc(i.wbs)}</td><td>${esc(i.field)}</td><td>${esc(i.value)}</td><td class="mut">${esc(i.note)}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">Showing ${items.length} of ${fmtN(r.items.length)}. ${r.items.length > N ? '<a href="#" data-more="' + r.id + '">Show more</a> · ' : ''}The complete list is in the Excel appendix.</p>` : ''}
  ${r.status === 'fail' ? `<div class="grid"><label class="f"><span>Why it matters (editable, goes into the Word report)</span><textarea data-edit="${r.id}.why" rows="3">${esc(e.why)}</textarea></label><label class="f"><span>Action required (editable)</span><textarea data-edit="${r.id}.action" rows="3">${esc(e.action)}</textarea></label></div>` : ''}
  <div class="actions"><button class="btn sm" data-ask="${r.id}">Have Claude double-check this finding</button></div><div id="ask-${r.id}"></div></div>`;
}

/* ---------------- diagram ---------------- */
const COLS = [{ t: 'Engineering & approvals', cats: ['general', 'mobilization', 'engineering'] }, { t: 'Procurement & delivery', cats: ['procurement', 'delivery'] }, { t: 'Construction', cats: ['construction'] }, { t: 'Testing & handover', cats: ['closeout'] }];
function renderDiagram() {
  const d = diagramModel(); const sel = S.ui.diagZones || (d.zones.length > 9 ? d.zones.slice(0, 9) : d.zones);
  $('#tab-body').innerHTML = `<div class="card"><div class="actions"><b>Zones shown</b><div class="chk">${d.zones.map(z => `<label><input type="checkbox" data-dz="${esc(z)}" ${sel.includes(z) ? 'checked' : ''}> ${esc(z === 'General' ? 'Project-wide' : z)}</label>`).join('')}</div><span class="grow"></span><button class="btn sm" id="dg-svg">Download SVG</button><button class="btn sm" id="dg-png">Download PNG</button></div>
  <div id="dg-wrap" class="dg">${diagramSVG(sel)}</div><div id="dg-detail"></div></div>`;
}
function svgToPng(svg, scale) { return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); img.onload = () => { const cv = document.createElement('canvas'); cv.width = img.width * scale; cv.height = img.height * scale; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); cv.toBlob(b => res(b), 'image/png'); }; img.onerror = rej; img.src = url; }); }

/* ---------------- export tab ---------------- */
function renderExport() {
  const o = S.out, allFails = o.results.filter(r => r.status === 'fail'), fails = allFails.filter(r => !S.held[r.id]); const est = estimateCost('draft', fails.length * 3500, fails.length * 400);
  $('#tab-body').innerHTML = `<div class="card"><h2>Contractor review package</h2><div class="grid">${fld('Review number', 'reviewNo', 'int', `placeholder="${S.history.length + 1}"`)}${fld('Prepared by', 'preparedBy', 'text')}</div>
  <p class="hint"><b>${fails.length} of ${allFails.length} failed checks will be issued.</b> ${allFails.length - fails.length ? allFails.length - fails.length + ' held back (kept private, not in the Word or Excel files; shown as held back next time).' : ''} Tick or untick each one on the Checks tab, or: <button class="btn sm" id="inc-all">All</button> <button class="btn sm" id="inc-major">Major only</button> <button class="btn sm" id="inc-none">None</button><br> Comment numbers stay the same across resubmissions so the contractor can answer item by item.</p>
  <div class="actions"><button class="btn primary" id="x-word">Word report with response column</button><button class="btn primary" id="x-xlsx">Excel appendix (one sheet per comment)</button><button class="btn" id="x-both">Both</button></div></div>
  <div class="card"><h2>Wording</h2><p class="hint">The Word report uses fixed template wording that you can edit under each check (Checks tab). Claude can draft the wording from the findings instead – you still edit it.</p><div class="actions"><button class="btn" id="x-draft">Draft wording of all comments with Claude</button><small class="hint">${S.cfg.ai.on ? 'est. $' + est.toFixed(2) + ' with ' + modelFor('draft') : 'AI is off'}</small></div></div>
  <div class="card"><h2>Project file</h2><p class="hint">Saves this project's settings, confirmations, Eid dates and review history. Load it on another computer or for the next submission.</p><div class="actions"><button class="btn primary" id="x-bundle">Export full project (files + API key)</button><label class="btn" for="f-bundle">Import full project</label><input id="f-bundle" type="file" accept=".brt,.json" hidden><button class="btn" id="x-profile">Save settings only</button><label class="btn" for="f-profile">Load project file</label><input id="f-profile" type="file" accept=".json" hidden></div></div>`;
}
const SEV = r => r.tier === 'major' ? 0 : 1;
function orderedFails() { return S.out.results.filter(r => r.status === 'fail' && !S.held[r.id]).sort((a, b) => S.commentNo[a.id] - S.commentNo[b.id]); }
function recordHistory() { const o = S.out; const rev = +S.cfg.reviewNo || S.history.length + 1; const e = { rev, date: new Date().toISOString().slice(0, 10), file: S.xerName, dataDate: E.dayToStr(S.M.dataDate), checks: {} }; o.results.forEach(r => e.checks[r.id] = { status: r.status, count: r.count }); S.history = S.history.filter(h => h.rev !== rev); S.history.push(e); S.history.sort((a, b) => a.rev - b.rev); autosave(); }

async function exportXlsx() {
  const X = await lib('exceljs'); const wb = new X.Workbook(); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool'; wb.created = new Date();
  const hdr = ws => { const r = ws.getRow(ws._hdr || 1); r.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A41' } }; c.alignment = { vertical: 'middle', wrapText: true }; }); r.height = 22; };
  const fails = orderedFails(); const ix = wb.addWorksheet('Index', { views: [{ state: 'frozen', ySplit: 5 }] });
  ix.mergeCells('A1:H1'); ix.getCell('A1').value = 'Baseline programme review – appendix'; ix.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1B2A41' } };
  ix.getCell('A2').value = 'Project: ' + (S.cfg.projectName || '') + '   |   File: ' + (S.xerName || '') + '   |   Data date: ' + E.fmtDate(S.M.dataDate) + '   |   Review ' + (S.cfg.reviewNo || S.history.length + 1);
  ix.getCell('A3').value = 'Each sheet C<n> lists every affected activity for comment <n> of the review report. Please fill the last two columns and return the file with the revised baseline.'; ix.getCell('A3').font = { italic: true, color: { argb: 'FF5B6B7B' } };
  ix._hdr = 5; ix.getRow(5).values = ['Comment', 'Check', 'Group', 'Severity', 'Title', 'Affected', 'Sheet', 'Finding']; hdr(ix);
  ix.columns = [{ width: 10 }, { width: 8 }, { width: 20 }, { width: 10 }, { width: 58 }, { width: 10 }, { width: 10 }, { width: 70 }];
  fails.forEach(r => { const no = S.commentNo[r.id]; const has = r.items.length > 0; const row = ix.addRow(['C' + no, r.id, r.group, r.tier === 'major' ? 'Major' : 'Normal', r.title, r.count, has ? 'C' + no : '—', r.summary]); if (has) row.getCell(7).value = { text: 'C' + no, hyperlink: "#'C" + no + "'!A1" }; row.getCell(8).alignment = { wrapText: true, vertical: 'top' }; row.getCell(5).alignment = { wrapText: true, vertical: 'top' }; if (r.tier === 'major') row.getCell(4).font = { bold: true, color: { argb: 'FFB4412F' } }; });
  const nr = S.out.results.filter(r => r.status === 'notrun'); if (nr.length) { ix.addRow([]); const t = ix.addRow(['Not run / not provided']); t.font = { bold: true }; nr.forEach(r => ix.addRow(['', r.id, r.group, '', r.title, '', '', r.summary])); }
  const sheetFor = (name, r) => { const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] }); ws.mergeCells('A1:H1'); ws.getCell('A1').value = (name.startsWith('C') ? 'Comment ' + name.slice(1) + ' – ' : '') + r.title; ws.getCell('A1').font = { size: 13, bold: true, color: { argb: 'FF1B2A41' } }; ws.getCell('A2').value = r.rule; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6B7B' } };
    ws.getRow(3).values = ['ID', 'Activity / item', 'WBS / reference', 'Issue', 'Value', 'Note', 'Contractor status', 'Contractor response']; ws._hdr = 3; hdr(ws); ws.columns = [{ width: 26 }, { width: 62 }, { width: 46 }, { width: 28 }, { width: 34 }, { width: 34 }, { width: 18 }, { width: 40 }];
    r.items.forEach(i => ws.addRow([i.id, i.name, i.wbs, i.field, i.value, i.note, '', ''])); ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + r.items.length, column: 8 } };
    const dv = { type: 'list', allowBlank: true, formulae: ['"Corrected,Disputed,Will correct in next revision"'] }; for (let k = 4; k < 4 + Math.min(r.items.length, 20000); k++) ws.getCell('G' + k).dataValidation = dv; };
  fails.forEach(r => { if (r.items.length) sheetFor('C' + S.commentNo[r.id], r); });
  S.out.results.filter(r => r.status === 'info' && r.items.length).forEach(r => sheetFor(r.id + ' info', r));
  const buf = await wb.xlsx.writeBuffer(); download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (S.cfg.projectName || 'Project') + '_Review' + (S.cfg.reviewNo || S.history.length + 1) + '_Appendix.xlsx');
}

async function exportDocx() {
  const D = await lib('docx'); const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle, ImageRun, HeadingLevel, PageBreak, Footer, PageNumber, TableLayoutType } = D;
  const INK = '1B2A41', GREY = '5B6B7B'; const N = +S.cfg.examples || 3; const c = S.cfg;
  const P = (t, o) => new Paragraph(Object.assign({ spacing: { after: 80 }, children: [new TextRun({ text: String(t), size: 20, font: 'Calibri', ...(o && o.run) })] }, o && o.p));
  const B = (t) => P(t, { run: { bold: true } });
  const bullet = t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: String(t), size: 19, font: 'Calibri' })] });
  const bd = { style: BorderStyle.SINGLE, size: 4, color: 'C9D2DB' }; const borders = { top: bd, bottom: bd, left: bd, right: bd };
  const cell = (children, w, fill, span) => new TableCell({ children: Array.isArray(children) ? children : [children], width: { size: w, type: WidthType.DXA }, borders, shading: fill ? { type: ShadingType.CLEAR, fill } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, columnSpan: span });
  const tbl = (rows, cols) => new Table({ rows, columnWidths: cols, layout: TableLayoutType.FIXED, width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA } });
  const MAINW = [1800, 8106], SUBW = [1750, 3050, 1500, 1500];
  const fails = orderedFails(); const rev = c.reviewNo || S.history.length + 1; const ch = [];
  ch.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'BASELINE PROGRAMME REVIEW', size: 18, color: GREY, bold: true, font: 'Calibri', characterSpacing: 40 })] }));
  ch.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Review comments – Review ' + rev, size: 40, bold: true, color: INK, font: 'Calibri' })] }));
  const kv = [['Project', c.projectName || ''], ['Programme reviewed', (S.xerName || '') + ' (data date ' + E.fmtDate(S.M.dataDate) + ')'], ['Contract value', c.contractValue ? fmtN(c.contractValue) + ' SAR' : '—'], ['Contract duration / NTP', (c.durationValue ? c.durationValue + ' ' + c.durationUnit : '—') + ' / ' + (c.ntp ? E.fmtDate(E.strToDay(c.ntp)) : '—')], ['Date of review', E.fmtDate(Math.floor(Date.now() / 86400000))], ['Prepared by', c.preparedBy || '']];
  ch.push(tbl(kv.map(([a, b]) => new TableRow({ children: [cell(B(a), 2600, 'EEF2F6'), cell(P(b), 7306)] })), [2600, 7306]));
  const maj = fails.filter(r => r.tier === 'major').length; const clar = S.out.results.filter(r => r.status === 'info' && r.flag).length + S.out.results.filter(r => r.status === 'fail' && r.id === 'S2' && r.tier === 'minor').length; const missingDocs = S.out.results.filter(r => r.group === 'Submitted documents' && r.status === 'notrun');
  ch.push(new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: 'Summary', size: 28, bold: true, color: INK, font: 'Calibri' })] }));
  ch.push(P(`The submission was checked against the Contract, the BOQ and standard scheduling practice. ${fails.length} comments require correction (${maj} of them major). ${missingDocs.length} required document(s) were not provided. Please respond to every numbered comment in the response column and return this document with the revised baseline and the Excel appendix.`));
  if (S.history.length) { const last = S.history[S.history.length - 1]; const st = { fixed: 0, open: 0, nw: 0 }; S.out.results.forEach(r => { const p = last.checks[r.id]; if (r.status === 'fail') { if (p && p.status === 'fail') st.open++; else st.nw++; } else if (r.status === 'pass' && p && p.status === 'fail') st.fixed++; }); ch.push(P(`Compared with Review ${last.rev}: ${st.fixed} comment(s) fixed, ${st.open} still open, ${st.nw} new.`)); }
  ch.push(new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: '1. Required corrections', size: 28, bold: true, color: INK, font: 'Calibri' })] }));
  for (const r of fails) {
    const no = S.commentNo[r.id]; const e = edit(r); const ex = r.items.slice(0, N); const prev = (() => { const l = S.history[S.history.length - 1]; if (!l) return null; const p = l.checks[r.id]; return p && p.status === 'fail' ? 'Still open from Review ' + l.rev + ' (' + p.count + ' → ' + r.count + ')' : 'New in this review'; })();
    ch.push(new Paragraph({ spacing: { before: 200, after: 60 }, keepNext: true, children: [new TextRun({ text: `Comment ${no} – ${r.title}`, size: 23, bold: true, color: INK, font: 'Calibri' }), ...(r.tier === 'major' ? [new TextRun({ text: '   MAJOR', size: 17, bold: true, color: 'B4412F', font: 'Calibri' })] : [])] }));
    const rows = [];
    rows.push(new TableRow({ children: [cell(B('Requirement'), 1800, 'EEF2F6'), cell([P(r.rule), ...(r.source ? [P('Source: ' + r.source, { run: { color: GREY, italics: true, size: 18 } })] : [])], 8106)] }));
    rows.push(new TableRow({ children: [cell(B('Finding'), 1800, 'EEF2F6'), cell([P(r.summary || ''), ...r.evidence.slice(0, 12).map(bullet), ...(prev ? [P(prev, { run: { color: GREY, italics: true, size: 18 } })] : [])], 8106)] }));
    if (r.items.length) {
      const sub = tbl([new TableRow({ children: ['ID', 'Activity / item', 'Issue', 'Value'].map((h, i) => cell(P(h, { run: { bold: true, size: 17 } }), SUBW[i], 'F3F5F8')) }), ...ex.map(i => new TableRow({ children: [i.id, i.name, i.field, i.value].map((v, k) => cell(P(String(v).slice(0, 140), { run: { size: 17 } }), SUBW[k])) }))], SUBW);
      rows.push(new TableRow({ children: [cell(B('Affected activities'), 1800, 'EEF2F6'), cell([P(`${fmtN(r.count)} affected${r.total ? ' of ' + fmtN(r.total) : ''}. Examples:`), sub, P(`Full list: Excel appendix, sheet “C${no}” (${fmtN(r.items.length)} rows).`, { run: { bold: true, color: INK } })], 8106)] }));
    }
    rows.push(new TableRow({ children: [cell(B('Why it matters'), 1800, 'EEF2F6'), cell(P(e.why), 8106)] }));
    rows.push(new TableRow({ children: [cell(B('Action required'), 1800, 'EEF2F6'), cell(P(e.action), 8106)] }));
    rows.push(new TableRow({ children: [cell(B('Contractor response'), 1800, 'FFF8E1'), cell(P(' '), 8106, 'FFFDF3')] }));
    ch.push(tbl(rows, MAINW));
  }
  const clarify = S.out.results.filter(r => (r.status === 'info' && r.flag) || (r.status === 'fail' && r.tier === 'minor' && r.id === 'S2'));
  ch.push(new Paragraph({ spacing: { before: 300, after: 80 }, children: [new TextRun({ text: '2. Items to clarify', size: 28, bold: true, color: INK, font: 'Calibri' })] }));
  if (!clarify.length) ch.push(P('None.')); clarify.forEach(r => { ch.push(B(r.title)); ch.push(P(r.summary || '')); r.evidence.slice(0, 8).forEach(x => ch.push(bullet(x))); ch.push(P('Contractor to explain: ', { run: { italics: true, color: GREY } })); });
  ch.push(new Paragraph({ spacing: { before: 300, after: 80 }, children: [new TextRun({ text: '3. Documents not provided with the submission', size: 28, bold: true, color: INK, font: 'Calibri' })] }));
  if (!missingDocs.length) ch.push(P('All required documents were provided.')); else missingDocs.forEach(r => ch.push(bullet(r.title.replace(/ agrees with.*| reconcile.*| provided$/, '') + ' – ' + r.summary.replace('Not provided – ', ''))));
  try { const svg = diagramSVG(S.ui.diagZones); const png = await svgToPng(svg, 2); const buf = new Uint8Array(await png.arrayBuffer()); ch.push(new Paragraph({ children: [new PageBreak()] })); ch.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Appendix A – Programme overview as submitted', size: 28, bold: true, color: INK, font: 'Calibri' })] })); const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg); const w = 600, h = Math.round(w * m[2] / m[1]); ch.push(new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' })] })); } catch (e) { console.warn('diagram skipped', e); }
  const doc = new Document({ creator: c.preparedBy || 'Baseline Review Tool', title: 'Baseline programme review', sections: [{ properties: { page: { margin: { top: 1000, bottom: 900, left: 1000, right: 1000 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (c.projectName || '') + ' · Review ' + rev + ' · page ', size: 16, color: GREY, font: 'Calibri' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: 'Calibri' })] })] }) }, children: ch }] });
  const blob = await Packer.toBlob(doc); download(blob, (c.projectName || 'Project') + '_Review' + rev + '_Comments.docx');
  recordHistory();
}

async function draftAll() {
  if (!aiReady()) return; const fails = orderedFails(); const btn = $('#x-draft'); btn.disabled = true; let done = 0;
  const one = async r => { const ex = r.items.slice(0, 6).map(i => `${i.id} | ${i.name} | ${i.field} | ${i.value}`).join('\n');
    const t = await callClaude('draft', 'You write formal, concise review comments for a construction programme review sent by the Employer\'s project management consultant to the contractor. Plain language, no flattery, no bullets.', `Check: ${r.title}\nRequirement: ${r.rule}\nSource: ${r.source || '-'}\nFinding: ${r.summary}\nEvidence: ${r.evidence.slice(0, 8).join(' ; ')}\nExamples:\n${ex}\n\nReturn JSON {"why":"one or two sentences on why it matters for this project","action":"one or two sentences telling the contractor exactly what to do"}.`, 600);
    try { const j = parseJson(t); S.edits[r.id] = { why: j.why, action: j.action }; } catch (e) { } btn.textContent = `Drafting… ${++done}/${fails.length}`; };
  try { for (let i = 0; i < fails.length; i += 3) await Promise.all(fails.slice(i, i + 3).map(one)); toast('Wording drafted – review it under each check before sending.', 'ok'); } catch (e) { toast(e.message, 'bad'); }
  btn.disabled = false; btn.textContent = 'Draft wording of all comments with Claude';
}
function verifyContext(r) {
  const M = S.M, flagged = new Set(r.items.map(i => i.id)); const pick = (a, n) => { if (a.length <= n) return a; const st = a.length / n; return Array.from({ length: n }, (_, k) => a[Math.floor(k * st)]); };
  const fl = pick(r.items, 40).map(i => [i.id, i.name, i.wbs, i.field, i.value, i.note].join(' | '));
  const ok = pick(M.tasks.filter(t => !t.isMile && !flagged.has(t.code)), 25).map(t => [t.code, t.name, (M.wbs[t.wbs] || {}).pathStr || '', t.cat, 'dur ' + (t.durCal != null ? Math.round(t.durCal) : '?') + 'd', 'TF ' + (t.tfCal != null ? Math.round(t.tfCal) : '?') + 'd', (t.pred ? t.pred.length : '?') + ' pred', (t.succ ? t.succ.length : '?') + ' succ', (t.asg ? t.asg.length : '?') + ' resource assignments'].join(' | '));
  return `CHECK ${r.id}: ${r.title}\nREQUIREMENT: ${r.rule}\nTOOL RESULT: ${r.summary}\nEVIDENCE: ${r.evidence.join(' ; ')}\nTOTAL FLAGGED: ${r.items.length}${r.total ? ' of ' + r.total : ''}\n\nSAMPLE OF FLAGGED ITEMS (evenly spread through the list, code | name | WBS | issue | value | note):\n${fl.join('\n')}\n\nSAMPLE OF ACTIVITIES THE TOOL DID NOT FLAG:\n${ok.join('\n')}`;
}
const VERIFY_SYS = 'You are an experienced planning engineer double-checking an automated baseline-programme check for a PMC reviewer. Do not just agree. Test the tool\'s finding against the requirement and the data given: (1) say whether the finding looks correct, partly correct or not supported; (2) point out any flagged items that look like false positives and say why; (3) point out anything else in the data sample that breaches the requirement or looks wrong and was not flagged; (4) say what you could not verify from the sample. Be concise, use short headed paragraphs, name activity codes. You never change pass/fail; a person decides.';
async function askAbout(id) {
  if (!aiReady()) return; const r = S.out.results.find(x => x.id === id); const box = $('#ask-' + id);
  box.innerHTML = `<div id="qa-${id}" class="ans">Claude is double-checking this finding…</div><div class="actions"><input class="grow" id="q-${id}" placeholder="Follow-up question (optional)…"><button class="btn sm" id="qgo-${id}">Ask</button></div>`;
  const ctx = verifyContext(r); const a = $('#qa-' + id); let first = '';
  try { first = await callClaude('ask', VERIFY_SYS, ctx + '\n\nDouble-check this finding as instructed.', 1500); a.textContent = first; } catch (e) { a.textContent = e.message; return; }
  $('#qgo-' + id).onclick = async () => { const q = $('#q-' + id).value.trim(); if (!q) return; a.textContent += '\n\n— You: ' + q + '\n— Claude: thinking…'; try { const t = await callClaude('ask', VERIFY_SYS, ctx + '\n\nYOUR EARLIER REVIEW:\n' + first + '\n\nFollow-up question: ' + q, 900); first += '\n\nQ: ' + q + '\nA: ' + t; a.textContent = first; $('#q-' + id).value = ''; } catch (e) { a.textContent += '\n' + e.message; } };
}
