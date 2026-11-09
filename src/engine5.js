/* ===== ENGINE PART 5: quick review (XER only) ===== */
E.QUICK_REL = ['Q1', 'Q2', 'L2', 'L3', 'L4', 'L5', 'L6', 'L17'];
E.RT = { RT_Labor: 'Labour', RT_Equip: 'Equipment', RT_Mat: 'Material', RT_Nonlabor: 'Non-labour' };
E.WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
E.weekText = cal => { const on = E.WD.filter((d, i) => cal.dow[i + 1]), off = E.WD.filter((d, i) => !cal.dow[i + 1]); return on.length ? (off.length ? off.join(' & ') + ' off' : '7 days') : 'no working days'; };

/* holidays inside the project window; Eid ranges come from the project's list, otherwise approximate dates */
E.quickHolidays = function (M, cfg) {
  const y0 = new Date(M.minES * MS).getUTCFullYear(), y1 = new Date(M.maxEF * MS).getUTCFullYear(), out = [];
  for (let y = y0; y <= y1; y++) for (const f of E.FIXED_HOLIDAYS) { const d = Math.floor(Date.UTC(y, f.m - 1, f.d) / MS); out.push({ name: f.name + ' ' + y, from: d, to: d, approx: false }); }
  for (let y = y0 - 0; y <= y1; y++) for (const type of ['Eid al-Fitr', 'Eid al-Adha']) {
    const es = (cfg.eid || []).filter(e => +e.year === y && e.type === type && !e.none && e.from);
    if (es.length) { es.forEach(e => out.push({ name: type + ' ' + y, from: E.strToDay(e.from), to: E.strToDay(e.to || e.from), approx: false })); continue; }
    if ((cfg.eid || []).some(e => +e.year === y && e.type === type && e.none)) continue;
    const ap = E.EID_APPROX[type][y]; if (ap) { const a = E.strToDay(ap); out.push({ name: type + ' ' + y, from: a, to: a + 4, approx: true }); }
  }
  return out.filter(h => h.to >= M.minES && h.from <= M.maxEF).sort((a, b) => a.from - b.from);
};

