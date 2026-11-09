/* ===== APP PART 8: quick review (XER only) ===== */
S.qk = { tab: 'over', measure: {}, q: null, rules: null, calView: 'cat', detail: null, codeFilter: '' };
const QTABS = [['over', 'Overview'], ['cash', 'Cash flow'], ['rel', 'Relationships'], ['man', 'Manpower'], ['codes', 'Activity codes'], ['cal', 'Calendars'], ['seq', 'Build sequence']];
const fmtM = ym => { const [y, m] = ym.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y.slice(2); };
const qchip = (txt, kind) => `<span class="chip ${kind || ''}">${esc(txt)}</span>`;
const qtbl = (head, rows, opt) => { opt = opt || {}; return `<div class="scroll" style="max-height:${opt.h || 420}px"><table class="tbl"><thead><tr>${head.map((h, i) => `<th class="${(opt.num || []).includes(i) ? 'n' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; };
const qtd = (v, num) => `<td class="${num ? 'n' : ''}">${v}</td>`;

async function qLoadXer(file, silent) {
  if (!silent) { toast('Reading XER…'); await sleep(30); }
  try {
    const __x = await xerStage(file); const T = __x.T;
    if (!T.TASK || !T.PROJECT) throw new Error('This does not look like a P6 XER file');
    const M = __x.M; S.M = M; S.files.xer = file.name; S.xerName = file.name; S.out = null; S.orig.xer = file;
    S.cfg.wbsMap = E.suggestWbsMap(M); S.cfg.approvalIds = null; S.cfg.rsrc = E.suggestResources(M); S.cfg.projFinishId = null;
    if (!S.cfg.projectName) S.cfg.projectName = (M.proj.proj_short_name || '').replace(/-\d+$/, '') || file.name.replace(/\.xer$/i, '');
    if (S.pendingProfile) resolveProfile();
    E.applyCategories(M, S.cfg.wbsMap); if (!S.cfg.approvalIds || !S.cfg.approvalIds.length) S.cfg.approvalIds = E.suggestApprovals(M, S.cfg.approvalExclude);
    S.qk.measure = {}; if (S.qk.pendingMeasure) { const byName = {}; Object.values(M.rsrc).forEach(r => byName[r.name] = r.id); for (const [n, v] of Object.entries(S.qk.pendingMeasure)) if (byName[n]) S.qk.measure[byName[n]] = v; S.qk.pendingMeasure = null; }
    S.qk.q = null; S.qk.rules = null; S.qk.detail = null; S.qk.tab = 'over'; S.qk.codeFilter = '';
    if (!silent) { renderNav(); viewQuick(); toast('XER loaded: ' + M.tasks.length + ' activities', 'ok'); }
  } catch (e) { console.error(e); toast(e.message, 'bad'); }
}
function qCompute() {
  if (!S.M) return null;
  if (S.M.tasks.length && S.M.tasks[0].cat == null) E.applyCategories(S.M, S.cfg.wbsMap || E.suggestWbsMap(S.M));
  if (!S.cfg.rsrc) S.cfg.rsrc = E.suggestResources(S.M);
  S.qk.q = E.quick(S.M, S.cfg, { measure: S.qk.measure });
  return S.qk.q;
}
function qRules() { if (!S.qk.rules) { try { S.qk.rules = E.quickRules(S.M, S.cfg); } catch (e) { console.error(e); S.qk.rules = []; S.qk.rulesErr = e.message; } } return S.qk.rules; }

function viewQuick() {
  const M = S.M;
  if (!M) {
    $('#main').innerHTML = `<header class="ph"><h1>Quick review</h1><p>Load only the P6 XER. The tool draws the cash flow from the budgeted cost, tests all relationship rules, and checks manpower, activity codes and calendars – no contract documents needed.</p></header>
    <section class="card"><h2>Schedule (XER)</h2>${drop('q-xer', '.xer,.txt', false, 'Choose the P6 XER file')}<div class="actions"><label class="btn" for="q-open">Open a saved project</label><input type="file" id="q-open" accept=".brtq,.brt,.json" hidden></div><p class="hint">Everything is read locally in your browser. Nothing is sent anywhere.</p></section>`; return;
  }
  const q = S.qk.q || qCompute();
  $('#main').classList.add('wide'); $('#main').innerHTML = `<div class="split"><aside class="pane-in"><div class="lbl">SCHEDULE</div><div class="fileb"><b>${esc(S.xerName || 'XER')}</b><small>${fmtN(q.over.tasks)} activities · data date ${esc(E.fmtDate(q.over.dataDate))}</small></div>${drop('q-xer', '.xer,.txt', false, 'Load a different XER')}
  <div class="lbl">ACTIONS</div><div class="actions stack" style="margin:0"><button class="btn primary" data-qx="xlsx">Download quick review (Excel)</button><button class="btn" data-qsave="1">Save project</button><label class="btn" for="q-open">Open saved project</label><input type="file" id="q-open" accept=".brtq,.brt,.json" hidden></div></aside>
  <div class="pane-out"><div class="tabs">${QTABS.map(([k, t]) => `<button data-qtab="${k}" class="${S.qk.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div><div id="q-body"></div></div></div>`;
  qRenderTab(); if (!S.qk.rules) setTimeout(() => { qRules(); if (S.step === 'quick' && S.qk.tab === 'over') qRenderTab(); }, 60);
}
function qRenderTab() {
  const q = S.qk.q; if (!q) return; document.querySelectorAll('[data-qtab]').forEach(b => b.classList.toggle('on', b.dataset.qtab === S.qk.tab));
  const f = { over: qOver, cash: qCash, rel: qRel, man: qMan, codes: qCodes, cal: qCal, seq: qSeq }[S.qk.tab]; $('#q-body').innerHTML = f(q);
  if (S.qk.tab === 'rel' && !S.qk.rules) setTimeout(() => { qRules(); if (S.qk.tab === 'rel') $('#q-body').innerHTML = qRel(S.qk.q); }, 30);
}

/* ---------- charts (plain SVG, fixed colours so they also export as PNG) ---------- */
function qBarSVG(months, series, line, o) {
  o = o || {}; const W = 1060, H = o.h || 380, L = 64, R = line ? 56 : 20, Tp = 34, B = 78, iw = W - L - R, ih = H - Tp - B, n = months.length || 1, fmt = o.fmt || fmtN, lab = o.lab || fmt;
  const mx = Math.max(1e-9, ...months.map(m => Math.max(...series.map(s => m[s.key] || 0))));
  const pw = Math.pow(10, Math.floor(Math.log10(mx / 4))), f = mx / 4 / pw, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pw, nt = Math.max(1, Math.ceil(mx / step - 1e-9)), top = step * nt;
  const bw = iw / n, gw = bw * 0.78, sw = gw / series.length, vert = series.length > 1 || sw < 34;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="min-width:0" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let i = 0; i <= nt; i++) { const y = Tp + ih - ih * i / nt, v = step * i; s += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e3e8ee"/><text x="${L - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#5b6b7b">${fmt(v)}</text>`; }
  if (line) for (let i = 0; i <= 4; i++) { const y = Tp + ih - ih * i / 4; s += `<text x="${W - R + 6}" y="${(y + 4).toFixed(1)}" fill="#5b6b7b">${i * 25}%</text>`; }
  const xs = Math.max(1, Math.ceil(n / 24)), halo = 'paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round"';
  months.forEach((m, i) => { const x0 = L + i * bw + (bw - gw) / 2; series.forEach((se, j) => { const v = m[se.key] || 0, h = ih * v / top, x = x0 + j * sw, y = Tp + ih - h;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, sw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${se.color}"><title>${fmtM(m.ym)}: ${fmt(v)} ${esc(se.label)}</title></rect>`;
      if (v > 0) { const tx = x + (sw - 1) / 2; s += vert ? `<text x="${tx.toFixed(1)}" y="${(y - 4).toFixed(1)}" fill="#1b2a41" font-size="10" text-anchor="start" transform="rotate(-90 ${tx.toFixed(1)} ${(y - 4).toFixed(1)})">${lab(v)}</text>` : `<text x="${tx.toFixed(1)}" y="${(y - 4).toFixed(1)}" fill="#1b2a41" font-size="10.5" text-anchor="middle">${lab(v)}</text>`; } });
    if (i % xs === 0) s += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - B + 16}" text-anchor="end" fill="#5b6b7b" transform="rotate(-45 ${(L + i * bw + bw / 2).toFixed(1)} ${H - B + 16})">${fmtM(m.ym)}</text>`; });
  if (line) { const pts = months.map((m, i) => [L + i * bw + bw / 2, Tp + ih - ih * (m[line.key] || 0) / 100, m[line.key] || 0]); s += `<polyline fill="none" stroke="${line.color}" stroke-width="2.4" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
    pts.forEach((p, i) => { s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${line.color}"/>`; if (n <= 18 || i % 2 === 0 || i === n - 1) s += `<text x="${p[0].toFixed(1)}" y="12" text-anchor="middle" fill="${line.color}" font-size="10.5" font-weight="700">${p[2].toFixed(0)}%</text>`; }); s += `<text x="${L - 6}" y="12" text-anchor="end" fill="#5b6b7b" font-size="10">Cum. %</text>`; }
  let lx = L; series.map(se => [se.color, se.label]).concat(line ? [[line.color, line.label]] : []).forEach(([c, t]) => { s += `<rect x="${lx}" y="${H - 16}" width="12" height="9" fill="${c}"/><text x="${lx + 17}" y="${H - 8}" fill="#1b2a41">${esc(t)}</text>`; lx += 17 + t.length * 6.3 + 28; });
  (o.marks || []).forEach(mk => { const x = L + mk.pos * bw; s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Tp}" y2="${Tp + ih}" stroke="#b4452a" stroke-width="1.4" stroke-dasharray="5 4"/><text x="${(x + 4).toFixed(1)}" y="${Tp + 12}" fill="#b4452a" font-size="10.5" font-weight="700">${esc(mk.label)}</text>`; });
  return s + '</svg>';
}
const qCashSVG = q => qBarSVG(q.cash.months, [{ key: 'cost', color: '#0b7a75', label: 'Monthly budgeted cost (SAR)' }], { key: 'cumPct', color: '#1b2a41', label: 'Cumulative % of budget' }, { lab: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(Math.round(v)), fmt: v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(Math.round(v)), marks: (q.load && q.load.marks) || [] });
const qManSVG = q => qBarSVG(q.man.months, [{ key: 'lab', color: '#0b7a75', label: 'Labour – average people per working day' }, { key: 'eq', color: '#c58a1b', label: 'Equipment – average units per working day' }], null, { fmt: v => v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString(), lab: v => v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString() });

/* ---------- overview ---------- */
function qOver(q) {
  const rel = S.qk.rules, relFail = rel ? rel.filter(r => r.status === 'fail').length : null;
  const cons = q.man.cons, labPct = q.man.nonMile ? q.man.labTasks / q.man.nonMile * 100 : 0;
  const tile = (title, kind, big, sub, tab) => `<button class="tile" data-qtab="${tab}" style="all:unset;cursor:pointer;box-sizing:border-box;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--${kind === 'bad' ? 'bad' : kind === 'ok' ? 'ok' : 'warn'});border-radius:12px;padding:14px 18px;display:flex;flex-direction:column;gap:3px"><span class="mut" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em">${title}</span><b style="font-size:20px">${big}</b><span class="mut" style="font-size:13px">${sub}</span></button>`;
  const cashT = q.cash.none ? tile('Cash flow', 'bad', 'No budget', 'All assignment costs are zero – see the measure options', 'cash') : tile('Cash flow', 'ok', 'SAR ' + fmtN(Math.round(q.cash.total)), q.cash.months.length + ' months · ' + q.cash.firstHalfPct.toFixed(0) + '% in the first half', 'cash');
  const LD = q.load, loadT = (LD && !LD.none) ? tile('Loading profile', LD.verdict === 'balanced' ? 'ok' : 'bad', ({ back: 'Back-loaded', front: 'Front-loaded', mixed: 'Mixed', balanced: 'Balanced' })[LD.verdict], LD.remain + '% of the budget remains after ' + LD.timePct + '% of the time', 'cash') : '';
  const relT = rel ? tile('Relationships', relFail ? 'bad' : 'ok', relFail ? relFail + ' rule(s) failed' : 'All rules pass', fmtN(q.rel.total) + ' links · FS ' + (q.rel.total ? Math.round(q.rel.types.FS / q.rel.total * 100) : 0) + '%', 'rel') : tile('Relationships', 'warn', fmtN(q.rel.total) + ' links', 'Open the tab to run the rules', 'rel');
  const manT = tile('Manpower', q.man.labTasks ? (labPct > 80 ? 'ok' : 'warn') : 'bad', q.man.labTasks ? labPct.toFixed(0) + '% with labour' : 'No labour assigned', q.man.labTasks ? 'Peak ≈ ' + Math.round(q.man.labPeak) + ' people' : (q.man.labDict ? q.man.labDict + ' labour resource(s) exist, none used' : 'No labour resources in the file'), 'man');
  const withC = q.codes.any, codeT = tile('Activity codes', q.codes.noTypes ? 'bad' : (withC === q.over.tasks ? 'ok' : 'warn'), q.codes.noTypes ? 'None defined' : withC + ' of ' + q.over.tasks + ' coded', q.codes.types.length + ' code type(s)', 'codes');
  const calT = tile('Calendars', (q.cal.wrong || q.cal.holGaps) ? 'bad' : 'ok', q.cal.used.length + ' in use', q.cal.wrong + ' activities on an unexpected calendar · ' + q.cal.holGaps + ' holiday gap(s)', 'cal');
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${cashT}${loadT}${relT}${manT}${codeT}${calT}</div>
  <section class="card" style="margin-top:16px"><h2>Schedule at a glance</h2><div class="kv"><span>Activities <b>${fmtN(q.over.nonMile)}</b></span><span>Milestones <b>${fmtN(q.over.miles)}</b></span><span>Links <b>${fmtN(q.over.links)}</b></span><span>WBS items <b>${fmtN(q.over.wbs)}</b></span><span>Calendars <b>${q.over.calendars}</b></span><span>Resources <b>${q.over.resources}</b></span></div>
  <div class="kv"><span>Start <b>${esc(E.fmtDate(q.over.start))}</b></span><span>Finish <b>${esc(E.fmtDate(q.over.finish))}</b></span><span>Data date <b>${esc(E.fmtDate(q.over.dataDate))}</b></span></div>
  <p class="hint">Rules and limits (float, lags, calendar rules per category, holidays) come from <b>Project setup</b>; defaults apply if you have not changed them. Categories are read from the WBS names – <a href="#" data-go="confirm">change them in Confirmations</a>.</p></section>`;
}

/* ---------- cash flow ---------- */
function qLoadCard(q) {
  const L = q.load; if (!L || L.none) return '';
  const col = { back: 'var(--bad)', front: 'var(--warn)', mixed: 'var(--warn)', balanced: 'var(--ok)' }[L.verdict], nm = { back: 'Back-loaded', front: 'Front-loaded', mixed: 'Mixed', balanced: 'Balanced' }[L.verdict];
  const dv = k => { const v = S.cfg[k]; return v == null ? E.EXTRA_DEFAULTS[k] : v; };
  const inp = (k, label, hint) => `<label class="f"><span>${label}</span><input type="number" step="any" data-qlim="${k}" value="${dv(k)}" style="width:90px"></label>`;
  const rows = L.tests.map(t => `<tr><td>${esc(t.name)}</td>${qtd(t.value + (t.unit === '×' ? '×' : '%'), 1)}${qtd((t.dir === 'max' ? 'not above ' : 'not below ') + t.limit + (t.unit === '×' ? '×' : '%'), 1)}<td class="${t.fail ? 'bad' : 'ok'}"><b>${t.fail ? 'Outside the limit' : 'Within the limit'}</b>${t.fail ? ' · ' + ({ back: 'points to back-loading', front: 'points to front-loading', spike: 'concentrated month' })[t.side] : ''}</td></tr>`);
  return `<section class="card" style="border-left:5px solid ${col}"><h2>Loading profile <small>from the budgeted cost</small></h2>
  <p style="font-size:18px;margin:4px 0"><b style="color:${col}">${nm}</b></p><p>${esc(L.text)}</p>
  <div class="kv"><span>At ${L.frontPct}% of the time <b>${L.early}%</b> of the budget</span><span>At ${L.timePct}% of the time <b>${L.done}%</b> (remaining <b>${L.remain}%</b>)</span><span>Centre of gravity <b>${L.cg}%</b> of the duration</span><span>Busiest month <b>${fmtM(L.peakYm)} · ${L.peakPct}%</b> of the budget (${L.peakMult}× average)</span></div>
  ${qtbl(['Test', 'Result', 'Limit', 'Status'], rows, { num: [1, 2], h: 260 })}
  <details style="margin-top:10px"><summary><b>Limits (you can change them)</b></summary><p class="hint">Saved with the project. Time point and the back-loading limits are the same as in the full review (progress curve check).</p>
  <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">${inp('curveTimePct', 'Time point for back-loading (% of duration)')}${inp('curveRemainMax', 'Budget remaining after it must not exceed (%)')}${inp('curveCgMax', 'Centre of gravity not later than (% of duration)')}${inp('loadFrontPct', 'Time point for front-loading (% of duration)')}${inp('loadFrontMax', 'Budget earned by it must not exceed (%)')}${inp('loadCgMin', 'Centre of gravity not earlier than (% of duration)')}${inp('curveMonthMult', 'Busiest month ceiling (× average month)')}</div></details></section>`;
}
function qCash(q) {
  const c = q.cash, sel = (r) => `<select data-qmeas="${r.id}">${[['cost', 'Cost'], ['units', 'Units as SAR'], ['exclude', 'Exclude']].map(([v, t]) => `<option value="${v}" ${r.measure === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const resRows = q.res.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.typeName)}</td>${qtd(fmtN(r.tasks), 1)}${qtd(fmtN(r.qty), 1)}${qtd(fmtN(Math.round(r.cost)), 1)}${qtd(sel(r))}</tr>`);
  let h = qLoadCard(q) + `<section class="card"><h2>Budgeted cost by month <small>from the baseline (target) dates, spread over each activity's working days</small></h2>`;
  if (c.none) h += `<p class="bad"><b>No budgeted cost was found.</b> Every resource assignment has a cost of zero. If the budget is carried as <i>units</i> on a cost resource (price 0), choose “Units as SAR” for that resource below.</p>`;
  else h += `<div class="kv"><span>Total budget <b>SAR ${fmtN(Math.round(c.total))}</b></span><span>Months <b>${c.months.length}</b></span><span>First half of time <b>${c.firstHalfPct.toFixed(0)}%</b></span><span>Peak month <b>${c.peak ? fmtM(c.peak.ym) + ' · SAR ' + fmtN(Math.round(c.peak.cost)) : ''}</b></span>${c.contract ? `<span>Contract value <b>SAR ${fmtN(c.contract)}</b></span><span>Difference <b class="${Math.abs(c.total - c.contract) / c.contract * 100 > (S.cfg.costTol || 0.1) ? 'bad' : 'ok'}">${fmtN(Math.round(c.total - c.contract))}</b></span>` : ''}</div>
  <div class="dg" style="margin-top:12px">${qCashSVG(q)}</div><div class="actions"><button class="btn sm" data-qx="cashpng">Download chart (PNG)</button></div>`;
  h += `<p class="hint">Used for the budget: ${c.usedMeasures.length ? esc(c.usedMeasures.join(', ')) : 'nothing'}. ${c.zeroCostTasks} of ${q.over.nonMile} activities carry no budget.${c.noSpan ? ' ' + c.noSpan + ' assignments had no dates and were skipped.' : ''}</p></section>
  <section class="card"><h2>Which resources make up the budget?</h2><p class="hint">The tool picks the cost-carrying resource automatically (the progress-weight resource is excluded so the budget is not counted twice). Change a choice and the chart updates.</p>${qtbl(['Resource', 'Type', 'Activities', 'Units', 'Cost (SAR)', 'Use for cash flow'], resRows, { num: [2, 3, 4], h: 300 })}</section>`;
  if (!c.none) h += `<section class="card"><h2>Monthly table</h2>${qtbl(['Month', 'Budgeted cost (SAR)', 'Cumulative (SAR)', 'Cumulative %'], c.months.map(m => `<tr><td>${fmtM(m.ym)}</td>${qtd(fmtN(Math.round(m.cost)), 1)}${qtd(fmtN(Math.round(m.cum)), 1)}${qtd(m.cumPct.toFixed(1) + '%', 1)}</tr>`), { num: [1, 2, 3], h: 360 })}</section>`;
  return h;
}

/* ---------- relationships ---------- */
function qRel(q) {
  const r = q.rel, rules = S.qk.rules; const pc = n => r.total ? (n / r.total * 100).toFixed(1) + '%' : '–';
  let h = `<section class="card"><h2>Relationship statistics</h2><div class="kv"><span>Links <b>${fmtN(r.total)}</b></span><span>Links per activity <b>${r.perAct.toFixed(2)}</b></span><span>Finish-to-Start <b>${fmtN(r.types.FS)} · ${pc(r.types.FS)}</b></span><span>Start-to-Start <b>${fmtN(r.types.SS)} · ${pc(r.types.SS)}</b></span><span>Finish-to-Finish <b>${fmtN(r.types.FF)} · ${pc(r.types.FF)}</b></span><span>Start-to-Finish <b class="${r.types.SF ? 'bad' : ''}">${fmtN(r.types.SF)}</b></span></div>
  <div class="kv"><span>Links with a positive lag <b>${fmtN(r.lagPos)}</b></span><span>… of which FS <b>${fmtN(r.fsLag)}</b></span><span>Links with a negative lag (lead) <b class="${r.lagNeg ? 'bad' : ''}">${fmtN(r.lagNeg)}</b></span><span>No predecessor <b>${fmtN(r.noPred)}</b></span><span>No successor <b>${fmtN(r.noSucc)}</b></span>${r.bad ? `<span>Links to missing activities <b class="bad">${r.bad}</b></span>` : ''}</div></section>`;
  if (!rules) return h + `<section class="card"><p class="hint">Running the relationship rules…</p></section>`;
  if (S.qk.rulesErr) h += `<p class="bad">${esc(S.qk.rulesErr)}</p>`;
  h += `<div class="chips"><span class="mut" style="align-self:center;font-size:13px">Rules applied: ${rules.map(x => x.id).join(', ')} · limits from Project setup (max. FS lag ${S.cfg.maxFsLag} day(s))</span></div>`;
  for (const c of rules) {
    const st = c.status === 'fail' ? 'bad' : c.status === 'pass' ? 'ok' : '';
    const items = c.items.slice(0, 60);
    h += `<section class="card"><h2>${esc(c.id)} · ${esc(c.title)} ${qchip(c.status === 'fail' ? c.count + ' found' : c.status === 'pass' ? 'Pass' : 'Not run', st)}</h2><p class="hint" style="margin-top:0">${esc(c.summary || '')}</p><p class="hint"><b>Rule:</b> ${esc(c.rule || '')}</p>`;
    if (c.evidence && c.evidence.length && c.status === 'fail') h += `<ul class="ev">${c.evidence.slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
    if (items.length) h += `<details><summary>Show ${items.length} of ${fmtN(c.count)} affected</summary>${qtbl(['ID', 'Activity / link', 'Issue', 'Value', 'Suggested correct logic'], items.map(i => `<tr><td class="nw">${esc(i.id)}</td><td>${esc(i.name)}</td><td>${esc(i.field)}</td><td>${esc(i.value)}</td><td style="min-width:320px">${esc(i.fix || i.note)}</td></tr>`), { h: 360 })}<p class="hint">${c.count > 60 ? 'The full list is in the Excel download.' : ''}</p></details>`;
    h += `</section>`;
  }
  return h;
}

/* ---------- manpower ---------- */
function qMan(q) {
  const m = q.man, rx = (() => { try { return new RegExp(S.cfg.noEquipRegex || '$^', 'i'); } catch (e) { return /$^/; } })();
  const eqNeeded = S.cfg.projectType === 'infrastructure'; const noEq = m.consNoEq.filter(t => !rx.test(t.name));
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  let h = `<section class="card"><h2>Is manpower assigned? ${m.labTasks ? qchip('Yes', 'ok') : qchip('No', 'bad')}</h2><div class="kv"><span>Activities with labour <b>${fmtN(m.labTasks)} of ${fmtN(m.nonMile)} · ${pct(m.labTasks, m.nonMile)}</b></span><span>Activities with equipment <b>${fmtN(m.eqTasks)} · ${pct(m.eqTasks, m.nonMile)}</b></span><span>Labour hours <b>${fmtN(Math.round(m.labHours))}</b></span><span>Equipment hours <b>${fmtN(Math.round(m.eqHours))}</b></span><span>Peak labour <b>${Math.round(m.labPeak)} people</b></span><span>Peak equipment <b>${Math.round(m.eqPeak)} units</b></span></div>`;
  if (!m.labTasks) h += `<p class="bad">No labour is assigned to any activity.${m.labDict ? ' The resource list has ' + m.labDict + ' labour resource(s), but none carries hours on an activity.' : ' There is no labour resource in the resource list.'}</p>`;
  if (!m.eqTasks && eqNeeded) h += `<p class="bad">No equipment is assigned to any activity (project type is infrastructure).</p>`;
  h += `<p class="hint">People per day = assigned hours ÷ working days of the activity ÷ hours per day.</p></section>`;
  if (m.labTasks || m.eqTasks) h += `<section class="card"><h2>Manpower histogram <small>average per working day, by month</small></h2><div class="dg">${qManSVG(q)}</div><div class="actions"><button class="btn sm" data-qx="manpng">Download chart (PNG)</button></div></section>`;
  const rr = q.res.filter(r => ['RT_Labor', 'RT_Equip'].includes(r.type)).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.typeName)}</td>${qtd(fmtN(r.tasks), 1)}${qtd(fmtN(Math.round(r.qty)), 1)}${qtd(fmtN(Math.round(r.cost)), 1)}</tr>`);
  h += `<section class="card"><h2>Resources assigned</h2>${rr.length ? qtbl(['Resource', 'Type', 'Activities', 'Units (hours)', 'Cost (SAR)'], rr, { num: [2, 3, 4], h: 280 }) : '<p class="hint">No labour or equipment resource is assigned to any activity.</p>'}
  <p class="hint">Other resources used: ${q.res.filter(r => !['RT_Labor', 'RT_Equip'].includes(r.type)).map(r => esc(r.name) + ' (' + esc(r.typeName || 'untyped') + ')').join(', ') || 'none'}.</p></section>`;
  const list = (t, arr) => `<details><summary>${t}: ${fmtN(arr.length)}</summary>${qtbl(['ID', 'Activity', 'WBS'], arr.slice(0, 200).map(x => `<tr><td class="nw">${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.wbsPath)}</td></tr>`), { h: 300 })}${arr.length > 200 ? '<p class="hint">First 200 shown; the Excel download has all.</p>' : ''}</details>`;
  h += `<section class="card"><h2>Activities without resources</h2>${list('Construction activities without labour (' + pct(m.consNoLab.length, m.cons) + ' of ' + fmtN(m.cons) + ')', m.consNoLab)}${eqNeeded ? list('Construction activities without equipment (survey / leakage tests exempt)', noEq) : ''}${list('Activities with no resource at all', m.noAny)}</section>`;
  return h;
}

