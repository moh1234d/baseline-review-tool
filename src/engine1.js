/* ===== ENGINE PART 1: XER parsing + model ===== */
const E = {};
E.VERSION = '1.0';

/* ---------- XER ---------- */
E.parseXER = function (text) {
  const T = {}; let cur = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('%T\t')) { cur = line.slice(3); T[cur] = { f: [], r: [] }; }
    else if (line.startsWith('%F\t')) { T[cur].f = line.slice(3).split('\t'); }
    else if (line.startsWith('%R\t')) {
      const v = line.slice(3).split('\t'), f = T[cur].f, o = {};
      for (let i = 0; i < f.length; i++) o[f[i]] = v[i] === undefined ? '' : v[i];
      T[cur].r.push(o);
    }
  }
  return T;
};

/* ---------- dates ---------- */
const MS = 86400000;
E.pd = s => { // 'YYYY-MM-DD HH:MM' -> day number (days since 1970, integer) or null
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS);
};
E.dayToStr = d => d == null ? '' : new Date(d * MS).toISOString().slice(0, 10);
E.dayToDate = d => new Date(d * MS);
E.strToDay = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS) : null; };
E.addMonths = (day, n) => { const d = new Date(day * MS); const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, dd = d.getUTCDate(); let r = new Date(Date.UTC(y, m, dd)); if (r.getUTCMonth() !== ((m % 12) + 12) % 12) r = new Date(Date.UTC(y, m + 1, 0)); return Math.floor(r.getTime() / MS); };
E.ym = d => { const x = new Date(d * MS); return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0'); };
E.fmtDate = d => { if (d == null) return ''; const x = new Date(d * MS); return String(x.getUTCDate()).padStart(2, '0') + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };

/* ---------- calendars ---------- */
E.parseCalendar = function (data) {
  const out = { dow: {}, ex: new Map() };
  const d = (data || '').replace(/\x7f\x7f/g, '\n');
  const iEx = d.indexOf('Exceptions()');
  const secDow = iEx >= 0 ? d.slice(0, iEx) : d;
  const parts = secDow.split(/\(0\|\|([1-7])\(\)\(/);
  for (let i = 1; i < parts.length; i += 2) out.dow[+parts[i]] = /s\|/.test(parts[i + 1]);
  for (let k = 1; k <= 7; k++) if (out.dow[k] === undefined) out.dow[k] = false;
  if (iEx >= 0) {
    const sec = d.slice(iEx);
    const ps = sec.split(/\(0\|\|\d+\(d\|(\d+)\)\(/);
    for (let i = 1; i < ps.length; i += 2) {
      const serial = +ps[i]; const day = serial - 25569;
      out.ex.set(day, /s\|/.test(ps[i + 1].split(/\(0\|\|\d+\(d\|/)[0]));
    }
  }
  out.wdw = Object.values(out.dow).filter(Boolean).length;
  return out;
};
E.isWorking = (cal, day) => {
  if (cal.ex.has(day)) return cal.ex.get(day);
  const wd = new Date(day * MS).getUTCDay() + 1; // 1=Sun
  return !!cal.dow[wd];
};

/* ---------- model ---------- */
E.buildModel = function (T) {
  for (const n of ['CALENDAR', 'PROJWBS', 'RSRC', 'TASKPRED', 'TASKRSRC']) if (!T[n]) T[n] = { f: [], r: [] };
  const M = { T };
  const P = T.PROJECT.r[0]; M.proj = P;
  M.dataDate = E.pd(P.last_recalc_date);
  M.planStart = E.pd(P.plan_start_date); M.planEnd = E.pd(P.scd_end_date || P.plan_end_date);
  M.so = (T.SCHEDOPTIONS && T.SCHEDOPTIONS.r[0]) || {};
  M.cal = {};
  for (const c of T.CALENDAR.r) {
    const o = E.parseCalendar(c.clndr_data);
    o.id = c.clndr_id; o.name = c.clndr_name; o.dayHr = parseFloat(c.day_hr_cnt) || 8; o.type = c.clndr_type;
    M.cal[c.clndr_id] = o;
  }
  // WBS
  M.wbs = {};
  for (const w of T.PROJWBS.r) M.wbs[w.wbs_id] = { id: w.wbs_id, name: w.wbs_name, short: w.wbs_short_name, parent: w.parent_wbs_id, kids: [] };
  for (const w of Object.values(M.wbs)) { if (M.wbs[w.parent]) M.wbs[w.parent].kids.push(w.id); else w.parent = null; }
  const lvl = w => { let n = 0; while (w.parent) { w = M.wbs[w.parent]; n++; } return n; };
  for (const w of Object.values(M.wbs)) {
    w.level = lvl(w);
    const names = []; let x = w; while (x) { names.push(x.name); x = M.wbs[x.parent]; }
    w.path = names.reverse();
    w.pathStr = w.path.slice(1).join(' / ');
  }
  // activity codes
  const ctype = {}; for (const t of (T.ACTVTYPE ? T.ACTVTYPE.r : [])) ctype[t.actv_code_type_id] = t.actv_code_type;
  const cval = {}; for (const c of (T.ACTVCODE ? T.ACTVCODE.r : [])) cval[c.actv_code_id] = c;
  M.codeTypes = ctype;
  const tcode = {};
  for (const x of (T.TASKACTV ? T.TASKACTV.r : [])) {
    const c = cval[x.actv_code_id]; if (!c) continue;
    (tcode[x.task_id] = tcode[x.task_id] || {})[ctype[c.actv_code_type_id] || c.actv_code_type_id] = { short: c.short_name, name: c.actv_code_name };
  }
  // resources
  M.rsrc = {}; for (const r of T.RSRC.r) M.rsrc[r.rsrc_id] = { id: r.rsrc_id, name: r.rsrc_name, short: r.rsrc_short_name, type: r.rsrc_type, parent: r.parent_rsrc_id };
  // tasks
  M.tasks = []; M.byId = {}; M.byCode = {};
  for (const t of T.TASK.r) {
    const cal = M.cal[t.clndr_id] || { dayHr: 8, wdw: 6 };
    const hr = v => v === '' ? null : parseFloat(v);
    const wdDur = hr(t.target_drtn_hr_cnt) == null ? null : hr(t.target_drtn_hr_cnt) / cal.dayHr;
    const wdTF = hr(t.total_float_hr_cnt) == null ? null : hr(t.total_float_hr_cnt) / cal.dayHr;
    const k = 7 / (cal.wdw || 6);
    const o = {
      id: t.task_id, code: t.task_code, name: t.task_name, wbs: t.wbs_id, clndr: t.clndr_id, type: t.task_type,
      isMile: t.task_type === 'TT_Mile' || t.task_type === 'TT_FinMile', isFinMile: t.task_type === 'TT_FinMile',
      durWd: wdDur, durCal: wdDur == null ? null : wdDur * k, tfWd: wdTF, tfCal: wdTF == null ? null : wdTF * k,
      es: E.pd(t.act_start_date) != null ? E.pd(t.act_start_date) : E.pd(t.early_start_date), ef: E.pd(t.act_end_date) != null ? E.pd(t.act_end_date) : E.pd(t.early_end_date), ts: E.pd(t.target_start_date), te: E.pd(t.target_end_date),
      as: E.pd(t.act_start_date), af: E.pd(t.act_end_date), cstrType: t.cstr_type, cstrDate: E.pd(t.cstr_date), cstrType2: t.cstr_type2, cstrDate2: E.pd(t.cstr_date2),
      status: t.status_code, codes: tcode[t.task_id] || {}, pre: [], succ: [], asg: [], cat: null
    };
    o.wbsPath = M.wbs[o.wbs] ? M.wbs[o.wbs].pathStr : '';
    M.tasks.push(o); M.byId[o.id] = o; (M.byCode[o.code] = M.byCode[o.code] || []).push(o);
  }
  // preds
  M.links = []; M.badLinks = [];
  for (const p of T.TASKPRED.r) {
    const a = M.byId[p.pred_task_id], b = M.byId[p.task_id];
    if (!a || !b) { M.badLinks.push(p); continue; }
    const lagHr = parseFloat(p.lag_hr_cnt || '0');
    const cal = M.cal[a.clndr] || { dayHr: 8, wdw: 6 };
    const lagWd = lagHr / cal.dayHr;
    const l = { from: a, to: b, type: p.pred_type.replace('PR_', ''), lagWd, lagCal: lagWd * 7 / (cal.wdw || 6) };
    M.links.push(l); a.succ.push(l); b.pre.push(l);
  }
  // assignments
  M.asg = [];
  for (const r of T.TASKRSRC.r) {
    const t = M.byId[r.task_id]; if (!t) continue;
    const a = { task: t, rsrc: r.rsrc_id, qty: parseFloat(r.target_qty || '0') || 0, price: parseFloat(r.cost_per_qty || '0') || 0, cost: parseFloat(r.target_cost || '0') || 0, start: E.pd(r.target_start_date), end: E.pd(r.target_end_date) };
    t.asg.push(a); M.asg.push(a);
  }
  // project start / finish
  const fin = M.tasks.filter(t => t.isMile).map(t => t.ef).filter(x => x != null);
  M.maxEF = Math.max(...M.tasks.map(t => t.ef).filter(x => x != null));
  M.minES = Math.min(...M.tasks.map(t => t.es).filter(x => x != null));
  return M;
};

/* ---------- categories ---------- */
E.CATS = ['general', 'mobilization', 'engineering', 'procurement', 'delivery', 'construction', 'closeout'];
E.suggestWbsMap = function (M) {
  const map = {};
  const rx = {
    general: /^general|key milestone/i, mobilization: /mobiliz|initial deliverabl|permit|authorit/i,
    engineering: /engineer|design|shop draw|method statement|bim/i, procurement: /procure|material|supply|PO issu/i,
    delivery: /\bdeliver(?:y|ies)\b|fabricat/i, construction: /construct|works|zone|road/i, closeout: /handover|close ?out|test|commission|snag|as-built|final auth|de-?mobil|documentation/i
  };
  const guess = (name) => {
    for (const k of ['delivery', 'closeout', 'general', 'mobilization', 'engineering', 'procurement', 'construction']) if (rx[k].test(name)) return k;
    return null;
  };
  for (const w of Object.values(M.wbs)) {
    if (w.level === 1 || w.level === 2) { const g = guess(w.name); if (g) { if (w.level === 1 || ['delivery', 'closeout'].includes(g) || (w.level === 2 && map[w.parent] === undefined)) map[w.id] = g; } }
  }
  // level-2 nodes inherit parent unless explicitly guessed as delivery/closeout
  for (const w of Object.values(M.wbs)) if (w.level === 2 && map[w.id] && !['delivery', 'closeout'].includes(map[w.id])) delete map[w.id];
  return map;
};
E.applyCategories = function (M, wbsMap) {
  const memo = {};
  const catOf = id => {
    if (memo[id] !== undefined) return memo[id];
    const w = M.wbs[id]; let c = null;
    if (!w) c = null; else if (wbsMap[id]) c = wbsMap[id]; else c = w.parent ? catOf(w.parent) : null;
    return memo[id] = c;
  };
  for (const t of M.tasks) t.cat = t.isMile ? 'milestone' : (catOf(t.wbs) || 'general');
  for (const t of M.tasks) t.wbsCat = catOf(t.wbs) || 'general';
};
E.APPROVAL_EXCLUDE_DEFAULT = 'shop ?draw|material|submittal|sample|mock-?up|method statement|as-?built';
E.suggestApprovals = function (M, excl) {
  const rx = /approv|\bNOC\b|permit|authorit/i; let ex = null; try { const e = excl == null ? E.APPROVAL_EXCLUDE_DEFAULT : excl; ex = String(e).trim() ? new RegExp(e, 'i') : null; } catch (e) { ex = null; }
  return M.tasks.filter(t => !t.isMile && ['engineering', 'procurement', 'mobilization', 'closeout'].includes(t.cat) && rx.test(t.name) && !(ex && ex.test(t.name))).map(t => t.id);
};
E.rsrcUse = function (M, id) { let n = 0; for (const a of M.asg || []) if (a.rsrc === id && a.qty > 0) n++; return n; };
E.suggestResources = function (M) {
  const R = Object.values(M.rsrc); const o = {};
  /* Several resources can match a name (e.g. an old unused "Progress" plus a new "Progress Cost"): prefer the one that is really assigned to activities. */
  const best = (rx, skip) => { const c = R.filter(r => rx.test(r.name + ' ' + (r.short || '')) && r.id !== skip); if (!c.length) return null; c.forEach(r => r.__u = E.rsrcUse(M, r.id)); c.sort((a, b) => b.__u - a.__u); const id = c[0].id; c.forEach(r => delete r.__u); return id; };
  o.progress = best(/progress|prog\b|prg/i);
  o.cost = best(/boq/i, o.progress) || best(/cost/i, o.progress);
  if (o.cost === o.progress) o.cost = null;
  return o;
};