E.loadProfile = function (cost, d0, N, months, total, cfg) {
  const L = { none: !(total > 0), tests: [], marks: [] }; if (L.none) return L;
  const D = k => { const v = cfg[k]; return v == null || isNaN(+v) ? E.EXTRA_DEFAULTS[k] : +v; };
  const tp = Math.min(99, Math.max(1, D('curveTimePct'))), fp = Math.min(99, Math.max(1, D('loadFrontPct')));
  const cumAt = p => { const n = Math.max(1, Math.min(N, Math.round(p / 100 * N))); let c = 0; for (let i = 0; i < n; i++) c += cost[i]; return c / total * 100; };
  const early = cumAt(fp), done = cumAt(tp), remain = 100 - done; let cg = 0; for (let i = 0; i < N; i++) cg += cost[i] * (N > 1 ? i / (N - 1) : 0); cg = cg / total * 100;
  const avg = total / months.length, pk = months.reduce((a, m) => m.cost > a.cost ? m : a, months[0]), mult = pk.cost / avg;
  const r1 = x => Math.round(x * 10) / 10;
  L.early = r1(early); L.done = r1(done); L.remain = r1(remain); L.cg = r1(cg); L.peakMult = r1(mult); L.peakYm = pk.ym; L.peakPct = r1(pk.cost / total * 100); L.timePct = tp; L.frontPct = fp;
  const T = (id, name, value, limit, dir, fail, side, unit) => L.tests.push({ id, name, value, limit, dir, fail, side, unit });
  T('remain', 'Budget still to be earned after ' + tp + '% of the time', r1(remain), D('curveRemainMax'), 'max', remain > D('curveRemainMax'), 'back', '%');
  T('cgmax', 'Centre of gravity of the budget (share of duration)', r1(cg), D('curveCgMax'), 'max', cg > D('curveCgMax'), 'back', '%');
  T('early', 'Budget already earned after ' + fp + '% of the time', r1(early), D('loadFrontMax'), 'max', early > D('loadFrontMax'), 'front', '%');
  T('cgmin', 'Centre of gravity of the budget (share of duration)', r1(cg), D('loadCgMin'), 'min', cg < D('loadCgMin'), 'front', '%');
  T('peak', 'Busiest month against the average month', r1(mult), D('curveMonthMult'), 'max', mult > D('curveMonthMult'), 'spike', '×');
  const back = L.tests.some(t => t.fail && t.side === 'back'), front = L.tests.some(t => t.fail && t.side === 'front');
  L.verdict = back && front ? 'mixed' : back ? 'back' : front ? 'front' : 'balanced';
  L.text = { back: 'Back-loaded: the budget is earned late. A delay in the first part is hidden and the final stretch carries the risk – little time is left to recover.', front: 'Front-loaded: the budget is earned early, so the programme looks ahead at the start. Check that the early weight is real work and not mobilization, submittals or procurement.', mixed: 'Mixed: some tests point to front-loading and others to back-loading. Look at the shape of the curve.', balanced: 'Balanced: the budget is spread without a strong early or late bias.' }[L.verdict];
  const dayPos = day => { const i = months.findIndex(m => day >= m.a && day <= m.b); return i < 0 ? null : i + (day - months[i].a + 0.5) / (months[i].b - months[i].a + 1); };
  [[tp, 'time point'], [fp, 'front point']].forEach(([p, l]) => { const day = d0 + Math.max(0, Math.round(p / 100 * N) - 1), pos = dayPos(day); if (pos != null) L.marks.push({ pos, label: p + '% of time', day }); });
  return L;
};
E.quick = function (M, cfg, opt) {
  opt = opt || {}; const q = {};
  const T = M.tasks, nonMile = T.filter(t => !t.isMile);
  const r1 = x => Math.round(x * 10) / 10;

  /* ---------- overview ---------- */
  q.over = { tasks: T.length, nonMile: nonMile.length, miles: T.length - nonMile.length, links: M.links.length, wbs: Object.keys(M.wbs).length, calendars: Object.keys(M.cal).length, resources: Object.keys(M.rsrc).length, dataDate: M.dataDate, start: M.minES, finish: M.maxEF, planStart: M.planStart, planEnd: M.planEnd };

  /* ---------- resources and the measure used for the cash flow ---------- */
  const byR = {};
  for (const a of M.asg) { const r = byR[a.rsrc] || (byR[a.rsrc] = { id: a.rsrc, n: 0, tasks: new Set(), qty: 0, cost: 0 }); r.n++; r.tasks.add(a.task.id); r.qty += a.qty; r.cost += a.cost; }
  q.res = Object.values(byR).map(r => { const d = M.rsrc[r.id] || {}; return { id: r.id, name: d.name || String(r.id), type: d.type || '', typeName: E.RT[d.type] || d.type || '', assignments: r.n, tasks: r.tasks.size, qty: r.qty, cost: r.cost, price: r.qty ? r.cost / r.qty : 0 }; }).sort((a, b) => b.cost - a.cost || b.qty - a.qty);
  const progId = cfg.rsrc && cfg.rsrc.progress, costId = cfg.rsrc && cfg.rsrc.cost;
  const anyCost = q.res.some(r => r.cost > 0);
  for (const r of q.res) {
    if (r.id === progId) r.defMeasure = 'exclude';
    else if (r.cost > 0) r.defMeasure = 'cost';
    else if (r.id === costId && r.qty > 0) r.defMeasure = 'units';
    else r.defMeasure = 'exclude';
    r.measure = (opt.measure && opt.measure[r.id]) || r.defMeasure;
  }
  const meas = {}; q.res.forEach(r => meas[r.id] = r.measure);

  /* ---------- daily spread of cost and manpower ---------- */
  const spans = M.asg.map(a => { const t = a.task; return { a, s: a.start != null ? a.start : (t.ts != null ? t.ts : t.es), e: a.end != null ? a.end : (t.te != null ? t.te : t.ef) }; }).filter(x => x.s != null && x.e != null);
  let d0 = Infinity, d1 = -Infinity; spans.forEach(x => { if (x.s < d0) d0 = x.s; if (x.e > d1) d1 = x.e; });
  if (!isFinite(d0)) { d0 = M.minES; d1 = M.maxEF; }
  const N = Math.max(1, d1 - d0 + 1), cost = new Float64Array(N), lab = new Float64Array(N), eq = new Float64Array(N);
  let spread = 0, noSpan = 0;
  for (const x of spans) {
    const a = x.a, t = a.task, cal = M.cal[t.clndr], r = M.rsrc[a.rsrc] || {}; const m = meas[a.rsrc];
    const amt = m === 'cost' ? a.cost : m === 'units' ? a.qty : 0; const isLab = r.type === 'RT_Labor' && a.qty > 0, isEq = r.type === 'RT_Equip' && a.qty > 0;
    if (!amt && !isLab && !isEq) continue;
    const s = Math.min(x.s, x.e), e = Math.max(x.s, x.e); const days = [];
    if (cal) for (let d = s; d <= e; d++) if (E.isWorking(cal, d)) days.push(d);
    if (!days.length) for (let d = s; d <= e; d++) days.push(d);
    const n = days.length, hr = (cal && cal.dayHr) || 8;
    for (const d of days) { const i = d - d0; if (amt) cost[i] += amt / n; if (isLab) lab[i] += (a.qty / n) / hr; if (isEq) eq[i] += (a.qty / n) / hr; }
    spread++;
  }
  M.asg.forEach(a => { const t = a.task; if (!(a.start != null || t.ts != null || t.es != null)) noSpan++; });

  /* ---------- cash flow by month ---------- */
  const months = []; const mk = new Map();
  for (let i = 0; i < N; i++) {
    const d = d0 + i, k = E.ym(d); let m = mk.get(k); if (!m) { m = { ym: k, a: d, b: d, cost: 0, labSum: 0, labN: 0, labPeak: 0, eqSum: 0, eqN: 0, eqPeak: 0 }; mk.set(k, m); months.push(m); }
    m.b = d; m.cost += cost[i]; if (lab[i] > 0) { m.labSum += lab[i]; m.labN++; if (lab[i] > m.labPeak) m.labPeak = lab[i]; } if (eq[i] > 0) { m.eqSum += eq[i]; m.eqN++; if (eq[i] > m.eqPeak) m.eqPeak = eq[i]; }
  }
  const total = months.reduce((s, m) => s + m.cost, 0); let cum = 0;
  months.forEach(m => { cum += m.cost; m.cum = cum; m.cumPct = total ? cum / total * 100 : 0; m.lab = m.labN ? m.labSum / m.labN : 0; m.eq = m.eqN ? m.eqSum / m.eqN : 0; });
  const half = d0 + (N - 1) / 2; let firstHalf = 0; for (let i = 0; i < N; i++) if (d0 + i <= half) firstHalf += cost[i];
  let pk = months[0]; months.forEach(m => { if (m.cost > pk.cost) pk = m; });
  q.cash = { months, total, d0, d1, none: !(total > 0), firstHalfPct: total ? firstHalf / total * 100 : 0, peak: total ? { ym: pk.ym, cost: pk.cost } : null, contract: cfg.contractValue || null, noSpan,
    zeroCostTasks: nonMile.filter(t => !t.asg.some(a => (meas[a.rsrc] === 'cost' && a.cost > 0) || (meas[a.rsrc] === 'units' && a.qty > 0))).length, usedMeasures: q.res.filter(r => r.measure !== 'exclude').map(r => r.name + ' (' + r.measure + ')') };

  /* ---------- loading profile: front-loaded / balanced / back-loaded, from the budgeted cost ---------- */
  q.load = E.loadProfile(cost, d0, N, months, total, cfg);

  /* ---------- relationships ---------- */
  const types = { FS: 0, SS: 0, FF: 0, SF: 0 }; let lagPos = 0, lagNeg = 0, fsLag = 0; const lagMax = { v: 0, l: null };
  for (const l of M.links) { types[l.type] = (types[l.type] || 0) + 1; if (l.lagWd > 0) { lagPos++; if (l.type === 'FS') fsLag++; if (l.lagWd > lagMax.v) { lagMax.v = l.lagWd; lagMax.l = l; } } else if (l.lagWd < 0) lagNeg++; }
  let noPred = 0, noSucc = 0; nonMile.forEach(t => { if (!t.pre.length) noPred++; if (!t.succ.length) noSucc++; });
  q.rel = { total: M.links.length, types, lagPos, lagNeg, fsLag, lagMax, noPred, noSucc, perAct: nonMile.length ? M.links.length / nonMile.length : 0, results: [], bad: M.badLinks.length };

  /* ---------- manpower ---------- */
  const withType = rx => nonMile.filter(t => t.asg.some(a => (M.rsrc[a.rsrc] || {}).type === rx && a.qty > 0));
  const labT = withType('RT_Labor'), eqT = withType('RT_Equip');
  const cons = nonMile.filter(t => t.cat === 'construction');
  const consNoLab = cons.filter(t => !labT.includes(t)), consNoEq = cons.filter(t => !eqT.includes(t));
  const labRes = q.res.filter(r => r.type === 'RT_Labor'), eqRes = q.res.filter(r => r.type === 'RT_Equip');
  const labDict = Object.values(M.rsrc).filter(r => r.type === 'RT_Labor').length, eqDict = Object.values(M.rsrc).filter(r => r.type === 'RT_Equip').length;
  let lp = 0, ep = 0; for (let i = 0; i < N; i++) { if (lab[i] > lp) lp = lab[i]; if (eq[i] > ep) ep = eq[i]; }
  q.man = { labTasks: labT.length, eqTasks: eqT.length, nonMile: nonMile.length, cons: cons.length, consNoLab, consNoEq, labRes, eqRes, labDict, eqDict, labHours: labRes.reduce((s, r) => s + r.qty, 0), eqHours: eqRes.reduce((s, r) => s + r.qty, 0), labPeak: lp, eqPeak: ep,
    noAny: nonMile.filter(t => !t.asg.length), months };

  /* ---------- activity codes ---------- */
  const T0 = M.T, tys = (T0.ACTVTYPE ? T0.ACTVTYPE.r : []), vals = (T0.ACTVCODE ? T0.ACTVCODE.r : []);
  const valsByType = {}; vals.forEach(v => (valsByType[v.actv_code_type_id] = valsByType[v.actv_code_type_id] || []).push(v));
  const scopeName = s => ({ AS_Global: 'Global', AS_Project: 'Project', AS_EPS: 'EPS' }[s] || s || '');
  q.codes = { types: [], uncoded: [], noTypes: !tys.length };
  const typeNames = tys.map(t => t.actv_code_type);
  for (const ty of tys) {
    const nm = ty.actv_code_type, cnt = new Map(); let coded = 0;
    for (const t of T) { const c = t.codes[nm]; if (c) { coded++; const k = c.short + '\u0001' + c.name; cnt.set(k, (cnt.get(k) || 0) + 1); } }
    const defined = (valsByType[ty.actv_code_type_id] || []).length;
    q.codes.types.push({ name: nm, scope: scopeName(ty.actv_code_type_scope), defined, coded, uncoded: T.length - coded, pct: T.length ? coded / T.length * 100 : 0,
      values: [...cnt.entries()].map(([k, n]) => { const [s, nme] = k.split('\u0001'); return { short: s, name: nme, n }; }).sort((a, b) => b.n - a.n) });
  }
  q.codes.uncoded = T.filter(t => !Object.keys(t.codes).length);
  q.codes.typeNames = typeNames; q.codes.any = T.length - q.codes.uncoded.length;

  /* ---------- calendars ---------- */
  const hol = E.quickHolidays(M, cfg); const used = {}; T.forEach(t => (used[t.clndr] = used[t.clndr] || []).push(t));
  const approvalSet = new Set(cfg.approvalIds || []);
  const keyOf = t => t.isMile ? 'milestone' : (approvalSet.has(t.id) ? 'approval' : (t.cat || 'general'));
  const calRows = Object.values(M.cal).map(c => {
    const ts = used[c.id] || [], cats = {}; ts.forEach(t => { const k = keyOf(t); cats[k] = (cats[k] || 0) + 1; });
    const hs = hol.map(h => { let nw = 0, n = 0; for (let d = h.from; d <= h.to; d++) { n++; if (!E.isWorking(c, d)) nw++; } return { h, status: nw === n ? 'ok' : nw === 0 ? 'missing' : 'partial', nw, n }; });
    return { id: c.id, name: c.name, scope: ({ CA_Base: 'Global', CA_Project: 'Project', CA_Rsrc: 'Resource' }[c.type] || c.type || ''), dayHr: c.dayHr, wdw: c.wdw, week: E.weekText(c), exceptions: c.ex.size, tasks: ts.length, cats, hs, hsOk: hs.filter(x => x.status === 'ok').length, hsMiss: hs.filter(x => x.status !== 'ok').length };
  }).sort((a, b) => b.tasks - a.tasks);
  const usedCal = calRows.filter(c => c.tasks > 0);
  const rowDefs = (fn, labelFn) => { const m = new Map(); T.forEach(t => { const k = fn(t); let r = m.get(k); if (!r) { r = { key: k, label: labelFn ? labelFn(k) : k, total: 0, cells: {} }; m.set(k, r); } r.total++; r.cells[t.clndr] = (r.cells[t.clndr] || 0) + 1; }); return [...m.values()]; };
  const catLabel = { general: 'General', mobilization: 'Mobilization', engineering: 'Engineering', procurement: 'Procurement', delivery: 'Material delivery', construction: 'Construction', closeout: 'Close-out / testing', milestone: 'Milestones', approval: 'Approvals (KEC / authority)' };
  const order = ['general', 'mobilization', 'engineering', 'approval', 'procurement', 'delivery', 'construction', 'closeout', 'milestone'];
  const byCat = rowDefs(keyOf, k => catLabel[k] || k).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  byCat.forEach(r => { r.expected = cfg.calRules ? cfg.calRules[r.key] : null; r.wrong = 0; for (const id in r.cells) { const c = M.cal[id]; if (!c || r.expected == null) continue; let ok = c.wdw === r.expected; if (ok && r.expected === 5) ok = !c.dow[6] && !c.dow[7]; if (!ok) r.wrong += r.cells[id]; } });
  const top = t => { const w = M.wbs[t.wbs]; return w ? (w.path[1] || w.path[0] || '(no WBS)') : '(no WBS)'; };
  const byWbs = rowDefs(top).sort((a, b) => b.total - a.total);
  q.cal = { rows: calRows, used: usedCal, unused: calRows.length - usedCal.length, holidays: hol, byCat, byWbs, usedIds: usedCal.map(c => c.id), keyOf,
    wrong: byCat.reduce((s, r) => s + (r.key === 'milestone' ? 0 : r.wrong), 0), holGaps: usedCal.reduce((s, c) => s + c.hsMiss, 0), approxEid: hol.some(h => h.approx), noEx: usedCal.filter(c => !c.exceptions).length };
  return q;
};

