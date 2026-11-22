/* ===== APP PART 2: screens – setup, files, confirm, run ===== */
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); const t = ks.reduce((a, k) => a[k] = a[k] || {}, o); t[l] = v; };
const fld = (label, path, type, extra) => { const v = getPath(S.cfg, path); return `<label class="f"><span>${label}</span><input data-p="${path}" data-t="${type || 'text'}" type="${type === 'num' ? 'number' : type === 'date' ? 'date' : type === 'password' ? 'password' : 'text'}" step="any" value="${esc(v == null ? '' : v)}" ${extra || ''}></label>`; };
const sel = (label, path, opts, extra) => { const v = getPath(S.cfg, path); return `<label class="f"><span>${label}</span><select data-p="${path}" data-t="str" ${extra || ''}>${opts.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(txt)}</option>`; }).join('')}</select></label>`; };
const STEPS = [['setup', 'Project setup'], ['files', 'Load files'], ['confirm', 'Confirmations'], ['run', 'Run checks'], ['report', 'Report']];
const durationDays = () => { const c = S.cfg; if (!c.durationValue) return null; return c.durationUnit === 'months' ? Math.round(c.durationValue * 30.4375) : +c.durationValue; };

const NAV_GROUPS = [
  ['Start', [['home', '⌂', 'Home']]],
  ['Review', [['portfolio', '☰', 'Portfolio triage'], ['quick', '⚡', 'Quick review · XER only']], 'full'],
  ['Compare and analyse', [['compare', '⇄', 'Schedule comparison'], ['delay', '⏱', 'Delay analysis'], ['recovery', '🛟', 'Recovery planner'], ['claims', '⚖', 'Claim review']]],
  ['Build and verify', [['builder', '🏗', 'Baseline builder'], ['roundtrip', '↔', 'P6 roundtrip check']]],
  ['About this tool', [['assess', '📋', 'Tool assessment']]]];
function navTitle() {
  for (const [g, items] of NAV_GROUPS) { const it = items.find(x => x[0] === S.step); if (it) return [g, it[2]]; }
  const st = STEPS.findIndex(x => x[0] === S.step); return ['Review / Full review', st >= 0 ? (st + 1) + ' · ' + STEPS[st][1] : ''];
}
function renderNav() {
  const done = { setup: !!S.cfg.projectName, files: !!S.M, confirm: !!S.M, run: !!S.out, report: !!S.out };
  const item = ([k, ic, t]) => `<button class="step ${S.step === k ? 'on' : ''}" data-go="${k}"><i>${ic}</i><span>${t}</span></button>`;
  $('#steps').innerHTML = NAV_GROUPS.map(([g, items, full]) => `<div class="sepl">${g}</div>` + items.map(item).join('') + (full ? `<div class="sepl sub">Full review</div>` + STEPS.map(([k, t], i) => `<button class="step ${S.step === k ? 'on' : ''} ${done[k] ? 'done' : ''}" data-go="${k}"><i>${i + 1}</i><span>${t}</span></button>`).join('') : '')).join('');
  $('#projname').textContent = S.cfg.projectName || 'New project';
  const [g, t] = navTitle(); $('#tb-group').textContent = g; $('#tb-title').textContent = t; $('#tb-proj').textContent = S.cfg.projectName || 'No project name';
  if (typeof drChip === 'function') drChip();
  const ai = !!(S.cfg.ai && (S.step === 'recovery' ? S.cfg.ai.rp === true : S.cfg.ai.cmp === true)), tg = $('#tb-ai'), live = S.step === 'recovery' || S.step === 'compare';
  tg.innerHTML = '<span class="tsw"></span>AI'; tg.className = 'tbchip tbai' + (ai ? ' on' : '') + (live ? '' : ' ro'); tg.setAttribute('aria-checked', String(ai)); tg.title = live ? 'Claude AI for this page: ' + (ai ? 'on' : 'off') + ' (click to switch)' : 'AI switch is on the Schedule comparison and Recovery planner pages';
}
function go(step) { S.step = step; $('#main').classList.remove('wide'); renderNav(); const f = { home: viewHome, setup: viewSetup, files: viewFiles, confirm: viewConfirm, run: viewRun, report: viewReport, quick: viewQuick, portfolio: viewPortfolio, compare: viewCompare, delay: viewDelay, builder: viewBuilder, claims: viewClaims, roundtrip: viewRoundtrip, assess: viewAssess, recovery: viewRecovery }[step]; $('#main').scrollTop = 0; window.scrollTo(0, 0); f(); }

/* ---------------- 1. SETUP ---------------- */
function viewSetup() {
  const c = S.cfg; const wsum = Object.values(c.weights).reduce((a, b) => a + (+b || 0), 0); const dd = durationDays();
  const sug1 = 2 * (+c.reportingPeriod || 30), sug2 = dd ? Math.round(dd * 0.1) : null;
  $('#main').innerHTML = `
  <header class="ph"><h1>Project setup</h1><p>Enter the contract facts once. Everything has a sensible default; all limits are in whole calendar days.</p></header>
  ${(() => { let keys = []; try { keys = Object.keys(localStorage).filter(k => k.startsWith('brt.profile.')); } catch (e) { } return keys.length ? `<section class="card"><h2>Open a saved project</h2><div class="actions"><select id="open-proj" style="max-width:360px">${keys.map(k => `<option value="${esc(k)}">${esc(k.slice(12))}</option>`).join('')}</select><button class="btn" id="open-proj-go">Open</button><small class="hint">Settings, confirmations and review history are saved in this browser automatically. Load the XER again afterwards.</small></div></section>` : ''; })()}
  <section class="card"><h2>Project &amp; contract</h2><div class="grid">
    ${fld('Project name', 'projectName', 'text', 'placeholder="e.g. P0076-CNT1569"')}${fld('Project number (optional, for the Drive folder name)', 'projectNo', 'text', 'placeholder="e.g. P0076"')}
    ${fld('Contract value (SAR)', 'contractValue', 'num')}
    <label class="f"><span>Contract duration</span><span class="inl"><input data-p="durationValue" data-t="num" type="number" step="any" value="${esc(c.durationValue || '')}"><select data-p="durationUnit" data-t="str"><option value="months" ${c.durationUnit === 'months' ? 'selected' : ''}>months</option><option value="days" ${c.durationUnit === 'days' ? 'selected' : ''}>days</option></select></span></label>
    ${fld('Notice to proceed / commencement date', 'ntp', 'date')}
    ${fld('Contract review period for submittals (days)', 'reviewDays', 'num')}
    ${fld('Name of the contract conditions in citations (e.g. Particular Conditions)', 'srcPC', 'text', 'placeholder="Particular Conditions"')}
    ${fld('Calendar clause cited in calendar checks (e.g. Particular Conditions A8.2)', 'calClause', 'text', 'placeholder="Particular Conditions A8.2"')}
    ${fld('Approving party named in approval checks (e.g. KEC / authority)', 'approverLabel', 'text', 'placeholder="KEC / authority"')}
    ${fld('Contract clause on float ownership (optional, quoted in check T2)', 'floatClause', 'text', 'placeholder="leave empty if the contract has none"')}
    ${sel('Project type', 'projectType', [['infrastructure', 'Infrastructure (labour + equipment required)'], ['buildings', 'Buildings (labour only)']])}
    ${sel('File being reviewed', 'fileType', [['baseline', 'Baseline submission'], ['update', 'Progress update']])}
  </div></section>
  <section class="card"><h2>Phase weights <small>${wsum === 100 ? '' : '<b class="bad">add up to ' + wsum + '%, must be 100%</b>'}</small></h2><div class="grid g4">
    ${fld('Engineering % (incl. mobilization)', 'weights.engineering', 'num')}${fld('Procurement %', 'weights.procurement', 'num')}${fld('Construction %', 'weights.construction', 'num')}${fld('Handover %', 'weights.handover', 'num')}
  </div></section>
  <section class="card"><h2>Limits &amp; tolerances</h2><div class="grid">
    ${fld('Reporting period (days)', 'reportingPeriod', 'num')}
    <div class="f"><span>Float limit (calendar days)</span><span class="inl"><input data-p="floatLimit" data-t="int" type="number" value="${esc(c.floatLimit)}"></span><em class="sug">Suggest: <a href="#" data-set="floatLimit" data-v="${sug1}">2 reporting periods = ${sug1}</a>${sug2 ? ' · <a href="#" data-set="floatLimit" data-v="' + sug2 + '">10% of duration = ' + sug2 + '</a>' : ''}</em></div>
    <div class="f"><span>Activity duration limit (calendar days)</span><span class="inl"><input data-p="durLimit" data-t="int" type="number" value="${esc(c.durLimit)}"></span><em class="sug">Suggest: <a href="#" data-set="durLimit" data-v="${sug1}">2 reporting periods = ${sug1}</a>${sug2 ? ' · <a href="#" data-set="durLimit" data-v="' + sug2 + '">10% of duration = ' + sug2 + '</a>' : ''}</em></div>
    <label class="sw"><input type="checkbox" data-p="fridayOff" data-t="bool" ${c.fridayOff === false ? '' : 'checked'}><span>Friday is the weekly rest day (flag calendars that work Fridays)</span></label>
    <label class="sw"><input type="checkbox" data-p="navTips" data-t="bool" ${c.navTips === false ? '' : 'checked'}><span>Show a short note when hovering a menu item (touch and hold on a phone)</span></label>
    <label class="sw"><input type="checkbox" data-p="ramadanNormal" data-t="bool" ${c.ramadanNormal === false ? '' : 'checked'}><span>Treat Ramadan as normal working days (reduced Ramadan hours are ignored)</span></label>
    <div class="f"><span>Standard working day (hours)</span><span class="inl"><input data-p="stdDayHr" data-t="num" type="number" step="0.5" value="${esc(c.stdDayHr == null ? 8 : c.stdDayHr)}"></span><em class="sug">Calendars with a different day length are flagged (check L10d).</em></div>
    <div class="f"><span>Maximum weekly hours per calendar</span><span class="inl"><input data-p="maxWeekHr" data-t="int" type="number" value="${esc(c.maxWeekHr == null ? 60 : c.maxWeekHr)}"></span><em class="sug">Calendars above this are flagged (check L10d).</em></div>
    ${fld('Comparison: same project if this % of activity IDs match', 'cmpMinShared', 'int')}${fld('Recovery planner: number of paths to trace (1 to 30)', 'rpPaths', 'int')}${fld('Recovery planner: charts panel width, % of the page (30 to 75)', 'rpLeftPct', 'int')}${fld('Recovery planner: chart label width, px (90 to 360)', 'rpLabW', 'int')}${fld('Recovery planner: chart zoom, % (100 to 250)', 'rpZoom', 'int')}${fld('Recovery planner: stage card design (A = tiles, B = labelled rows, C = compact)', 'rpCard', 'text')}${fld('Recovery planner: data date in Parallel plots (align = paths lined up on one line, mark = a mark on each path, none = Logic Gantt only)', 'rpDDMode', 'text')}${fld('Recovery planner: activities per line in an opened card (3 to 30)', 'rpOpenPer', 'int')}${fld('Recovery planner, P6 view: width of one month in the Gantt, px (12 to 120)', 'rp6MonthW', 'int')}${fld('Menu note: delay before it shows (ms)', 'navTipDelay', 'int')}${fld('Max. lag on FS links (days)', 'maxFsLag', 'int')}${fld('Near-critical threshold (days)', 'nearCrit', 'int')}${fld('Output check: flag when beyond × of type median', 'outputFactor', 'num')}${fld('Progress curve: time point (% of duration)', 'curveTimePct', 'num')}${fld('…remaining progress after it must not exceed (%)', 'curveRemainMax', 'num')}${fld('Centre of gravity must not be later than (% of duration)', 'curveCgMax', 'num')}${fld('Monthly progress ceiling (× average month)', 'curveMonthMult', 'num')}${fld('Front-loading: time point (% of duration)', 'loadFrontPct', 'num')}${fld('…budget earned by it must not exceed (%)', 'loadFrontMax', 'num')}${fld('Centre of gravity must not be earlier than (% of duration)', 'loadCgMin', 'num')}${fld('Start-date tolerance (days)', 'ntpTol', 'int')}${fld('Finish / milestone tolerance (days)', 'finishTol', 'int')}
    ${fld('Cost / total tolerance (%)', 'costTol', 'num')}${fld('Phase-weight tolerance (percentage points)', 'weightTol', 'num')}${fld('Monthly curve tolerance (%)', 'curveTol', 'num')}${fld('Examples per comment in Word report', 'examples', 'int')}
  </div></section>
  <section class="card"><h2>Working week by category</h2><p class="hint">Days per week the calendar must have. Categories come from the WBS (Confirmations).</p><div class="grid g4">
    ${['construction', 'engineering', 'mobilization', 'closeout', 'general', 'procurement', 'delivery', 'approval'].map(k => `<label class="f"><span>${({ approval: (esc(S.cfg.approverLabel || 'KEC / authority') + ' approvals (Fri &amp; Sat off)'), delivery: 'Material delivery', closeout: 'Close-out / handover', general: 'General' })[k] || k[0].toUpperCase() + k.slice(1)}</span><select data-p="calRules.${k}" data-t="int">${[5, 6, 7].map(n => `<option ${c.calRules[k] === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`).join('')}
  </div></section>
  ${svCard()}
  <section class="card"><h2>AI assistance <small>optional – never decides pass / fail</small></h2>
    <label class="sw"><input type="checkbox" data-p="ai.on" data-t="bool" ${c.ai.on ? 'checked' : ''}><span>Use Claude for this project</span></label>
    <div class="aiopts ${c.ai.on ? '' : 'off'}"><div class="grid">${fld('Claude API key (kept only while this page is open unless you tick Remember)', 'ai.key', 'password', 'autocomplete="off"')}</div>
    <label class="sw"><input type="checkbox" data-p="ai.proxy" data-t="bool" ${c.ai.proxy !== false ? 'checked' : ''}><span>Use the server proxy when the site offers it (the Claude key stays on the server, nothing to paste). Status: <b>${S.aiProxy === true ? 'proxy available on this site' : 'no proxy here, your own key is used'}</b></span></label>
    <label class="sw"><input type="checkbox" data-p="ai.rp" data-t="bool" ${c.ai.rp ? 'checked' : ''}><span>Use Claude in the Recovery planner (off by default; second opinion on causes, levers and wording, never a number)</span></label>
    <label class="sw"><input type="checkbox" data-p="ai.remember" data-t="bool" ${c.ai.remember ? 'checked' : ''}><span>Remember the key in this browser (off = forgotten when the page closes; do not tick on a shared computer)</span></label>
    <label class="sw"><input type="checkbox" data-p="ai.consent" data-t="bool" ${c.ai.consent ? 'checked' : ''}><span>I agree that when I run a Claude step, what that step reads is sent from this browser to Anthropic. Depending on the step this can be: contract text, BOQ pages (including rates and amounts), a layout drawing as an image, the programme narrative, activity names, codes, dates and days. Check that your Employer allows this first. Nothing is sent otherwise. Each step shows its estimated cost first.</span></label>
    <label class="f" style="max-width:420px"><span>Claude model for all AI steps</span><select data-p="ai.modelAll" data-t="text"><option value="">Automatic: each step uses its recommended model</option>${[['claude-haiku-5-5', 'Haiku 5.5: fastest and cheapest'], ['claude-sonnet-5-5', 'Sonnet 5.5: balanced'], ['claude-opus-5-5', 'Opus 5.5: most thorough, highest cost']].map(m => `<option value="${m[0]}" ${c.ai.modelAll === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></label>
    <p class="hint">Your choice applies to every AI step. A model typed in the table below for one step still wins for that step.</p>
    <table class="tbl compact"><thead><tr><th>Task</th><th>Model</th></tr></thead><tbody>${AI_TASKS.map(t => `<tr><td>${t.label}</td><td><input list="models" data-aim="${t.id}" value="${esc(modelFor(t.id))}"></td></tr>`).join('')}</tbody></table>
    <datalist id="models">${MODEL_LIST.map(m => `<option value="${m}">`).join('')}</datalist>
    <p class="hint">Type any model name to use a newer release. Estimated cost is shown before each AI step. Prices used for estimates (USD per million tokens, in/out): ${Object.entries(c.ai.prices || PRICE_DEF).map(([k, v]) => k + ' ' + v.join('/')).join(' · ')}.</p></div>
  </section>
  <footer class="pf"><button class="btn primary" data-go="files">Next: load files →</button></footer>`;
}

/* ---------------- 2. FILES ---------------- */
const DOC_SLOTS = [
  { k: 'scurve', t: 'Progress S-curve', d: 'Excel · checked against the progress resource', kind: 'curve' },
  { k: 'cashflow', t: 'Cash flow', d: 'Excel · checked against the cost resource units', kind: 'curve' },
  { k: 'manpower', t: 'Manpower histogram', d: 'Excel · checked against labour units', kind: 'curve' },
  { k: 'rescalc', t: 'Resource calculations (labour & equipment)', d: 'Excel · activity ID, duration, hours', kind: 'rescalc' },
  { k: 'mapping', t: 'BOQ mapping sheet', d: 'Excel · BOQ item → activity ID', kind: 'mapping' },
  { k: 'narrative', t: 'Baseline narrative report', d: 'PDF / Word / text', kind: 'narr' },
  { k: 'layout', t: 'General layout (zones & roads)', d: 'PDF / image · read by Claude or typed', kind: 'layout' }
];
const slotState = k => S.files[k] ? `<span class="chip ok">✓ ${esc(S.files[k])}</span>` : `<span class="chip">Not provided</span>`;
function drop(id, accept, multiple, label) { return `<label class="drop" data-drop="${id}"><input type="file" id="${id}" accept="${accept}" ${multiple ? 'multiple' : ''} hidden><b>${label}</b><small>or drop the file here</small></label>`; }
function viewFiles() {
  const M = S.M;
  $('#main').innerHTML = `
  <header class="ph"><h1>Load files</h1><p>Everything is read locally in your browser. Only AI steps you start send text to Claude.</p></header>
  <section class="card"><h2>Schedule (XER) ${slotState('xer')}</h2>${drop('f-xer', '.xer,.txt', false, 'Choose the P6 XER file')}
    ${M ? `<div class="kv"><div><b>${M.tasks.length.toLocaleString()}</b> activities</div><div><b>${M.links.length.toLocaleString()}</b> relationships</div><div><b>${Object.keys(M.cal).length}</b> calendars</div><div>Data date <b>${E.fmtDate(M.dataDate)}</b></div><div>Start <b>${E.fmtDate(M.minES)}</b></div><div>Finish <b>${E.fmtDate(M.maxEF)}</b></div></div>` : ''}</section>
  <section class="card"><h2>Bill of Quantities ${slotState('boq')}</h2><p class="hint">Excel is exact. A PDF BOQ needs AI (and OCR if scanned) and should be reviewed after reading.</p>${drop('f-boq', '.xlsx,.xls,.csv,.pdf', false, 'Choose the BOQ (Excel or PDF)')}<div id="boq-map"></div></section>
  <section class="card"><h2>Contract documents <small>Agreement · Particular &amp; General Conditions · Scope of Work</small></h2>${drop('f-contract', '.pdf', true, 'Choose contract PDFs')}
    <div id="contract-list">${(S.raw.contract || []).map(c => `<div class="row">📄 ${esc(c.name)} <small>${c.pages ? c.pages.length + ' pages' + (c.pages.filter(p => p.scanned && !p.ocr).length ? ' · ' + c.pages.filter(p => p.scanned && !p.ocr).length + ' scanned (no text)' : '') : 'reading…'}</small></div>`).join('')}</div>
    <div class="actions"><label class="sw sm"><input type="checkbox" id="ocr-on" ${S.ocr ? 'checked' : ''}><span>OCR scanned pages (slower, loads Tesseract)</span></label>
    <button class="btn" id="btn-contract-ai">Read key terms with Claude</button><small id="contract-est" class="hint"></small></div><div id="contract-out"></div></section>
  <section class="card"><h2>Documents submitted with the baseline</h2><div class="slots">${DOC_SLOTS.map(s => `<div class="slot"><div class="sh"><b>${s.t}</b>${slotState(s.k)}</div><small>${s.d}</small>${drop('f-' + s.k, s.kind === 'narr' ? '.pdf,.docx,.txt' : s.kind === 'layout' ? '.pdf,.png,.jpg,.jpeg' : '.xlsx,.xls,.csv', false, 'Choose file')}<div id="slot-${s.k}"></div></div>`).join('')}</div></section>
  <footer class="pf"><button class="btn" data-go="setup">← Setup</button><button class="btn primary" data-go="confirm" ${M ? '' : 'disabled'}>Next: confirmations →</button></footer>`;
  if (S.raw.boqRows) renderBoqMap(); DOC_SLOTS.forEach(s => renderSlot(s.k)); updateContractEst();
}
function updateContractEst() { const el = $('#contract-est'); if (!el || !S.raw.contract) return; const ch = relevantContractText().length; el.textContent = S.cfg.ai.on ? `≈ ${(ch / 4 / 1000).toFixed(0)}k tokens · est. $${estimateCost('read_contract', ch, 1500).toFixed(2)} with ${modelFor('read_contract')}` : 'AI is off'; }

async function loadXER(file) {
  toast('Reading XER…'); await sleep(30);
  try {
    const __x = await xerStage(file); const T = __x.T;
    if (!T.TASK || !T.PROJECT) throw new Error('This does not look like a P6 XER file');
    const M = __x.M; S.M = M; S.files.xer = file.name; S.xerName = file.name;
    S.cfg.wbsMap = E.suggestWbsMap(M); S.cfg.approvalIds = null; S.cfg.rsrc = E.suggestResources(M); S.cfg.projFinishId = null;
    if (!S.cfg.projectName) S.cfg.projectName = (M.proj.proj_short_name || '').replace(/-\d+$/, '') || file.name.replace(/\.xer$/i, '');
    const saved = LS.get('brt.profile.' + S.cfg.projectName, null); if (saved && !S.pendingProfile) { try { applyProfile(saved); toast('Settings for "' + S.cfg.projectName + '" restored'); } catch (e) { } }
    if (S.pendingProfile) resolveProfile();
    if (!S.cfg.wbsMap || !Object.keys(S.cfg.wbsMap).length) S.cfg.wbsMap = E.suggestWbsMap(M);
    if (!S.cfg.rsrc || (!S.cfg.rsrc.progress && !S.cfg.rsrc.cost)) S.cfg.rsrc = E.suggestResources(M);
    E.applyCategories(M, S.cfg.wbsMap); if (!S.cfg.approvalIds || !S.cfg.approvalIds.length) S.cfg.approvalIds = E.suggestApprovals(M, S.cfg.approvalExclude); S.out = null; renderNav(); viewFiles(); autosave(); toast('XER loaded: ' + M.tasks.length + ' activities', 'ok');
  } catch (e) { toast(e.message, 'bad'); }
}

/* --- BOQ --- */
async function loadBoq(file) {
  try {
    if (/\.pdf$/i.test(file.name)) {
      S.files.boq = file.name; S.raw.boqPdf = file; viewFiles(); const box = $('#boq-map');
      const est = estimateCost('read_boq', file.size * 0.4, 8000);
      box.innerHTML = `<p class="hint">PDF BOQ: Claude will read it page by page (≈ est. $${est.toFixed(2)} – depends on pages) and return rows you can check.</p><button class="btn" id="btn-boq-ai">Read BOQ with Claude</button><span id="boq-prog" class="hint"></span>`; return;
    }
    const sheets = await readSheetRows(file); S.files.boq = file.name; S.raw.boqSheets = sheets; const first = Object.keys(sheets)[0]; S.raw.boqSheet = first; S.raw.boqRows = sheets[first]; S.raw.boqCol = E.guessBoqColumns(S.raw.boqRows); viewFiles(); applyBoq();
  } catch (e) { toast(e.message, 'bad'); }
}
function renderBoqMap() {
  const rows = S.raw.boqRows, col = S.raw.boqCol; if (!rows) return; const hdr = (rows[col.header] || []).map((h, i) => [i, String(h || ('col ' + (i + 1)))]);
  const pick = (k, label) => `<label class="f"><span>${label}</span><select data-boq="${k}"><option value="-1">(none)</option>${hdr.map(([i, h]) => `<option value="${i}" ${col[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
  $('#boq-map').innerHTML = `<div class="grid g4"><label class="f"><span>Sheet</span><select id="boq-sheet">${Object.keys(S.raw.boqSheets).map(n => `<option ${n === S.raw.boqSheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
  <label class="f"><span>Header row #</span><input id="boq-hdr" type="number" value="${col.header + 1}"></label>${pick('item', 'Item no.')}${pick('desc', 'Description')}${pick('qty', 'Quantity')}${pick('amount', 'Amount')}${pick('part', 'Part / section')}</div>
  <div class="kv" id="boq-sum"></div>`;
  applyBoq(true);
}
function applyBoq(noRender) {
  const rows = S.raw.boqRows, col = S.raw.boqCol; if (!rows || col.header < 0 || col.amount < 0 || col.item < 0) { if (!noRender) renderBoqMap(); return; }
  S.cfg.boq = E.readBoq(rows, col); const b = S.cfg.boq; const el = $('#boq-sum'); if (el) el.innerHTML = `<div><b>${b.items.length}</b> BOQ items</div><div>Total <b>${fmtN(b.total)}</b></div>${S.cfg.contractValue ? '<div>Contract value <b>' + fmtN(S.cfg.contractValue) + '</b></div>' : ''}`;
  if (!noRender && !$('#boq-sum')) renderBoqMap();
}

/* --- contract PDFs --- */
const KEYS = /commence|notice to proceed|time for completion|completion|contract price|contract sum|accepted contract|milestone|review|within \d+|calendar days|days after|programme|program\b|submittal|approval|working days|rest day|holiday|particular|appendix to|contract data/i;
function relevantContractText() {
  let out = ''; (S.raw.contract || []).forEach(c => (c.pages || []).forEach(p => { if (KEYS.test(p.text) && p.text.length > 100) out += `\n[${c.name} p.${p.n}]\n${p.text}`; })); return out;
}
async function loadContract(files) { S.contractFound = null;
  S.raw.contract = S.raw.contract || []; S.files.contract = files.length + ' file(s)'; S.ocr = $('#ocr-on') ? $('#ocr-on').checked : S.ocr;
  for (const f of files) { const rec = { name: f.name, pages: null }; S.raw.contract.push(rec); viewFiles(); try { rec.pages = await pdfPages(f, (i, n) => { const el = $('#contract-list .row:last-child small'); if (el) el.textContent = i + ' / ' + n + ' pages…'; }, { ocr: S.ocr }); } catch (e) { toast(f.name + ': ' + e.message, 'bad'); rec.pages = []; } viewFiles(); }
}
async function contractAI() {
  if (!aiReady()) return; const all = relevantContractText(); if (!all.trim()) return toast('No readable text found. Tick OCR and reload the PDFs, or enter the three values manually in Setup.', 'warn');
  const btn = $('#btn-contract-ai'); btn.disabled = true; btn.textContent = 'Reading…';
  try {
    const chunks = []; const parts = all.split(/\n(?=\[)/); let cur = ''; for (const p of parts) { if ((cur + p).length > 24000) { chunks.push(cur); cur = ''; } cur += '\n' + p; } if (cur.trim()) chunks.push(cur);
    const sys = 'You extract facts from construction contract documents. Reply with JSON only. Never guess: use null when a value is not stated. For every value give the exact quote and the source tag shown in brackets, e.g. "[file p.12]".';
    const q = 'Return JSON: {"contractValue":{"value":number|null,"currency":string|null,"quote":string,"source":string},"duration":{"value":number|null,"unit":"months"|"days"|null,"quote":string,"source":string},"commencement":{"date":"YYYY-MM-DD"|null,"quote":string,"source":string},"reviewPeriodDays":{"value":number|null,"quote":string,"source":string},"milestones":[{"name":string,"days":number|null,"date":"YYYY-MM-DD"|null,"quote":string,"source":string}],"workingWeek":{"quote":string,"source":string}}';
    const res = []; for (const ch of chunks) { const t = await callClaude('read_contract', sys, q + '\n\nDOCUMENT TEXT:\n' + ch, 2500); res.push(parseJson(t)); }
    const first = k => res.map(r => r[k]).find(x => x && (x.value != null || x.date != null));
    const c = S.cfg, pick = {}; const cv = first('contractValue'), du = first('duration'), cm = first('commencement'), rv = first('reviewPeriodDays');
    if (cv) { c.contractValue = cv.value; pick.contractValue = cv; } if (du) { c.durationValue = du.value; c.durationUnit = du.unit || 'months'; pick.duration = du; } if (cm && cm.date) { c.ntp = cm.date; pick.commencement = cm; } if (rv) { c.reviewDays = rv.value; pick.reviewDays = rv; }
    const ms = res.flatMap(r => r.milestones || []).filter(m => m.name && (m.days != null || m.date)); if (ms.length) { c.milestones = ms.map(m => ({ name: m.name, days: m.days, date: m.date, actId: null, quote: m.quote, source: m.source })); }
    c.clauses = pick; autosave();
    $('#contract-out').innerHTML = `<div class="found"><b>Claude found these – please verify against the quotes, then edit in Setup / Confirmations if needed:</b><table class="tbl compact"><tbody>${Object.entries(pick).map(([k, v]) => `<tr><td>${k}</td><td><b>${esc(v.value != null ? v.value + (v.unit ? ' ' + v.unit : '') + (v.currency ? ' ' + v.currency : '') : v.date)}</b></td><td><q>${esc(v.quote || '')}</q></td><td>${esc(v.source || '')}</td></tr>`).join('')}${ms.map(m => `<tr><td>milestone</td><td><b>${esc(m.name)}</b> ${m.days != null ? m.days + ' days' : esc(m.date)}</td><td><q>${esc(m.quote || '')}</q></td><td>${esc(m.source || '')}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (e) { toast(e.message, 'bad'); }
  btn.disabled = false; btn.textContent = 'Read key terms with Claude';
}

/* --- BOQ from PDF via Claude --- */
async function boqPdfAI() {
  if (!aiReady()) return; const f = S.raw.boqPdf; const prog = $('#boq-prog'); const btn = $('#btn-boq-ai'); btn.disabled = true;
  try {
    const pages = await pdfPages(f, (i, n) => prog.textContent = ' reading page ' + i + '/' + n, { ocr: $('#ocr-on') && $('#ocr-on').checked });
    const sys = 'You convert Bill of Quantities pages to JSON rows. Reply with JSON only. Copy numbers exactly. Skip headers, subtotals and page totals.';
    const items = []; const batch = 3;
    for (let i = 0; i < pages.length; i += batch) { const txt = pages.slice(i, i + batch).map(p => `[page ${p.n}]\n${p.text}`).join('\n'); if (txt.replace(/\s/g, '').length < 80) continue; prog.textContent = ' Claude: pages ' + (i + 1) + '–' + Math.min(i + batch, pages.length) + ' of ' + pages.length; const t = await callClaude('read_boq', sys, 'Return a JSON array of {"item":string,"desc":string,"unit":string,"qty":number|null,"rate":number|null,"amount":number|null,"part":string}.\n\n' + txt, 4000); try { items.push(...parseJson(t)); } catch (e) { } }
    const clean = items.filter(x => x && x.item && x.amount != null).map(x => ({ item: String(x.item), desc: x.desc || '', unit: x.unit, qty: +x.qty, rate: +x.rate, amount: +x.amount, part: x.part || '' }));
    S.cfg.boq = { items: clean, total: clean.reduce((s, x) => s + x.amount, 0) }; $('#boq-map').innerHTML = `<div class="kv"><div><b>${clean.length}</b> items read</div><div>Total <b>${fmtN(S.cfg.boq.total)}</b></div></div><p class="hint">Compare this total with the BOQ summary page before relying on it.</p>`;
  } catch (e) { toast(e.message, 'bad'); btn.disabled = false; }
}

/* --- submitted document slots --- */
async function loadSlot(k, file) {
  const s = DOC_SLOTS.find(x => x.k === k); S.files[k] = file.name; S.cfg.docs = S.cfg.docs || {};
  try {
    if (s.kind === 'curve' || s.kind === 'rescalc' || s.kind === 'mapping') { const sheets = await readSheetRows(file); S.raw[k] = { sheets, sheet: Object.keys(sheets)[0] }; initSlot(k); }
    else if (s.kind === 'narr') { let text = ''; if (/\.pdf$/i.test(file.name)) text = (await pdfPages(file, null, { ocr: $('#ocr-on') && $('#ocr-on').checked })).map(p => p.text).join('\n'); else if (/\.docx$/i.test(file.name)) text = await docxText(file); else text = await file.text(); S.cfg.docs.narrative = { text }; }
    else if (s.kind === 'layout') { S.raw.layoutFile = file; S.cfg.docs.layout = S.cfg.docs.layout || { zones: [], roads: [] }; }
    viewFiles();
  } catch (e) { toast(e.message, 'bad'); }
}
function initSlot(k) {
  const r = S.raw[k], rows = r.sheets[r.sheet]; const s = DOC_SLOTS.find(x => x.k === k);
  if (s.kind === 'curve') { const g = E.guessSeries(rows) || { orient: 'row', dateRow: 0, valRow: 1 }; r.sel = g; r.cumulative = /s-?curve/i.test(s.t) || /cumul/i.test(JSON.stringify(rows.slice(0, 10))); r.unit = k === 'scurve' ? 'percent' : k === 'cashflow' ? 'amount' : 'hours'; }
  else if (s.kind === 'mapping') { const h = guessHeaderRow(rows); r.hdr = h; const names = (rows[h] || []).map(x => String(x).toLowerCase()); const f = rx => names.findIndex(x => rx.test(x)); r.map = { item: f(/item|boq|ref/), act: f(/activity|act\.? ?id|task/), qty: f(/qty|quant/) }; }
  else if (s.kind === 'rescalc') { const h = guessHeaderRow(rows); r.hdr = h; const names = (rows[h] || []).map(x => String(x).toLowerCase()); const f = rx => names.findIndex(x => rx.test(x)); r.map = { act: f(/activity|act\.? ?id|task/), dur: f(/duration|days/), labour: f(/labou?r|manpower/), equip: f(/equip|plant|machin/) }; }
  applySlot(k);
}
const guessHeaderRow = rows => { const i = rows.findIndex(r => r && r.filter(x => typeof x === 'string' && x.trim()).length >= 2); return i < 0 ? 0 : i; };
function applySlot(k) {
  const r = S.raw[k], rows = r.sheets[r.sheet], s = DOC_SLOTS.find(x => x.k === k); S.cfg.docs = S.cfg.docs || {};
  if (s.kind === 'curve') { const series = E.readSeries(rows, r.sel); S.cfg.docs[k] = { series, cumulative: r.cumulative, unit: r.unit }; }
  else if (s.kind === 'mapping') { const out = []; for (let i = r.hdr + 1; i < rows.length; i++) { const x = rows[i]; if (!x || r.map.item < 0 || r.map.act < 0) continue; const it = x[r.map.item], a = x[r.map.act]; if (it !== '' && a !== '') out.push({ item: String(it), act: String(a), qty: r.map.qty >= 0 ? x[r.map.qty] : null }); } S.cfg.mapping = { rows: out }; S.cfg.docs[k] = { rows: out }; }
  else if (s.kind === 'rescalc') { const out = []; for (let i = r.hdr + 1; i < rows.length; i++) { const x = rows[i]; if (!x || r.map.act < 0 || x[r.map.act] === '') continue; const n = c => c >= 0 && x[c] !== '' ? parseFloat(x[c]) : null; out.push({ act: String(x[r.map.act]), dur: n(r.map.dur), labour: n(r.map.labour), equip: n(r.map.equip) }); } S.cfg.docs[k] = { rows: out }; }
  renderSlot(k);
}
function renderSlot(k) {
  const el = $('#slot-' + k); if (!el) return; const s = DOC_SLOTS.find(x => x.k === k); const r = S.raw[k]; const d = (S.cfg.docs || {})[k];
  if (s.kind === 'curve' && r) {
    const rows = r.sheets[r.sheet], g = r.sel, series = d ? d.series : [];
    el.innerHTML = `<div class="mini"><label>Sheet <select data-slot="${k}" data-f="sheet">${Object.keys(r.sheets).map(n => `<option ${n === r.sheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <label>Series in <select data-slot="${k}" data-f="orient"><option value="row" ${g.orient === 'row' ? 'selected' : ''}>rows</option><option value="col" ${g.orient === 'col' ? 'selected' : ''}>columns</option></select></label>
    ${g.orient === 'row' ? `<label>Dates row <input type="number" data-slot="${k}" data-f="dateRow" value="${g.dateRow + 1}"></label><label>Values row <input type="number" data-slot="${k}" data-f="valRow" value="${g.valRow + 1}"></label>` : `<label>Dates column <input type="number" data-slot="${k}" data-f="dateCol" value="${g.dateCol + 1}"></label><label>Values column <input type="number" data-slot="${k}" data-f="valCol" value="${g.valCol + 1}"></label>`}
    <label>Unit <select data-slot="${k}" data-f="unit">${(k === 'scurve' ? [['percent', '% of total'], ['amount', 'SAR']] : k === 'cashflow' ? [['amount', 'SAR']] : [['hours', 'man-hours'], ['days', 'man-days'], ['months', 'man-months']]).map(([v, t]) => `<option value="${v}" ${r.unit === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="sw sm"><input type="checkbox" data-slot="${k}" data-f="cumulative" ${r.cumulative ? 'checked' : ''}><span>Values are cumulative</span></label></div>
    <p class="hint">${series.length ? `Read ${series.length} months: ${series[0].ym} → ${series[series.length - 1].ym}; first values ${series.slice(0, 3).map(x => fmtN(x.value)).join(', ')}` : '<b class="bad">No monthly series found – adjust rows / columns.</b>'}</p>`;
  } else if ((s.kind === 'mapping' || s.kind === 'rescalc') && r) {
    const rows = r.sheets[r.sheet]; const hdr = (rows[r.hdr] || []).map((h, i) => [i, String(h || 'col ' + (i + 1))]);
    const pick = (f, label) => `<label>${label} <select data-slot="${k}" data-f="map.${f}"><option value="-1">(none)</option>${hdr.map(([i, h]) => `<option value="${i}" ${r.map[f] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
    el.innerHTML = `<div class="mini"><label>Sheet <select data-slot="${k}" data-f="sheet">${Object.keys(r.sheets).map(n => `<option ${n === r.sheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label>Header row <input type="number" data-slot="${k}" data-f="hdr" value="${r.hdr + 1}"></label>
    ${s.kind === 'mapping' ? pick('item', 'BOQ item') + pick('act', 'Activity ID') + pick('qty', 'Quantity') : pick('act', 'Activity ID') + pick('dur', 'Duration (days)') + pick('labour', 'Labour hours') + pick('equip', 'Equipment hours')}</div><p class="hint">${d && d.rows ? d.rows.length + ' rows read' : ''}</p>`;
  } else if (s.kind === 'narr' && d) {
    el.innerHTML = `<p class="hint">${d.text.length.toLocaleString()} characters read. <button class="btn sm" id="btn-narr-ai">Extract statements with Claude (optional)</button> <small>est. $${estimateCost('narrative', d.text.length, 800).toFixed(3)}</small></p>${d.ai ? '<pre class="pre">' + esc(JSON.stringify(d.ai, null, 1)) + '</pre>' : ''}`;
  } else if (s.kind === 'layout' && S.raw.layoutFile) {
    const l = S.cfg.docs.layout || { zones: [], roads: [] };
    el.innerHTML = `<div class="actions"><button class="btn sm" id="btn-layout-ai">Read layout with Claude</button><label class="f"><span>Page</span><input type="number" id="layout-page" value="1" style="width:70px"></label></div>
    <div class="grid"><label class="f"><span>Zones (one per line)</span><textarea data-layout="zones" rows="4">${esc(l.zones.join('\n'))}</textarea></label><label class="f"><span>Roads (one per line)</span><textarea data-layout="roads" rows="4">${esc(l.roads.join('\n'))}</textarea></label></div><p class="hint">Check and correct the lists – a missed road would show as a false scope gap.</p>`;
  } else if (s.kind === 'layout') {
    const l = (S.cfg.docs || {}).layout; el.innerHTML = `<details open><summary>Type the zones and roads (or load a layout file)</summary><div class="grid"><label class="f"><span>Zones</span><textarea data-layout="zones" rows="3">${esc(l ? l.zones.join('\n') : '')}</textarea></label><label class="f"><span>Roads</span><textarea data-layout="roads" rows="3">${esc(l ? l.roads.join('\n') : '')}</textarea></label></div></details>`;
  }
}
async function layoutAI() {
  if (!aiReady()) return; const f = S.raw.layoutFile; const btn = $('#btn-layout-ai'); btn.disabled = true; btn.textContent = 'Reading…';
  try {
    let b64, type = 'image/jpeg'; if (/\.pdf$/i.test(f.name)) b64 = await pdfPageImage(f, +($('#layout-page').value || 1), 1.8); else { const buf = new Uint8Array(await readBuf(f)); let s = ''; buf.forEach(c => s += String.fromCharCode(c)); b64 = btoa(s); type = /png$/i.test(f.name) ? 'image/png' : 'image/jpeg'; }
    const t = await callClaude('read_layout', 'You read project general-layout drawings. Reply with JSON only.', [{ type: 'image', source: { type: 'base64', media_type: type, data: b64 } }, { type: 'text', text: 'List every ZONE / AREA name and every ROAD name or number you can read on this layout. Return {"zones":[string],"roads":[string]}. Do not guess unreadable labels.' }], 1500);
    const j = parseJson(t); S.cfg.docs.layout = { zones: j.zones || [], roads: j.roads || [] }; renderSlot('layout'); toast('Layout read – please check the lists', 'ok');
  } catch (e) { toast(e.message, 'bad'); btn.disabled = false; btn.textContent = 'Read layout with Claude'; }
}
async function narrativeAI() {
  if (!aiReady()) return; const d = S.cfg.docs.narrative; const btn = $('#btn-narr-ai'); btn.disabled = true;
  try { const t = await callClaude('narrative', 'You extract statements from a baseline programme narrative. JSON only. Use null if not stated.', 'Return {"projectFinishDate":string|null,"workingWeekStatements":[string],"calendars":[string],"criticalPathDescription":string|null,"assumptions":[string]} from:\n' + d.text.slice(0, 60000), 1500); d.ai = parseJson(t); renderSlot('narrative'); } catch (e) { toast(e.message, 'bad'); btn.disabled = false; }
}

/* ---------------- 3. CONFIRM ---------------- */
function viewConfirm() {
  const M = S.M, c = S.cfg;
  if (!M) { $('#main').innerHTML = `<header class="ph"><h1>Confirmations</h1></header><section class="card"><p>Load the XER file first.</p></section><footer class="pf"><button class="btn primary" data-go="files">Go to Load files</button></footer>`; return; }
  const o = E.run(M, c); const need = o.needEid;
  const rsOpts = ['<option value="">(not identified)</option>'].concat(Object.values(M.rsrc).map(r => `<option value="${r.id}">${esc(r.name)} · ${r.type.replace('RT_', '')}</option>`));
  const rsSel = (key) => `<select data-rs="${key}">${rsOpts.map(h => h).join('').replace(`value="${c.rsrc[key]}"`, `value="${c.rsrc[key]}" selected`)}</select>`;
  const milesOpts = ['<option value="">(select activity)</option>'].concat(M.tasks.filter(t => t.isMile).sort((a, b) => (a.ef || 0) - (b.ef || 0)).map(t => `<option value="${t.id}">${esc(t.code)} · ${esc(t.name.slice(0, 60))} · ${E.fmtDate(t.ef)}</option>`));
  const wbsRows = []; (function walk(id) { const w = M.wbs[id]; if (w.level >= 1 && w.level <= 2) wbsRows.push(w); w.kids.forEach(walk); })(Object.values(M.wbs).find(w => !w.parent).id);
  const catOf = id => c.wbsMap[id] || '';
  const cntW = {}; M.tasks.forEach(t => cntW[t.wbs] = (cntW[t.wbs] || 0) + 1);
  const subCount = w => { let n = cntW[w.id] || 0; w.kids.forEach(k => n += subCount(M.wbs[k])); return n; };
  const used = [...new Set(M.tasks.map(t => t.clndr))];
  $('#main').innerHTML = `
  <header class="ph"><h1>Confirmations</h1><p>The tool suggests; you confirm once. Choices are saved with the project so a resubmission skips this screen.</p></header>
  <section class="card"><h2>Resources</h2><div class="grid">
    <label class="f"><span>Progress resource (price 1 – weighted budget)</span>${rsSel('progress')}</label><label class="f"><span>Cost resource (price 0 – BOQ amounts)</span>${rsSel('cost')}</label></div>
    <p class="hint">Labour = all labour-type resources, equipment = all equipment-type resources, except the two above.</p></section>
  <section class="card"><h2>WBS → category</h2><p class="hint">Sets which calendar each activity should use and which phase it belongs to. A branch with no choice takes its parent's category.</p>
    <table class="tbl compact"><thead><tr><th>WBS branch</th><th class="n">Activities</th><th>Category</th></tr></thead><tbody>${wbsRows.map(w => `<tr><td style="padding-left:${w.level * 16}px">${esc(w.name)}</td><td class="n">${subCount(w)}</td><td><select data-wbs="${w.id}"><option value="">(inherit)</option>${E.CATS.map(k => `<option ${catOf(w.id) === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></section>
  <section class="card"><h2>KEC / authority approval activities <small id="ap-count">${(c.approvalIds || []).length} selected</small></h2><p class="hint">Only the activities you tick get the approvals calendar (5-day by default, see Calendars) and the review-period test. Shop drawing and material approvals are reviewed on site by the supervision consultant (6-day week), so the suggestion leaves out names matching the words below.</p>
    <label class="f"><span>Leave out of the suggestion (words separated by |)</span><input data-p="approvalExclude" value="${esc(c.approvalExclude == null ? E.APPROVAL_EXCLUDE_DEFAULT : c.approvalExclude)}"></label>
    <div class="actions"><input id="ap-q" placeholder="Filter by name…" class="grow"><button class="btn sm" id="ap-sug">Select suggested</button><button class="btn sm" id="ap-none">Clear</button><button class="btn sm" id="ap-ai">Suggest with Claude</button></div><div id="ap-list" class="scroll"></div></section>
  <section class="card"><h2>Project finish activity</h2><label class="f"><span>The last milestone of the project</span><select data-fin="1">${['<option value="">(automatic: latest finish milestone)</option>'].concat(M.tasks.filter(t => t.isMile).sort((a, b) => (b.ef || 0) - (a.ef || 0)).slice(0, 40).map(t => `<option value="${t.id}" ${c.projFinishId === t.id ? 'selected' : ''}>${esc(t.code)} · ${esc(t.name.slice(0, 60))} · ${E.fmtDate(t.ef)}</option>`)).join('')}</select></label></section>
  <section class="card"><h2>Contractual milestones</h2><p class="hint">Enter from the contract (or read with Claude in Load files), then pick the matching activity.</p>
    <table class="tbl compact"><thead><tr><th>Milestone</th><th>Days from NTP</th><th>or date</th><th>Activity in schedule</th><th></th></tr></thead><tbody id="ms-body">${c.milestones.map((m, i) => `<tr><td><input data-ms="${i}.name" value="${esc(m.name)}"></td><td><input type="number" data-ms="${i}.days" value="${esc(m.days == null ? '' : m.days)}" style="width:90px"></td><td><input type="date" data-ms="${i}.date" value="${esc(m.date || '')}"></td><td><select data-ms="${i}.actId">${milesOpts.join('').replace(`value="${m.actId}"`, `value="${m.actId}" selected`)}</select></td><td><button class="x" data-msdel="${i}">✕</button></td></tr>`).join('')}</tbody></table><button class="btn sm" id="ms-add">+ Add milestone</button></section>
  <section class="card"><h2>Public holidays</h2><p class="hint">National Day (23 Sep) and Founding Day (22 Feb) are built in. Enter each Eid once; the tool remembers it for all projects.</p>
    ${need.length ? `<table class="tbl compact"><thead><tr><th>Eid</th><th>Year</th><th>First day</th><th>Last day</th><th>None in this project window</th></tr></thead><tbody>${need.map((n, i) => `<tr><td>${n.type}</td><td>${n.year}</td><td><input type="date" data-eid="${i}.from" data-y="${n.year}" data-t="${n.type}" placeholder="${n.approx}"></td><td><input type="date" data-eid="${i}.to"></td><td><input type="checkbox" data-eid="${i}.none"></td></tr><tr class="sub"><td colspan="5">Approximate date for guidance only: ${E.fmtDate(E.strToDay(n.approx))} – confirm against the official announcement.</td></tr>`).join('')}</tbody></table><button class="btn sm primary" id="eid-save">Save Eid dates</button>` : '<p class="ok">✓ All Eid dates needed for this project are stored.</p>'}
    <details><summary>Stored Eid dates (${c.eid.length})</summary><table class="tbl compact"><tbody>${c.eid.sort((a, b) => a.year - b.year).map((e, i) => `<tr><td>${e.type}</td><td>${e.year}</td><td>${e.none ? 'none in window' : esc(e.from) + ' → ' + esc(e.to || e.from)}</td><td><button class="x" data-eiddel="${e.year}|${e.type}">✕</button></td></tr>`).join('')}</tbody></table></details>
    <details><summary>Calendars tested for holidays</summary><div class="chk">${used.map(id => `<label><input type="checkbox" data-hcal="${id}" ${(c.holidayCalsExclude || []).includes(id) ? '' : 'checked'}> ${esc(M.cal[id] ? M.cal[id].name : id)}</label>`).join('')}</div></details></section>
  <section class="card"><h2>Activity ID pattern &amp; discipline words</h2><div class="grid"><label class="f"><span>Activities that need no equipment (words, regex) – labour only</span><input data-p="noEquipRegex" data-t="str" value="${esc(c.noEquipRegex || '')}"></label><label class="f"><span>ID pattern (regex; groups: phase, zone, discipline)</span><input data-p="idRegex" data-t="str" value="${esc(c.idRegex)}"></label></div>
    <p class="hint" id="id-test"></p><label class="f"><span>Discipline keywords (JSON: name → regex)</span><textarea data-dw="1" rows="5">${esc(JSON.stringify(c.disciplineWords, null, 1))}</textarea></label></section>
  <footer class="pf"><button class="btn" data-go="files">← Files</button><button class="btn primary" data-go="run">Next: run checks →</button></footer>`;
  renderApprovals(); idTest();
}
function renderApprovals() {
  const M = S.M, c = S.cfg, q = ($('#ap-q') || {}).value ? $('#ap-q').value.toLowerCase() : ''; const sel = new Set(c.approvalIds || []);
  const cand = M.tasks.filter(t => !t.isMile && t.cat !== 'construction' && (!q || (t.code + ' ' + t.name).toLowerCase().includes(q)));
  $('#ap-list').innerHTML = `<table class="tbl compact"><tbody>${cand.slice(0, 400).map(t => `<tr><td><input type="checkbox" data-ap="${t.id}" ${sel.has(t.id) ? 'checked' : ''}></td><td>${esc(t.code)}</td><td>${esc(t.name)}</td><td class="mut">${t.cat}</td></tr>`).join('')}</tbody></table>${cand.length > 400 ? '<p class="hint">Showing 400 of ' + cand.length + ' – use the filter.</p>' : ''}`;
  $('#ap-count').textContent = sel.size + ' selected';
}
function idTest() { const el = $('#id-test'); if (!el) return; let rx; try { rx = new RegExp(S.cfg.idRegex); } catch (e) { el.innerHTML = '<b class="bad">Invalid pattern</b>'; return; } const t = S.M.tasks.filter(t => !t.isMile); const ok = t.filter(x => rx.test(x.code)).length; el.innerHTML = `Matches ${ok.toLocaleString()} of ${t.length.toLocaleString()} activity IDs. Example: <code>${esc(t[100].code)}</code> → ${(() => { const m = rx.exec(t[100].code); return m ? m.slice(1).map(esc).join(' · ') : 'no match'; })()}`; }
async function approvalsAI() {
  if (!aiReady()) return; const M = S.M; const cand = M.tasks.filter(t => !t.isMile && t.cat !== 'construction').slice(0, 600); const btn = $('#ap-ai'); btn.disabled = true; btn.textContent = 'Asking…';
  try { const list = cand.map(t => t.id + '|' + t.name).join('\n'); const t = await callClaude('suggest_approvals', 'You classify construction schedule activities. JSON only.', 'Which of these activities are APPROVALS or reviews carried out by the Employer, engineer (KEC) or an external authority, not work done by the contractor? Return {"ids":[string]}.\n' + list, 3000); const j = parseJson(t); S.cfg.approvalIds = (j.ids || []).filter(i => M.byId[i]); renderApprovals(); autosave(); } catch (e) { toast(e.message, 'bad'); }
  btn.disabled = false; btn.textContent = 'Suggest with Claude';
}

/* ---------------- 4. RUN ---------------- */
function viewRun() {
  const c = S.cfg, M = S.M; const have = (k, t) => `<li class="${k ? 'y' : 'n'}">${k ? '✓' : '○'} ${t}</li>`;
  $('#main').innerHTML = `<header class="ph"><h1>Run checks</h1><p>Everything not provided is reported as <b>Not run</b> – never as a pass.</p></header>
  <section class="card"><h2>Inputs</h2><ul class="have">${have(M, 'Schedule (XER)')}${have(c.contractValue, 'Contract value')}${have(c.durationValue, 'Contract duration')}${have(c.ntp, 'NTP / commencement date')}${have(c.milestones.length, 'Contractual milestones (' + c.milestones.length + ')')}${have(c.boq, 'BOQ')}${DOC_SLOTS.map(s => have(S.files[s.k], s.t)).join('')}</ul>
  <div class="actions"><button class="btn primary big" id="btn-run" ${M ? '' : 'disabled'}>Run all checks</button><span id="run-prog" class="hint"></span></div></section>
  <footer class="pf"><button class="btn" data-go="confirm">← Confirmations</button>${S.out ? '<button class="btn" data-go="report">View last report →</button>' : ''}</footer>`;
}
async function runAll() {
  const M = S.M, c = S.cfg, pr = $('#run-prog'); $('#btn-run').disabled = true;
  try {
    pr.textContent = 'Applying categories…'; await sleep(40); E.applyCategories(M, c.wbsMap);
    pr.textContent = 'Running schedule checks…'; await sleep(40); const out = E.run(M, c);
    pr.textContent = 'Checking submitted documents and BOQ…'; await sleep(40); E.runDocs(M, c, out); E.runExtra(M, c, out, { sequences: c.sequences, cpAi: S.cpAi });
    S.out = out; allocNumbers(); autosave(); go('report');
  } catch (e) { console.error(e); toast('Error while running: ' + e.message, 'bad'); $('#btn-run').disabled = false; }
}
function allocNumbers() { let n = Math.max(0, ...Object.values(S.commentNo)); S.out.results.filter(r => r.status === 'fail').forEach(r => { if (!S.commentNo[r.id]) S.commentNo[r.id] = ++n; }); }
