/* ===== APP PART 9: schedule comparison + quick-review project file ===== */
S.cmp = { A: null, B: null, res: null, more: {}, busy: false };
const cv = c => (c && typeof c === 'object') ? c.v : c;
const ccell = c => (c && typeof c === 'object') ? `<span class="t-${c.t || 'n'}">${esc(c.v)}</span>` : esc(c);

async function loadCmp(side, file) {
  toast('Reading ' + file.name + '…'); await sleep(30);
  try {
    const __x = await xerStage(file); const T = __x.T;
    if (!T.TASK || !T.PROJECT) throw new Error(file.name + ' does not look like a P6 XER file');
    const M = __x.M; S.cmp[side] = { M, name: file.name, file }; S.cmp.res = null; S.cmp.more = {};
    toast(file.name + ': ' + M.tasks.length + ' activities', 'ok'); runCmp();
  } catch (e) { console.error(e); toast(e.message, 'bad'); }
}
let cmpWorker = null, cmpToken = 0;
function cmpOpts() { return { nearCrit: S.cfg.nearCrit, cfg: JSON.parse(JSON.stringify(S.cfg, (k, v) => (k === 'ai' || k === 'docs' || k === 'boq') ? undefined : v)) }; }
function cmpInline() { try { S.cmp.res = E.compare(S.cmp.A.M, S.cmp.B.M, { nearCrit: S.cfg.nearCrit, cfg: S.cfg }); } catch (e) { console.error(e); toast('Comparison failed: ' + e.message, 'bad'); } }
function runCmp() {
  if (!(S.cmp.A && S.cmp.B)) { if (S.step === 'compare') viewCompare(); return; }
  const big = Math.max(S.cmp.A.M.tasks.length, S.cmp.B.M.tasks.length) > 3000;
  if (!big || typeof Worker === 'undefined' || typeof ENGINE_SRC === 'undefined') { cmpInline(); if (S.step === 'compare') viewCompare(); return; }
  /* v7.3: large schedules are compared in a background worker so the page stays responsive */
  const tok = ++cmpToken; S.cmp.busy = true; S.cmp.res = null; if (S.step === 'compare') viewCompare(); progress('Comparing the two schedules in the background…', 50);
  const fin = (res, err) => {
    if (tok !== cmpToken) return; S.cmp.busy = false; progress(null);
    if (err) { console.warn('worker compare failed, running in the page:', err); cmpInline(); } else S.cmp.res = res;
    if (S.step === 'compare') viewCompare();
  };
  try {
    if (cmpWorker) cmpWorker.terminate();
    const src = ENGINE_SRC + ';self.onmessage=e=>{try{const d=e.data;self.postMessage({res:E.compare(d.A,d.B,d.opt)})}catch(x){self.postMessage({error:String(x&&x.message||x)})}};';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); const w = cmpWorker = new Worker(url); URL.revokeObjectURL(url);
    w.onmessage = ev => { w.terminate(); if (cmpWorker === w) cmpWorker = null; fin(ev.data.res, ev.data.error); };
    w.onerror = ev => { w.terminate(); if (cmpWorker === w) cmpWorker = null; fin(null, ev.message || 'worker error'); };
    w.postMessage({ A: S.cmp.A.M, B: S.cmp.B.M, opt: cmpOpts() });
  } catch (e) { fin(null, e.message); }
}
const cmpSlot = (side, title, hint) => { const f = S.cmp[side]; const dz = drop('c-' + side, '.xer,.txt', false, f ? 'Replace this file' : 'Choose the XER');
  return `<div class="card" style="margin:0"><h2>${title} ${f ? qchip('Loaded', 'ok') : ''}</h2><p class="hint" style="margin-top:0">${hint}</p>
  ${f ? `<div class="kv" style="margin:0 0 12px"><span>File <b style="font-size:14px">${esc(f.name)}</b></span><span>Data date <b style="font-size:14px">${esc(E.fmtDate(f.M.dataDate))}</b></span><span>Activities <b style="font-size:14px">${fmtN(f.M.tasks.length)}</b></span><span>Finish <b style="font-size:14px">${esc(E.fmtDate(f.M.maxEF))}</b></span></div>` : ''}${dz}</div>`; };