/* run the existing relationship rules for the quick review */
E.quickRules = function (M, cfg) {
  E.applyCategories(M, cfg.wbsMap || E.suggestWbsMap(M));
  const c2 = Object.assign({}, cfg, { ai: { on: false, key: '', models: {} } });
  const out = E.run(M, c2);
  const extra = E.quickOpenEnds(M);
  return E.QUICK_REL.map(id => extra.find(r => r.id === id) || out.results.find(r => r.id === id)).filter(Boolean);
};

/* open ends = no relationship at all; dangling = linked on one side only, or held by only an SS / FF link, with no date to fix it */
E.quickOpenEnds = function (M) {
  const T = M.tasks.filter(t => t.type !== 'TT_LOE' && t.type !== 'TT_WBS');
  const fin = T.filter(t => t.isFinMile).sort((a, b) => (b.ef || 0) - (a.ef || 0))[0] || T.slice().sort((a, b) => (b.ef || 0) - (a.ef || 0))[0];
  const startCs = c => c && /MSO|MANDSTART|SNE|SNL|START/i.test(c) && !/FIN/i.test(c), finCs = c => c && /MEO|MANDFIN|FNE|FNL|FIN/i.test(c) && !/START/i.test(c);
  const csLabel = c => String(c).replace('CS_', '');
  const nb = E.neighbours(M);
  const row = (t, field, value, note, fix) => ({ id: t.code, name: t.name, wbs: t.wbsPath, field, value, note: note || '', fix: fix || '' });
  const q1 = { id: 'Q1', group: 'Schedule logic', tier: 'normal', title: 'Open ends (no relationship at all)', rule: 'An open-end activity has no predecessor and no successor: it is not tied to the network, so nothing it does can move the project finish and nothing can move it.', items: [], evidence: [], status: 'pass', count: 0, total: T.length, action: 'Link each listed activity to a predecessor and a successor, or delete it if it is not needed.' };
  const q2 = { id: 'Q2', group: 'Schedule logic', tier: 'normal', title: 'Dangling activities (start or finish not driven)', rule: 'A dangling activity is linked on one side only (no predecessor or no successor), or its start depends only on Finish-to-Finish links, or its finish only on Start-to-Start links, and it has no start or finish date constraint to fix it. Completed activities, level-of-effort activities, the start milestones and the project finish are not counted.', items: [], evidence: [], status: 'pass', count: 0, total: T.length, action: 'Add the missing predecessor or successor (a Finish-to-Start link is preferred) so the activity is driven by the logic.' };
  let held = 0, dStart = 0, dFin = 0;
  for (const t of T) {
    if (!t.pre.length && !t.succ.length && !(t.isMile && T.length === 1)) { if (t.status !== 'TK_Complete' || true) { const b = nb.before(t), a = nb.after(t); q1.items.push(row(t, 'No relationships', 'No predecessor and no successor', (t.status || '').replace('TK_', '') + (t.cstrType ? ' · constraint ' + csLabel(t.cstrType) : ''), 'Tie it into the network with Finish-to-Start links both ways: ' + (b ? 'predecessor ' + b.code + ' “' + b.name.slice(0, 50) + '” (finishes ' + E.fmtDate(b.ef) + ')' : 'a predecessor (the work or approval it depends on)') + ' and ' + (a ? 'successor ' + a.code + ' “' + a.name.slice(0, 50) + '” (starts ' + E.fmtDate(a.es) + ')' : 'a successor (the work that needs its result)') + '. If it is not real work, delete it.')); } continue; }
    if (t.status === 'TK_Complete') continue;
    const cst = [t.cstrType, t.cstrType2];
    const noPre = !t.pre.length && t.type !== 'TT_Mile', ffOnly = t.pre.length && t.pre.every(l => l.type === 'FF') && !t.isMile;
    const noSuc = !t.succ.length && t !== fin, ssOnly = t.succ.length && t.succ.every(l => l.type === 'SS');
    if (noPre || ffOnly) { if (cst.some(startCs)) held++; else { dStart++; { const b = nb.before(t); q2.items.push(row(t, 'Dangling start', noPre ? 'No predecessor' : 'Only Finish-to-Finish predecessors', 'No start constraint', noPre ? 'Add a Finish-to-Start predecessor – the work, approval or delivery it really waits for' + (b ? ', e.g. ' + b.code + ' “' + b.name.slice(0, 50) + '” (finishes ' + E.fmtDate(b.ef) + ')' : '') + '. If it can only start on a fixed date, set a start constraint and say why.' : 'Keep the Finish-to-Finish link for finish control, but add a Finish-to-Start (or Start-to-Start with a lag) predecessor so the start is driven by the logic' + (b ? ', e.g. from ' + b.code + ' “' + b.name.slice(0, 50) + '”' : '') + '.')); } } }
    if (noSuc || ssOnly) { if (cst.some(finCs)) held++; else { dFin++; { const a = nb.after(t); q2.items.push(row(t, 'Dangling finish', noSuc ? 'No successor' : 'Only Start-to-Start successors', 'No finish constraint', noSuc ? 'Add a Finish-to-Start successor – the work that needs this result' + (a ? ', e.g. ' + a.code + ' “' + a.name.slice(0, 50) + '” (starts ' + E.fmtDate(a.es) + ')' : ', or the project finish / a milestone if it ends a package') + '.' : 'Keep the Start-to-Start link, but also tie the finish in: add a Finish-to-Finish link to the same successor, or a Finish-to-Start link to the next activity' + (a ? ', e.g. ' + a.code + ' “' + a.name.slice(0, 50) + '”' : '') + '.')); } } }
  }
  q1.count = new Set(q1.items.map(i => i.id)).size; q1.status = q1.count ? 'fail' : 'pass';
  q1.summary = q1.count ? q1.count + ' activities have no predecessor and no successor.' : 'Every activity is linked to the network.';
  q2.count = new Set(q2.items.map(i => i.id)).size; q2.status = q2.count ? 'fail' : 'pass';
  q2.summary = q2.count ? q2.count + ' activities are dangling (' + dStart + ' with an undriven start, ' + dFin + ' with an undriven finish).' : 'No dangling activities.';
  if (held) q2.evidence.push(held + ' start/finish side(s) have no link but are held by a date constraint, so they are not counted.');
  q2.evidence.push('Activities with no relationship at all are reported under Q1 and not repeated here.');
  return [q1, q2];
};