/* ---------- activity codes ---------- */
function qCodeRows(q, filter) {
  const types = q.codes.types.filter(t => t.coded).slice(0, 8), f = (filter || '').toLowerCase(); const out = [];
  for (const t of S.M.tasks) { const cs = types.map(ty => { const c = t.codes[ty.name]; return c ? (c.short || c.name) : ''; }); if (f && !(t.code + ' ' + t.name + ' ' + cs.join(' ')).toLowerCase().includes(f)) continue; out.push(`<tr><td class="nw">${esc(t.code)}</td><td>${esc(t.name)}</td>${cs.map(c => `<td>${c ? esc(c) : '<span class="bad">–</span>'}</td>`).join('')}</tr>`); if (out.length >= 200) break; }
  return { types, rows: out };
}
function qCodes(q) {
  const c = q.codes; let h = '';
  if (c.noTypes) return `<section class="card"><h2>Activity codes ${qchip('None', 'bad')}</h2><p class="bad">No activity code types are defined in this XER, so no activity carries a code.</p></section>`;
  h += `<section class="card"><h2>Are activity codes assigned? ${c.any ? qchip(c.any + ' of ' + q.over.tasks + ' activities coded', c.any === q.over.tasks ? 'ok' : '') : qchip('None assigned', 'bad')}</h2>${qtbl(['Code type', 'Scope', 'Values defined', 'Activities coded', 'Coded %', 'Not coded'], c.types.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.scope)}</td>${qtd(t.defined, 1)}${qtd(fmtN(t.coded), 1)}${qtd(t.pct.toFixed(0) + '%', 1)}${qtd(t.uncoded ? `<b class="bad">${fmtN(t.uncoded)}</b>` : '0', 1)}</tr>`), { num: [2, 3, 4, 5], h: 300 })}</section>`;
  h += `<section class="card"><h2>What the codes are <small>values in use and how many activities carry each</small></h2>${c.types.map(t => `<details><summary>${esc(t.name)} · ${t.values.length} value(s) in use</summary>${t.values.length ? qtbl(['Value', 'Description', 'Activities'], t.values.map(v => `<tr><td class="nw">${esc(v.short)}</td><td>${esc(v.name)}</td>${qtd(fmtN(v.n), 1)}</tr>`), { num: [2], h: 260 }) : '<p class="hint">Defined but not used on any activity.</p>'}</details>`).join('')}</section>`;
  const un = c.uncoded; h += `<section class="card"><h2>Activities without any code: ${fmtN(un.length)}</h2>${un.length ? `<details><summary>Show list</summary>${qtbl(['ID', 'Activity', 'WBS'], un.slice(0, 200).map(x => `<tr><td class="nw">${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.wbsPath)}</td></tr>`), { h: 300 })}${un.length > 200 ? '<p class="hint">First 200 shown; the Excel download has all.</p>' : ''}</details>` : '<p class="ok">Every activity carries at least one code.</p>'}</section>`;
  const r = qCodeRows(q, S.qk.codeFilter);
  h += `<section class="card"><h2>Codes by activity</h2><input id="q-codefilter" placeholder="Filter by ID, name or code value…" value="${esc(S.qk.codeFilter)}" style="max-width:420px;margin-bottom:10px"><div id="q-codetable">${qtbl(['ID', 'Activity'].concat(r.types.map(t => esc(t.name))), r.rows, { h: 420 })}</div><p class="hint">First 200 matching activities; the Excel download has all of them with every code type.</p></section>`;
  return h;
}

/* ---------- calendars ---------- */
const QCOL = ['#0b7a75', '#c58a1b', '#4a6fa5', '#b4412f', '#7a5ea8', '#6b8f3a', '#8a6d5a', '#3d8fa8'];
function qCal(q) {
  const c = q.cal, hol = c.holidays, col = {}; c.used.forEach((x, i) => col[x.id] = QCOL[i % QCOL.length]);
  const calsMiss = c.used.filter(x => x.hsMiss).length, wrong = c.wrong;
  const vt = (title, kind, big, sub) => `<div class="vt ${kind}"><span>${title}</span><b>${big}</b><small>${sub}</small></div>`;
  let h = `<div class="verd">${vt('Calendars in use', 'info', c.used.length, c.unused ? c.unused + ' more defined but not used' : 'all defined calendars are used')}
  ${vt('Public holidays', calsMiss ? 'bad' : 'ok', calsMiss ? calsMiss + ' of ' + c.used.length + ' calendars miss holidays' : 'All holidays set', hol.length + ' holidays checked inside the project window')}
  ${vt('Calendar rules', wrong ? 'bad' : 'ok', wrong ? fmtN(wrong) + ' activities differ' : 'All as expected', 'week length per category, from Project setup')}</div>`;
  /* one card per calendar: week, holidays, who uses it */
  h += `<section class="card" style="margin-top:16px"><h2>The calendars <small>working week, holidays and what uses each one</small></h2><div class="cc">${c.used.map(r => {
    const cal = S.M.cal[r.id], cats = Object.entries(r.cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="uc">${esc(QCAT[k] || k)} <b>${fmtN(n)}</b></span>`).join('');
    return `<div class="cal" style="--c:${col[r.id]}"><h3>${esc(r.name)}</h3><div class="sub">${esc(r.scope)} calendar · ${r.dayHr} h per day · ${fmtN(r.tasks)} activities · ${r.exceptions} exception days</div>
    <div class="days">${E.WD.map((d, i) => `<span class="day ${cal.dow[i + 1] ? 'on' : ''}">${d}</span>`).join('')}</div>
    <div class="lbl">Holidays</div><div class="hl">${r.hs.length ? r.hs.map(x => `<span class="hc ${x.status}" title="${esc(x.status === 'ok' ? 'Non-working day' : x.status === 'partial' ? 'Only some of the days are non-working' : 'Shown as a working day')}">${x.status === 'ok' ? '✓' : x.status === 'partial' ? '~' : '✕'} ${esc(x.h.name)}${x.h.approx ? ' *' : ''}</span>`).join('') : '<span class="mut">none inside the project window</span>'}</div>
    <div class="lbl">Used by</div><div class="hl">${cats}</div></div>`; }).join('')}</div>
  <p class="hint">✓ set as non-working · ~ partly set · ✕ still a working day.${c.approxEid ? ' <b>* Eid dates are approximate</b> – enter the exact ranges in Confirmations for a firm result.' : ''}</p>
  ${c.unused ? `<details><summary>${c.unused} other calendar(s) are defined but no activity uses them</summary><div class="hl" style="margin-top:8px">${c.rows.filter(r => !r.tasks).map(r => `<span class="uc">${esc(r.name)} · ${esc(r.week)}</span>`).join('')}</div></details>` : ''}</section>`;
  /* which calendar is assigned to which category / WBS branch */
  const v = S.qk.calView, rows = v === 'cat' ? c.byCat : c.byWbs;
  h += `<section class="card"><h2>Which calendar is assigned to what?</h2><div class="chips"><button data-qcv="cat" class="${v === 'cat' ? 'on' : ''}">By category</button><button data-qcv="wbs" class="${v === 'wbs' ? 'on' : ''}">By WBS branch</button></div>
  <div class="leg">${c.used.map(x => `<span><i class="dot" style="background:${col[x.id]}"></i>${esc(x.name)} <span class="mut">(${esc(x.week)})</span></span>`).join('')}${v === 'cat' ? '<span><i class="dot" style="box-shadow:inset 0 0 0 2px var(--bad);background:transparent"></i>red outline = not the expected week</span>' : ''}</div>`;
  h += rows.map(r => {
    const segs = c.used.filter(x => r.cells[x.id]).map(x => { const n = r.cells[x.id], pct = n / r.total * 100; const cal = S.M.cal[x.id]; let bad = false; if (v === 'cat' && r.expected != null && r.key !== 'milestone') bad = cal.wdw !== r.expected || (r.expected === 5 && (cal.dow[6] || cal.dow[7])); const act = S.qk.detail && S.qk.detail.v === v && S.qk.detail.row === r.key && String(S.qk.detail.cal) === String(x.id);
      return `<div class="seg ${bad ? 'bad' : ''} ${act ? 'act' : ''}" style="flex:${n};background:${col[x.id]}" data-qcell="${esc(r.key)}|${x.id}" title="${esc(x.name)}: ${fmtN(n)} activities (${pct.toFixed(0)}%)">${pct >= 9 ? fmtN(n) : ''}</div>`; }).join('');
    const exp = v === 'cat' ? (r.expected == null || r.key === 'milestone' ? '<span class="mut">no rule</span>' : (r.wrong ? `<span class="bad"><b>${fmtN(r.wrong)} differ</b> · expects ${r.expected}-day week${r.expected === 5 ? ' (Fri &amp; Sat off)' : ''}</span>` : `<span class="ok">✓ ${r.expected}-day week as expected</span>`)) : '';
    return `<div class="crow ${v === 'cat' ? '' : 'two'}"><div><b>${esc(r.label)}</b><div class="mut" style="font-size:12.5px">${fmtN(r.total)} ${r.total === 1 ? 'activity' : 'activities'}</div></div><div class="sbar">${segs}</div>${v === 'cat' ? `<div style="font-size:12.5px">${exp}</div>` : ''}</div>`; }).join('');
  h += `<p class="hint">${v === 'cat' ? 'Categories come from the WBS names; the expected week comes from the calendar rules in Project setup. ' : ''}Click a coloured bar to list those activities.</p><div id="q-detail">${qDetail(q)}</div></section>`;
  return h;
}
const QCAT = { general: 'General', mobilization: 'Mobilization', engineering: 'Engineering', procurement: 'Procurement', delivery: 'Material delivery', construction: 'Construction', closeout: 'Close-out / testing', milestone: 'Milestones', approval: 'Approvals' };
function qDetail(q) {
  const d = S.qk.detail; if (!d) return ''; const c = q.cal; const rows = d.v === 'cat' ? c.byCat : c.byWbs; const r = rows.find(x => x.key === d.row); if (!r) return '';
  const top = t => { const w = S.M.wbs[t.wbs]; return w ? (w.path[1] || w.path[0] || '(no WBS)') : '(no WBS)'; };
  const list = S.M.tasks.filter(t => String(t.clndr) === String(d.cal) && (d.v === 'cat' ? c.keyOf(t) === d.row : top(t) === d.row));
  return `<h3 style="margin:14px 0 6px;font-size:14px">${esc(r.label)} on “${esc((S.M.cal[d.cal] || {}).name)}” – ${fmtN(list.length)} activities</h3>${qtbl(['ID', 'Activity', 'WBS'], list.slice(0, 300).map(x => `<tr><td class="nw">${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.wbsPath)}</td></tr>`), { h: 320 })}${list.length > 300 ? '<p class="hint">First 300 shown; the Excel download lists them all.</p>' : ''}`;
}

/* ---------- Excel download ---------- */
async function qExport() {
  const q = S.qk.q || qCompute(); const rules = qRules(); const X = await lib('exceljs'); const wb = new X.Workbook(); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool'; wb.created = new Date();
  const NAVY = 'FF1B2A41'; const hdr = (ws, r) => { const row = ws.getRow(r); row.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', wrapText: true }; }); row.height = 22; };
  const title = (ws, t, sub, cols) => { ws.mergeCells(1, 1, 1, cols || 6); ws.getCell('A1').value = t; ws.getCell('A1').font = { size: 15, bold: true, color: { argb: NAVY } }; if (sub) { ws.getCell('A2').value = sub; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6B7B' } }; } };
  const put = (ws, r, vals) => { const row = ws.getRow(r); row.values = vals; return row; };
  const tableSheet = (name, ttl, sub, head, rows, widths, hRow) => { const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: hRow || 4 }] }); title(ws, ttl, sub, head.length); put(ws, hRow || 4, head); hdr(ws, hRow || 4); ws.columns = widths.map(w => ({ width: w })); rows.forEach(r => ws.addRow(r)); if (rows.length) ws.autoFilter = { from: { row: hRow || 4, column: 1 }, to: { row: (hRow || 4) + rows.length, column: head.length } }; return ws; };
  const info = 'Project: ' + (S.cfg.projectName || '') + '   |   File: ' + (S.xerName || '') + '   |   Data date: ' + E.fmtDate(q.over.dataDate);
  // summary
  const sm = wb.addWorksheet('Summary'); title(sm, 'Quick review – summary', info, 3); sm.columns = [{ width: 30 }, { width: 28 }, { width: 90 }];
  put(sm, 4, ['Area', 'Result', 'Detail']); hdr(sm, 4);
  const relFail = rules.filter(r => r.status === 'fail');
  [['Activities / links', fmtN(q.over.nonMile) + ' / ' + fmtN(q.over.links), 'Milestones ' + q.over.miles + ' · WBS ' + q.over.wbs + ' · calendars ' + q.over.calendars],
  ['Loading profile', q.load && !q.load.none ? ({ back: 'Back-loaded', front: 'Front-loaded', mixed: 'Mixed', balanced: 'Balanced' })[q.load.verdict] : 'n/a', q.load && !q.load.none ? q.load.remain + '% of the budget remains after ' + q.load.timePct + '% of the time; ' + q.load.early + '% earned by ' + q.load.frontPct + '%; centre of gravity ' + q.load.cg + '%' : ''],
  ['Cash flow', q.cash.none ? 'No budget found' : 'SAR ' + fmtN(Math.round(q.cash.total)), q.cash.none ? 'All assignment costs are zero' : q.cash.months.length + ' months; ' + q.cash.firstHalfPct.toFixed(0) + '% in the first half; measure: ' + q.cash.usedMeasures.join(', ')],
  ['Relationship rules', relFail.length ? relFail.length + ' failed' : 'All pass', rules.map(r => r.id + ': ' + (r.status === 'fail' ? r.count + ' found' : r.status)).join(' · ')],
  ['Manpower', q.man.labTasks ? q.man.labTasks + ' activities with labour' : 'No labour assigned', 'Equipment on ' + q.man.eqTasks + ' activities · peak ' + Math.round(q.man.labPeak) + ' people / ' + Math.round(q.man.eqPeak) + ' equipment'],
  ['Activity codes', q.codes.noTypes ? 'None defined' : q.codes.any + ' of ' + q.over.tasks + ' coded', q.codes.types.map(t => t.name + ' (' + t.coded + ')').join(' · ')],
  ['Calendars', q.cal.used.length + ' in use', q.cal.wrong + ' activities on an unexpected calendar · ' + q.cal.holGaps + ' holiday gap(s)' + (q.cal.approxEid ? ' · Eid dates approximate' : '')]].forEach(r => sm.addRow(r));
  // loading profile
  if (q.load && !q.load.none) { const L = q.load; const ls = tableSheet('Loading profile', 'Front / balanced / back-loaded, from the budgeted cost', info, ['Test', 'Result', 'Limit', 'Status'], L.tests.map(t => [t.name, t.value + (t.unit === '×' ? '×' : '%'), (t.dir === 'max' ? 'not above ' : 'not below ') + t.limit + (t.unit === '×' ? '×' : '%'), t.fail ? 'Outside the limit (' + ({ back: 'back-loading', front: 'front-loading', spike: 'concentrated month' })[t.side] + ')' : 'Within the limit']), [58, 14, 20, 40]); const vr = ls.addRow(['Verdict', ({ back: 'Back-loaded', front: 'Front-loaded', mixed: 'Mixed', balanced: 'Balanced' })[L.verdict], '', L.text]); vr.font = { bold: true }; }
  // cash flow
  const cs = tableSheet('Cash flow', 'Budgeted cost by month', info, ['Month', 'Budgeted cost (SAR)', 'Cumulative (SAR)', 'Cumulative %'], q.cash.months.map(m => [fmtM(m.ym), Math.round(m.cost), Math.round(m.cum), Math.round(m.cumPct * 10) / 10]), [14, 22, 22, 16]);
  cs.getColumn(2).numFmt = '#,##0'; cs.getColumn(3).numFmt = '#,##0';
  if (!q.cash.none) { try { const png = await svgToPng(qCashSVG(q), 2); const id = wb.addImage({ buffer: await png.arrayBuffer(), extension: 'png' }); cs.addImage(id, { tl: { col: 5, row: 3 }, ext: { width: 780, height: 255 } }); } catch (e) { } }
  // relationships
  const rs = wb.addWorksheet('Relationships'); title(rs, 'Relationship rules', info, 6); put(rs, 4, ['Statistic', 'Value']); hdr(rs, 4);
  [['Links', q.rel.total], ['Finish-to-Start', q.rel.types.FS], ['Start-to-Start', q.rel.types.SS], ['Finish-to-Finish', q.rel.types.FF], ['Start-to-Finish', q.rel.types.SF], ['Positive lags', q.rel.lagPos], ['Negative lags', q.rel.lagNeg], ['No predecessor', q.rel.noPred], ['No successor', q.rel.noSucc]].forEach(r => rs.addRow(r));
  rs.addRow([]); const h2 = rs.rowCount + 1; put(rs, h2, ['Rule', 'Result', 'Summary', 'Rule text']); hdr(rs, h2); rules.forEach(r => rs.addRow([r.id + ' ' + r.title, r.status === 'fail' ? r.count + ' found' : r.status, r.summary, r.rule])); rs.columns = [{ width: 46 }, { width: 16 }, { width: 60 }, { width: 80 }];
  const all = []; rules.forEach(r => r.items.forEach(i => all.push([r.id + ' ' + r.title, i.id, i.name, i.wbs, i.field, i.value, i.note, i.fix || ''])));
  tableSheet('Relationship issues', 'Every activity or link that breaks a rule', info, ['Rule', 'ID', 'Activity / link', 'WBS', 'Issue', 'Value', 'Note', 'Suggested correct logic'], all, [34, 28, 62, 44, 30, 28, 30, 90]);
  // manpower
  const ms = tableSheet('Manpower', 'Manpower and equipment by month', info, ['Month', 'Labour – average people', 'Labour – peak day', 'Equipment – average units', 'Equipment – peak day'], q.man.months.map(m => [fmtM(m.ym), Math.round(m.lab * 10) / 10, Math.round(m.labPeak * 10) / 10, Math.round(m.eq * 10) / 10, Math.round(m.eqPeak * 10) / 10]), [14, 24, 20, 26, 22]);
  ms.addRow([]); const h3 = ms.rowCount + 1; put(ms, h3, ['Resource', 'Type', 'Activities', 'Units', 'Cost (SAR)']); hdr(ms, h3); q.res.forEach(r => ms.addRow([r.name, r.typeName, r.tasks, Math.round(r.qty), Math.round(r.cost)]));
  const nr = (arr, why) => arr.map(t => [why, t.code, t.name, t.wbsPath]); tableSheet('No resources', 'Activities missing resources', info, ['Missing', 'ID', 'Activity', 'WBS'], [].concat(nr(q.man.consNoLab, 'Construction without labour'), nr(q.man.consNoEq, 'Construction without equipment'), nr(q.man.noAny, 'No resource at all')), [30, 28, 62, 50]);
  // codes
  tableSheet('Code types', 'Activity code types', info, ['Code type', 'Scope', 'Values defined', 'Activities coded', 'Coded %', 'Not coded'], q.codes.types.map(t => [t.name, t.scope, t.defined, t.coded, Math.round(t.pct), t.uncoded]), [34, 12, 16, 18, 12, 14]);
  const vr = []; q.codes.types.forEach(t => t.values.forEach(v => vr.push([t.name, v.short, v.name, v.n]))); tableSheet('Code values', 'Code values in use', info, ['Code type', 'Value', 'Description', 'Activities'], vr, [34, 18, 56, 14]);
  const cr = qCodeRows(q, ''), types = q.codes.types.filter(t => t.coded); const ca = []; S.M.tasks.forEach(t => ca.push([t.code, t.name, t.wbsPath].concat(types.map(ty => { const c = t.codes[ty.name]; return c ? (c.short || c.name) : ''; }))));
  tableSheet('Codes by activity', 'Code values on every activity', info, ['ID', 'Activity', 'WBS'].concat(types.map(t => t.name)), ca, [28, 60, 44].concat(types.map(() => 16)));
  // calendars
  tableSheet('Calendars', 'Calendars', info, ['Calendar', 'Scope', 'Working week', 'Hours / day', 'Activities', 'Exceptions', 'Holidays set', 'Holidays missing', 'Used by (category: activities)'], q.cal.rows.map(r => [r.name, r.scope, r.week, r.dayHr, r.tasks, r.exceptions, r.hsOk, r.hsMiss, Object.entries(r.cats).map(([k, n]) => k + ': ' + n).join('; ')]), [38, 10, 18, 12, 12, 12, 14, 16, 70]);
  const hm = q.cal.holidays; tableSheet('Holidays', 'Holidays inside the project window' + (q.cal.approxEid ? ' (Eid dates approximate)' : ''), info, ['Calendar'].concat(hm.map(h => h.name + (h.approx ? ' *' : '') + ' (' + E.fmtDate(h.from) + (h.to > h.from ? ' – ' + E.fmtDate(h.to) : '') + ')')), q.cal.used.map(r => [r.name].concat(r.hs.map(x => x.status === 'ok' ? 'Non-working' : x.status === 'partial' ? 'Partly working' : 'Working day'))), [38].concat(hm.map(() => 24)));
  const mat = (rows, kind) => rows.map(r => [r.label, r.total].concat(q.cal.used.map(c => r.cells[c.id] || 0)).concat(kind === 'cat' ? [r.expected == null || r.key === 'milestone' ? '' : r.expected + '-day', r.wrong || 0] : []));
  tableSheet('Calendar by category', 'Activities per calendar, by category', info, ['Category', 'Activities'].concat(q.cal.used.map(c => c.name + ' (' + c.week + ')')).concat(['Expected week', 'Activities that differ']), mat(q.cal.byCat, 'cat'), [28, 12].concat(q.cal.used.map(() => 22)).concat([14, 18]));
  tableSheet('Calendar by WBS', 'Activities per calendar, by WBS branch', info, ['WBS branch', 'Activities'].concat(q.cal.used.map(c => c.name + ' (' + c.week + ')')), mat(q.cal.byWbs, 'wbs'), [50, 12].concat(q.cal.used.map(() => 22)));
  const al = S.M.tasks.map(t => [t.code, t.name, t.wbsPath, (S.M.cal[t.clndr] || {}).name || t.clndr, q.cal.keyOf(t)]); tableSheet('Calendar by activity', 'Calendar assigned to every activity', info, ['ID', 'Activity', 'WBS', 'Calendar', 'Category'], al, [28, 60, 50, 36, 18]);
  const buf = await wb.xlsx.writeBuffer(); download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (S.cfg.projectName || 'Project') + '_Quick_Review.xlsx');
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target; let el;
  if ((el = t.closest('[data-qtab]'))) { S.qk.tab = el.dataset.qtab; if (S.step !== 'quick') return; qRenderTab(); return; }
  if ((el = t.closest('[data-qcv]'))) { S.qk.calView = el.dataset.qcv; S.qk.detail = null; qRenderTab(); return; }
  if ((el = t.closest('[data-qcell]'))) { const [row, cal] = el.dataset.qcell.split('|'); const d = S.qk.detail; S.qk.detail = d && d.row === row && String(d.cal) === cal && d.v === S.qk.calView ? null : { v: S.qk.calView, row, cal }; qRenderTab(); const dd = $('#q-detail'); if (dd && S.qk.detail) dd.scrollIntoView({ block: 'nearest' }); return; }
  if ((el = t.closest('[data-qx]'))) {
    const k = el.dataset.qx;
    try {
      if (k === 'xlsx') { await qExport(); toast('Quick review Excel created', 'ok'); }
      else if (k === 'cashpng') download(await svgToPng(qCashSVG(S.qk.q), 2), (S.cfg.projectName || 'Project') + '_cash_flow.png');
      else if (k === 'manpng') download(await svgToPng(qManSVG(S.qk.q), 2), (S.cfg.projectName || 'Project') + '_manpower.png');
    } catch (err) { console.error(err); toast(err.message, 'bad'); }
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.type === 'file' && el.id === 'q-xer' && el.files.length) { qLoadXer(el.files[0]); return; }
  if (el.dataset.qmeas) { S.qk.measure[el.dataset.qmeas] = el.value; qCompute(); qRenderTab(); }
  if (el.dataset.qlim) { const v = parseFloat(el.value); if (!isNaN(v) && v >= 0) { S.cfg[el.dataset.qlim] = v; autosave(); qCompute(); qRenderTab(); } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q-codefilter') { S.qk.codeFilter = e.target.value; const r = qCodeRows(S.qk.q, S.qk.codeFilter); $('#q-codetable').innerHTML = qtbl(['ID', 'Activity'].concat(r.types.map(t => esc(t.name))), r.rows, { h: 420 }); }
});
['drop'].forEach(ev => document.addEventListener(ev, e => { const d = e.target.closest('.drop'); if (d && d.querySelector('#q-xer') && e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); qLoadXer(e.dataTransfer.files[0]); } }));