function viewCompare() {
  const r = S.cmp.res;
  const dly = Object.assign({}, E.DELAY_DEFAULTS, E.UPD_DEFAULTS, S.cfg.delay || {}), dnum = (k, lab, w) => `<label class="f"><span>${lab}</span><input type="number" min="0" step="any" data-cdset="${k}" value="${dly[k]}" style="width:${w || 90}px"></label>`;
    $('#main').classList.add('wide'); let h = `<div class="split${r ? ' has-res' : ''}"><aside class="pane-in">
  <div class="actions stack" style="margin-top:0"><label class="btn" for="q-open">Open saved comparison</label><input type="file" id="q-open" accept=".brtq,.brt,.json" hidden>${S.cmp.A && S.cmp.B ? '<button class="btn primary" data-qsave="cmp">💾 Save comparison</button>' : ''}${S.cmp.A && S.cmp.B ? '<button class="btn" data-cswap="1">Swap previous ⇄ current</button>' : ''}${r && r.dly ? '<button class="btn primary" data-cx="brief:A">Executive brief – Classic (2 pages)</button><button class="btn primary" data-cx="brief:C">Executive brief – Narrative (1 page)</button><button class="btn primary" data-cx="report">Download report (Word)</button><button class="btn primary" data-cx="appendix">Download appendix (Excel)</button>' : ''}${r ? '<button class="btn primary" data-cx="xlsx">Download comparison (Excel)</button>' : ''}</div>
  ${cmpAiSwitch()}
  <details class="card" style="margin-bottom:14px" ${S.cmp.setOpen ? 'open' : ''}><summary><b>Delay analysis settings</b> <span class="hint">${dly.mode === 'base' ? 'Baseline vs update' : 'Update vs update'}</span></summary><div class="actions" style="align-items:flex-end;flex-wrap:wrap;gap:14px;margin-top:10px"><label class="f"><span>The previous schedule is</span><select data-cdset="mode"><option value="base" ${dly.mode === 'base' ? 'selected' : ''}>The baseline (compare with its planned dates)</option><option value="upd" ${dly.mode === 'upd' ? 'selected' : ''}>An earlier update (compare with its forecast dates)</option></select></label>${dnum('tolDays', 'A finish is late when more than (days)')}${dnum('accelCrewPct', 'Extra crews (%)')}${dnum('overlapPct', 'Overlap with the successor (% of the activity)')}${dnum('splitWd', 'Split activities longer than (working days)')}${dnum('minRemWd', 'Skip activities with less remaining than (working days)')}${dnum('topN', 'Rows per table in the report')}${dnum('pathGapWd', 'A link drives when its gap is at most (working days)')}${dnum('beiOk', 'BEI is acceptable from (0 to 1)')}${dnum('cpliOk', 'CPLI is acceptable from (0 to 1)')}${dnum('pctTolPct', 'Percent complete vs remaining: tolerance (% of original)')}${dnum('pctTolWd', 'Percent complete vs remaining: minimum tolerance (working days)')}<label class="f"><span>The request is addressed to</span><select data-cdset="audience">${E.AUDIENCES.map(([k, n]) => `<option value="${k}" ${dly.audience === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="f"><span>Reservation line added to the recovery request (editable)</span><textarea data-cdset="reservation" rows="3" style="min-width:420px">${esc(dly.reservation)}</textarea></label><label class="f"><span>Technical holds, never accelerated (words separated by |)</span><input data-cdset="holdWords" value="${esc(dly.holdWords)}" style="min-width:320px"></label></div></details>
  <div class="grid" style="grid-template-columns:1fr;gap:12px;margin-bottom:6px">${cmpSlot('A', 'Previous schedule', 'The baseline or the earlier update.')}${cmpSlot('B', 'Current schedule', 'The latest update to compare against it.')}</div></aside><div class="pane-out">`;
  if (!r) { $('#main').innerHTML = h + `<section class="card"><h2>Schedule comparison</h2><p class="hint">Load two XER files – the previous schedule (baseline or earlier update) and the current update. The tool lists every change between them, section by section.</p>${S.cmp.A || S.cmp.B ? '<p class="hint"><b>Load the second file to see the changes.</b></p>' : ''}</section></div></div>`; return; }
  const sec = k => r.sections.find(s => s.key === k), fact = (k, l) => { const s = sec(k); const f = s && s.facts.find(x => x.l === l); return f ? f.v : null; };
  const A = S.cmp.A.M, B = S.cmp.B.M, ov = r.overview, sg = n => (n > 0 ? '+' : '') + n;
  const hl = (title, big, sub, tone) => `<div class="vt ${tone || 'info'}"><span>${title}</span><b>${big}</b><small>${sub}</small></div>`;
  const fin = ov.finishDelta; const added = (sec('acts').blocks[0] || { rows: [] }).rows.length, deleted = (sec('acts').blocks[1] || { rows: [] }).rows.length;
  const critF = fact('crit', 'Critical activities'), budF = fact('res', 'Budget');
  h += `${r.delayError ? `<div class="warnbox">The delay and recovery sections could not be built (${esc(r.delayError)}). The rest of the comparison is unaffected.</div>` : ''}${sec('over').different ? `<div class="warnbox">Only ${sec('over').shared.n} activity IDs (${sec('over').shared.pct}% of the smaller file) appear in both files. They may be different projects; check that you loaded the right pair. P6 project IDs: “${esc(A.proj.proj_short_name || '')}” and “${esc(B.proj.proj_short_name || '')}”.</div>` : ''}
  <section class="card"><h2>What changed <small>${esc(S.cmp.A.name)} → ${esc(S.cmp.B.name)}</small></h2>
  <div class="verd">${hl('Project finish', fin === 0 ? 'No change' : sg(fin) + ' days', E.fmtDate(A.maxEF) + ' → ' + E.fmtDate(B.maxEF), fin > 0 ? 'bad' : fin < 0 ? 'ok' : 'info')}
  ${hl('Data date', ov.dataDelta == null ? '–' : sg(ov.dataDelta) + ' days', E.fmtDate(A.dataDate) + ' → ' + E.fmtDate(B.dataDate), 'info')}
  ${hl('Activities', '+' + fmtN(added) + ' / −' + fmtN(deleted), 'added / deleted', deleted ? 'bad' : 'info')}
  ${hl('Critical activities', critF ? cv(critF) : '–', 'total float ≤ 0', 'info')}
  ${hl('Budget (SAR)', budF ? cv(budF) : '–', 'previous → current', budF && budF.t ? budF.t : 'info')}
  ${hl('Total changes listed', fmtN(r.total), 'across ' + (r.sections.length - 1) + ' sections', r.total ? 'info' : 'ok')}</div>
  <div class="jump">${r.sections.map((s, i) => `<button data-cgo="${s.key}" class="${s.key !== 'over' && s.count ? 'has' : ''}">${i + 1}. ${esc(s.title)}${s.key !== 'over' ? ' <i>' + fmtN(s.count) + '</i>' : ''}</button>`).join('')}</div></section>`;
  h += cmpAiCard();
  r.sections.forEach((s, i) => {
    h += `<section class="card" id="cmp-${s.key}"><h2>${i + 1}. ${esc(s.title)} ${s.key === 'over' ? '' : (s.count ? qchip(fmtN(s.count) + ' change' + (s.count === 1 ? '' : 's'), '') : qchip('No changes', 'ok'))}</h2><p class="hint" style="margin-top:0">${esc(s.desc)}</p>`;
    if (s.facts.length) h += `<div class="facts">${s.facts.map(f => `<div><span>${esc(f.l)}</span><b>${ccell(f.v)}</b></div>`).join('')}</div>`;
    s.blocks.forEach((b, bi) => {
      if (b.title) h += `<h3 class="bt">${esc(b.title)} ${b.counts ? `<small>${fmtN(b.rows.length)}</small>` : ''}</h3>`;
      if (!b.rows.length) { h += `<p class="none">✓ ${b.note && b.counts ? 'No changes.' : (b.note || 'No changes.')}</p>`; return; }
      if (b.note) h += `<p class="hint" style="margin:0 0 8px">${esc(b.note)}</p>`;
      const key = s.key + '.' + bi, lim = S.cmp.more[key] || 50, rows = b.rows.slice(0, lim);
      h += qtbl(b.cols, rows.map(row => '<tr>' + row.map((c, ci) => `<td class="${b.num.includes(ci) ? 'n' : ''}${ci === 0 ? ' nw' : ''}">${ccell(c)}</td>`).join('') + '</tr>'), { num: b.num, h: 460 });
      if (b.rows.length > lim) h += `<div class="actions"><button class="btn sm" data-cmore="${key}">Show ${Math.min(200, b.rows.length - lim)} more</button><span class="hint">Showing ${fmtN(lim)} of ${fmtN(b.rows.length)} – the Excel download has all of them.</span></div>`;
    });
    h += `</section>`;
  });
  $('#main').innerHTML = h + '</div></div>';
}

async function cmpExport() {
  const r = S.cmp.res; if (!r) return; const X = await lib('exceljs'); const wb = new X.Workbook(); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool'; wb.created = new Date();
  const NAVY = 'FF1B2A41'; const hdr = (ws, n) => { const row = ws.getRow(n); row.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', wrapText: true }; }); row.height = 22; };
  const info = 'Previous: ' + S.cmp.A.name + ' (data date ' + E.fmtDate(S.cmp.A.M.dataDate) + ')   |   Current: ' + S.cmp.B.name + ' (data date ' + E.fmtDate(S.cmp.B.M.dataDate) + ')';
  const sm = wb.addWorksheet('Summary'); sm.mergeCells('A1:D1'); sm.getCell('A1').value = 'Schedule comparison – summary'; sm.getCell('A1').font = { size: 16, bold: true, color: { argb: NAVY } }; sm.getCell('A2').value = info; sm.getCell('A2').font = { italic: true, color: { argb: 'FF5B6B7B' } };
  sm.columns = [{ width: 8 }, { width: 44 }, { width: 14 }, { width: 80 }]; sm.getRow(4).values = ['No.', 'Section', 'Changes', 'Key facts']; hdr(sm, 4);
  r.sections.forEach((s, i) => sm.addRow([i + 1, s.title, s.key === 'over' ? '' : s.count, s.facts.map(f => f.l + ': ' + cv(f.v)).join('  ·  ')]));
  const used = new Set(['Summary']); const nm = (i, s, bi, t) => { let n = (i + 1) + '.' + (bi + 1) + ' ' + (t || s.title); n = n.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31); let k = 1, b = n; while (used.has(n)) n = b.slice(0, 28) + '~' + (k++); used.add(n); return n; };
  r.sections.forEach((s, i) => s.blocks.forEach((b, bi) => {
    if (!b.rows.length && s.key !== 'over') return; const ws = wb.addWorksheet(nm(i, s, bi, b.title || s.title), { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.mergeCells(1, 1, 1, Math.max(2, b.cols.length)); ws.getCell('A1').value = (i + 1) + '. ' + s.title + (b.title ? ' – ' + b.title : ''); ws.getCell('A1').font = { size: 14, bold: true, color: { argb: NAVY } }; ws.getCell('A2').value = info; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6B7B' } };
    ws.getRow(4).values = b.cols; hdr(ws, 4); ws.columns = b.cols.map((c, ci) => ({ width: ci === 1 && b.cols.length > 3 ? 56 : (/WBS|path/i.test(c) ? 44 : 20) }));
    b.rows.forEach(row => ws.addRow(row.map(cv))); if (b.rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + b.rows.length, column: b.cols.length } };
  }));
  const buf = await wb.xlsx.writeBuffer(); download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (S.cfg.projectName || (S.cmp.B.M.proj.proj_short_name || 'Project')) + '_Schedule_Comparison.xlsx');
}

/* ---------- save / open a quick-review or comparison project ---------- */
async function qkSave(kind) {
  try {
    if (kind === 'cmp' && !(S.cmp.A && S.cmp.B)) { toast('Load both schedules first.', 'bad'); return; }
    const b = { tool: 'baseline-review-tool-quick', version: 1, saved: new Date().toISOString(), step: S.step === 'compare' ? 'compare' : 'quick', profile: toProfile(), files: {} };
        const qm = {}; if (S.M && S.qk.measure) for (const [id, v] of Object.entries(S.qk.measure)) if (S.M.rsrc[id]) qm[S.M.rsrc[id].name] = v;
    b.qk = { tab: S.qk.tab, calView: S.qk.calView, codeFilter: S.qk.codeFilter, measureByName: qm };
    if (kind === 'cmp') { b.step = 'compare'; b.cmp = { ai: (S.cmp.ai && S.cmp.ai.sig === cmpAiSig()) ? S.cmp.ai : null, aiInc: S.cmp.aiInc !== false, previous: S.cmp.A.name, current: S.cmp.B.name }; }
    if (S.orig.xer && kind !== 'cmp') b.files.xer = await b64(S.orig.xer);
    if (S.cmp.A) b.files.cmpA = await b64(S.cmp.A.file); if (S.cmp.B) b.files.cmpB = await b64(S.cmp.B.file);
    if (S.dl.base && kind !== 'cmp') b.files.dlBase = await b64(S.dl.base.file); if (S.dl.ups.length && kind !== 'cmp') { b.files.dlUps = []; for (const u of S.dl.ups) b.files.dlUps.push(await b64(u.file)); }
    b.dl = { mode: S.dl.mode, target: S.dl.target, n: S.dl.n, min: S.dl.min, tags: S.dl.tags }; if (S.step === 'delay') b.step = 'delay';
    if (!b.files.xer && !b.files.cmpA && !b.files.cmpB && !b.files.dlBase && !(b.files.dlUps && b.files.dlUps.length)) { toast('Nothing to save yet – load an XER first.', 'bad'); return; }
    const blob = await gzipStr(JSON.stringify(b)); const nm1 = s => String(s || '').replace(/\.xer$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 40); download(blob, kind === 'cmp' ? (S.cfg.projectName || 'Project') + '_Comparison_' + nm1(S.cmp.A.name) + '_vs_' + nm1(S.cmp.B.name) + '_' + new Date().toISOString().slice(0, 10) + '.brtq' : (S.cfg.projectName || 'Project') + '_quick.brtq'); toast((kind === 'cmp' ? 'Comparison saved (' : 'Project saved (') + (blob.size / 1048576).toFixed(1) + ' MB) – includes the XER file(s)' + (kind === 'cmp' ? ', settings and any Claude review. Use “Open saved comparison” to recall it.' : '.'), 'ok');
  } catch (e) { console.error(e); toast(e.message, 'bad'); }
}
async function qkOpen(file) {
  try {
    const b = await readBundle(file);
    if (b && b.tool === 'baseline-review-tool-bundle') { await importBundle(file); go('quick'); return; }
    if (!b || b.tool !== 'baseline-review-tool-quick') throw new Error('This is not a project file from this tool.');
    toast('Restoring project…'); S.M = null; S.out = null; S.orig = { xer: null, boq: null, slots: {} }; S.cmp = { A: null, B: null, res: null, more: {}, busy: false }; S.dl = { base: null, ups: [], mode: 'A', target: '', n: 3, upSel: '', res: null, tags: {}, open: {}, busy: false };
    S.qk = Object.assign(S.qk, { q: null, rules: null, detail: null, measure: {}, pendingMeasure: (b.qk && b.qk.measureByName) || null });
    applyProfile(b.profile);
    if (b.files.xer) { await qLoadXer(unb64(b.files.xer), true); }
    if (b.files.cmpA) { const f = unb64(b.files.cmpA); const txt = new TextDecoder('windows-1252').decode(await readBuf(f)); S.cmp.A = { M: E.buildModel(E.parseXER(txt)), name: f.name, file: f }; }
    if (b.files.cmpB) { const f = unb64(b.files.cmpB); const txt = new TextDecoder('windows-1252').decode(await readBuf(f)); S.cmp.B = { M: E.buildModel(E.parseXER(txt)), name: f.name, file: f }; }
    if (S.cmp.A && S.cmp.B) S.cmp.res = E.compare(S.cmp.A.M, S.cmp.B.M, { nearCrit: S.cfg.nearCrit, cfg: S.cfg });
    if (b.dl) {
      S.dl = Object.assign({ base: null, ups: [], res: null, open: {}, upSel: '' }, { mode: b.dl.mode || 'A', target: b.dl.target || '', n: b.dl.n || 3, min: b.dl.min || 3, tags: b.dl.tags || {} });
      const rd = async f => { const txt = new TextDecoder('windows-1252').decode(await readBuf(f)); return { M: E.buildModel(E.parseXER(txt)), name: f.name, file: f }; };
      if (b.files.dlBase) S.dl.base = await rd(unb64(b.files.dlBase)); for (const x of (b.files.dlUps || [])) S.dl.ups.push(await rd(unb64(x)));
      S.dl.ups.sort((a, c) => (a.M.dataDate || 0) - (c.M.dataDate || 0)); S.step = 'delay'; runDl();
    }
    if (b.cmp && S.cmp.res) { S.cmp.ai = b.cmp.ai || null; S.cmp.aiInc = b.cmp.aiInc !== false; }
    if (b.qk) { S.qk.tab = b.qk.tab || 'over'; S.qk.calView = b.qk.calView || 'cat'; S.qk.codeFilter = b.qk.codeFilter || ''; }
    autosave(); go(b.step === 'delay' ? 'delay' : b.step === 'compare' || (!b.files.xer && (b.files.cmpA || b.files.cmpB)) ? 'compare' : 'quick'); toast('Project restored', 'ok');
  } catch (e) { console.error(e); toast(e.message, 'bad'); }
}

document.addEventListener('click', e => {
  const t = e.target; let el;
  if ((el = t.closest('[data-cgo]'))) { const d = document.getElementById('cmp-' + el.dataset.cgo); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if ((el = t.closest('[data-cmore]'))) { const k = el.dataset.cmore; S.cmp.more[k] = (S.cmp.more[k] || 50) + 200; const y = document.getElementById('main').scrollTop, wy = window.scrollY; viewCompare(); window.scrollTo(0, wy); return; }
  if (t.closest('[data-cswap]')) { const a = S.cmp.A; S.cmp.A = S.cmp.B; S.cmp.B = a; S.cmp.more = {}; runCmp(); return; }
  const bb = t.closest('[data-cx^="brief"]'); if (bb) { rpBrief(bb.dataset.cx.split(':')[1]).catch(err => { console.error(err); toast(err.message, 'bad'); }); return; }
  if (t.closest('[data-cx=report]')) { rpReport().catch(err => { console.error(err); toast(err.message, 'bad'); }); return; }
  if (t.closest('[data-cx=appendix]')) { rpAppendix().catch(err => { console.error(err); toast(err.message, 'bad'); }); return; }
  if (t.closest('[data-cx]')) { cmpExport().then(() => toast('Comparison Excel created', 'ok')).catch(err => { console.error(err); toast(err.message, 'bad'); }); return; }
  if ((el = t.closest('[data-qsave]'))) { qkSave(el.dataset.qsave === 'cmp' ? 'cmp' : undefined); return; }
});
document.addEventListener('change', e => {
  const el = e.target; if (el.type !== 'file' || !el.files.length) return;
  if (el.id === 'c-A') loadCmp('A', el.files[0]); else if (el.id === 'c-B') loadCmp('B', el.files[0]); else if (el.id === 'q-open') { qkOpen(el.files[0]); el.value = ''; }
});
document.addEventListener('drop', e => { const d = e.target.closest('.drop'); if (!d || !e.dataTransfer || !e.dataTransfer.files.length) return; if (d.querySelector('#c-A')) { e.preventDefault(); loadCmp('A', e.dataTransfer.files[0]); } else if (d.querySelector('#c-B')) { e.preventDefault(); loadCmp('B', e.dataTransfer.files[0]); } });

document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset || el.dataset.cdset === undefined) return; const k = el.dataset.cdset; S.cfg.delay = S.cfg.delay || {};
  if (k === 'mode' || k === 'holdWords' || k === 'reservation' || k === 'audience') { if (k === 'holdWords') { try { new RegExp(el.value); } catch (err) { toast('Not a valid word list', 'bad'); return; } } S.cfg.delay[k] = el.value; } else S.cfg.delay[k] = Math.max(0, +el.value || 0);
  S.cmp.setOpen = true; S.cmp.more = {}; autosave(); runCmp();
});