/* ---------- suggested correct logic for each wrong relationship ---------- */
E.waitName = (pred, succ, n) => {
  const t = (pred.name + ' ' + succ.name).toLowerCase(), d = n + ' d';
  if (/pour|concrete|cast|screed|blinding|slab/.test(pred.name.toLowerCase())) return ['Concrete curing / strike period (' + d + ')', 'a 7-day calendar'];
  if (/waterproof|plaster|paint|coating|render|tile|adhesive/.test(pred.name.toLowerCase())) return ['Drying / curing period (' + d + ')', 'a 7-day calendar'];
  if (/test|inspect|commission|snag/.test(pred.name.toLowerCase())) return ['Inspection / approval period (' + d + ')', null];
  if (/submit|approv|review|noc|permit/.test(pred.name.toLowerCase())) return ['Review / approval period (' + d + ')', null];
  if (/deliver|procure|supply|manufactur|ship/.test(pred.name.toLowerCase())) return ['Delivery / transit (' + d + ')', null];
  return ['Waiting period – state the reason (' + d + ')', null];
};
E.fixLink = function (l, kind) {
  const r1 = x => Math.round(x * 10) / 10, P = l.from, S = l.to, dp = P.durWd || 0, ds = S.durWd || 0, L = l.lagWd, pc = P.code, sc = S.code;
  if (kind === 'SF') return `Reverse the link: make ${sc} the predecessor and ${pc} the successor with a Finish-to-Start link (lag 0). A Start-to-Finish link means the later activity finishes when the earlier one starts, which is the opposite of how work is normally sequenced. If the two only need to be coordinated, tie both to a milestone.`;
  if (kind === 'SSX') { const nl = r1(L - dp); return `The ${r1(L)}-day lag is longer than ${pc} itself (${r1(dp)} d), so ${sc} cannot start until ${pc} has finished. Change the link to Finish-to-Start${nl > 0.4 ? ' with a ' + nl + '-day wait, preferably as a named waiting activity (see rule L4)' : ' with no lag'}.`; }
  if (kind === 'FFX') { const nl = r1(L - ds); return `The ${r1(L)}-day lag is longer than ${sc} itself (${r1(ds)} d), so ${sc} in fact starts only after ${pc} has finished. Change the link to Finish-to-Start${nl > 0.4 ? ' with a ' + nl + '-day wait, preferably as a named waiting activity (see rule L4)' : ' with no lag'}.`; }
  if (kind === 'NEG') {
    if (l.type === 'FS') { const off = r1(dp + L); return off > 0.4 ? `Replace the ${r1(L)}-day lead with a Start-to-Start link, lag ${off} d (${sc} starts once ${pc} is ${off} d into its ${r1(dp)} d). If ${sc} must not finish before ${pc} does, add a Finish-to-Finish link with lag 0.` : `The lead is as long as ${pc} itself (${r1(dp)} d). Use a Start-to-Start link with lag 0, plus a Finish-to-Finish link with lag 0 if ${sc} must not finish first.`; }
    if (l.type === 'SS') return `A negative Start-to-Start lag starts ${sc} before ${pc} has started. Use Start-to-Start with lag 0, or reverse the link if ${sc} really comes first.`;
    if (l.type === 'FF') return `A negative Finish-to-Finish lag lets ${sc} finish before ${pc}. Use Finish-to-Finish with lag 0, or split ${pc} so that the part ${sc} depends on is its own activity linked Finish-to-Start.`;
    return 'Remove the lead and use a Finish-to-Start or Start-to-Start link with lag 0.';
  }
  if (kind === 'FSLAG') { const n = r1(L), w = E.waitName(P, S, n); return `Replace the ${n}-day lag with a named activity “${w[0]}” between ${pc} and ${sc} (Finish-to-Start, lag 0 on both sides${w[1] ? '; give it ' + w[1] : ''}). ${dp > 0 ? 'If the two can actually overlap, use Start-to-Start with a lag shorter than ' + pc + ' (' + r1(dp) + ' d) instead of waiting for it to finish.' : 'If this is a notice or approval period that starts at the milestone, make that period the activity and link the milestone to it.'}`; }
  return '';
};

/* nearest sensible neighbour in the same WBS branch, for dangling and open-end suggestions */
E.neighbours = function (M) {
  const T = M.tasks.filter(t => t.type !== 'TT_LOE' && t.type !== 'TT_WBS'), by = {};
  T.forEach(t => (by[t.wbs] = by[t.wbs] || []).push(t));
  const up = id => { const w = M.wbs[id]; return w && w.parent ? w.parent : null; };
  const pool = (t, depth) => { let id = t.wbs, out = []; for (let i = 0; i <= depth && id; i++, id = up(id)) { (function add(w, d) { (by[w] || []).forEach(x => out.push(x)); if (d > 0) (M.wbs[w] ? M.wbs[w].kids : []).forEach(k => add(k, d - 1)); })(id, i === 0 ? 0 : 1); } return [...new Set(out)].filter(x => x !== t); };
  const before = t => { for (const dpt of [0, 1]) { const c = pool(t, dpt).filter(x => x.ef != null && t.es != null && x.ef <= t.es && x.status !== 'TK_Complete' || (x.ef != null && t.es != null && x.ef <= t.es && dpt === 0)).sort((a, b) => b.ef - a.ef)[0]; if (c) return c; } return null; };
  const after = t => { for (const dpt of [0, 1]) { const c = pool(t, dpt).filter(x => x.es != null && t.ef != null && x.es >= t.ef).sort((a, b) => a.es - b.es)[0]; if (c) return c; } return null; };
  return { before, after };
};
