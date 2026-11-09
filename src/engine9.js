/* ===== ENGINE 9: packages, sequencing, durations, validation, CPM preview ===== */
E.BB_EXTRA = [
  { k: 'S', code: 'SUB', name: 'Submittals & approvals', verb: 'Submit & approve', dur: 14 },
  { k: 'H', code: 'HOV', name: 'Handover & acceptance', verb: 'Handover', dur: 5 }
];
E.BB_ORDER = ['E', 'S', 'P', 'C', 'T', 'H'];
E.bbStageMeta = k => E.BB_STAGES.concat(E.BB_EXTRA).find(s => s.k === k);
// time-only stages are switched on by preset unless the user overrides per bill
const pf = (k, a, h) => Object.assign(E.BB_PRESETS[k], { appr: a, hov: h });
pf('def', false, false); pf('earth', false, false); pf('roads', false, false); pf('util', true, false); pf('struct', true, false); pf('mep', true, true); pf('equip', true, true); pf('supply', true, false); pf('design', false, false); pf('prelim', false, false);
E.BB_RANK = { 'Earthworks': 1, 'Utilities & drainage': 2, 'Concrete & structure': 2, 'Supply': 2, 'Other': 2, 'Architectural & finishes': 3, 'MEP & systems': 3, 'Equipment': 3, 'Roads & paving': 3 };
E.bbEff = function (B, pkg, k) {
  const b = B.bills[pkg.bill] || {}, v = b[k === 'S' ? 's' : 'h']; if (v === true || v === false) return v;
  const p = E.BB_PRESETS[b.preset]; return !!(p && p[k === 'S' ? 'appr' : 'hov']);
};

/* ---- productivity library ---- */
const unitN = u => { let s = String(u || '').toLowerCase().replace(/[³]/g, '3').replace(/[²]/g, '2').replace(/[^a-z0-9]/g, ''); const al = { sqm: 'm2', sqmtr: 'm2', cum: 'm3', cumtr: 'm3', rm: 'm', lm: 'm', mtr: 'm', nos: 'no', pcs: 'no', nr: 'no', ea: 'no', each: 'no', tons: 'ton', tonne: 'ton', mt: 'ton', kg: 'kg', ls: 'ls', lumpsum: 'ls' }; return al[s] || s; };
E.bbProdRead = function (rows) {
  const h = rows.findIndex(r => r && r.filter(x => typeof x === 'string' && x.trim()).length >= 2); if (h < 0) return [];
  const hd = rows[h].map(x => String(x || '').toLowerCase()), f = rx => hd.findIndex(x => rx.test(x));
  const c = { key: f(/trade|activity|description|work|keyword|item/), unit: f(/unit|uom/), rate: f(/rate|output|productiv|per day|prod/), crews: hd.findIndex(x => /crew/.test(x) && !/per crew|output|rate|prod|max|limit/.test(x)), maxc: hd.findIndex(x => /crew/.test(x) && /max|limit/.test(x)), src: f(/source|reference|basis/), cond: f(/condition/), note: f(/note|remark/), lo: f(/^low/), hi: f(/^high/), conf: f(/confidence/) };
  if (c.unit < 0 || c.rate < 0) return [];
  const out = []; for (let i = h + 1; i < rows.length; i++) { const r = rows[i] || [], rate = parseFloat(String(r[c.rate]).replace(/,/g, '')); if (!(rate > 0) || !r[c.unit]) continue; out.push({ key: c.key >= 0 ? String(r[c.key] || '').trim() : '', unit: String(r[c.unit]).trim(), rate, crews: c.crews >= 0 && parseFloat(r[c.crews]) > 0 ? parseFloat(r[c.crews]) : 0, note: c.note >= 0 ? String(r[c.note] || '') : '', source: c.src >= 0 ? String(r[c.src] || '').trim() : '', maxCrews: c.maxc >= 0 && parseFloat(r[c.maxc]) > 0 ? parseFloat(r[c.maxc]) : 0, cond: c.cond >= 0 ? String(r[c.cond] || '').trim() : '', lo: c.lo >= 0 && parseFloat(r[c.lo]) > 0 ? parseFloat(r[c.lo]) : 0, hi: c.hi >= 0 && parseFloat(r[c.hi]) > 0 ? parseFloat(r[c.hi]) : 0, conf: c.conf >= 0 ? String(r[c.conf] || '').trim() : '' }); }
  return out;
};
E.BB_OUTDOOR_DEFAULT = ['Earthworks', 'Roads & paving', 'Utilities & drainage', 'Concrete & structure'];
E.bbRate = function (B, it, m) {
  const set = B.set, cs = set.prodCase || 'typical', clim = set.clim == null ? 0.9 : (+set.clim > 0 ? +set.clim : 1), od = set.outdoor || E.BB_OUTDOOR_DEFAULT;
  let r = m.rate, lab = 'typical'; if (!m.ai) { if (cs === 'low' && m.lo > 0) { r = m.lo; lab = 'low (conservative)'; } else if (cs === 'high' && m.hi > 0) { r = m.hi; lab = 'high (optimistic)'; } else if (cs !== 'typical' && !(cs === 'low' ? m.lo : m.hi)) lab = 'typical (no ' + cs + ' value in library)'; }
  const out = od.includes(it.disc || 'Other'), f = out ? clim : 1; return { rate: r * f, base: r, f, lab, out };
};
E.bbGapKey = it => unitN(it.unit) + '|' + String(it.desc || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 6).join(' ');
E.bbProdMatch = function (B, it) {
  if (!(it.qty > 0)) return null; const m = E.bbProdMatch0(B, it); if (m) return m; const a = (B.aiProd || {})[E.bbGapKey(it)]; if (a && a.status === 'accepted') return { key: '', unit: it.unit, rate: +a[a.use || 'typical'] || +a.typical, crews: 0, maxCrews: 0, ai: true, note: 'AI suggested rate (' + (a.use || 'typical') + '), accepted by the engineer. Basis: ' + (a.basis || 'general industry experience, no verified source') + (a.conditions ? '. Conditions: ' + a.conditions : ''), source: 'AI suggested, not independently verified' }; return null;
};
E.bbProdMatch0 = function (B, it) {
  if (!B.prod || !B.prod.length || !(it.qty > 0)) return null; const d = (it.desc + ' ' + it.sect).toLowerCase(), u = unitN(it.unit); let best = null;
  for (const p of B.prod) { if (unitN(p.unit) !== u) continue; const k = (p.key || '').toLowerCase().trim(); if (k && !d.includes(k)) continue; if (!best || k.length > (best.key || '').length) best = p; }
  return best;
};
E.bbGaps = function (B) {
  const g = new Map(); for (const it of B.items) { const sp = E.bbSplitOf(B, it); if (!((+sp.C || 0) > 0) || !(it.qty > 0) || !String(it.unit || '').trim() || unitN(it.unit) === 'ls') continue; if (E.bbProdMatch(B, it)) continue; const k = E.bbGapKey(it); const x = g.get(k) || { key: k, unit: it.unit, desc: it.desc, n: 0, qty: 0 }; x.n++; x.qty += it.qty; g.set(k, x); }
  return [...g.values()];
};
E.bbDuration = function (B, it, k) {
  const set = B.set, ov = B.durOv && B.durOv[it.n + ':' + k];
  if (ov && ov.d > 0) return { d: Math.max(1, Math.round(ov.d)), src: 'manual', note: 'Manual: ' + (ov.why || 'no reason given') };
  if (k === 'C') { const m = E.bbProdMatch(B, it); if (m) { const cr = Math.max(1, +(B.crewOv && B.crewOv[it.n]) || m.crews || +set.crews || 1), rt = E.bbRate(B, it, m), raw = it.qty / (rt.rate * cr), d = Math.max(1, Math.ceil(raw - 1e-9)); return { d, src: m.ai ? 'ai' : 'productivity', crews: cr, note: it.qty + ' ' + it.unit + ' ÷ (' + (Math.round(rt.rate * 100) / 100) + ' ' + m.unit + '/day × ' + cr + ' crew' + (cr > 1 ? 's' : '') + ') = ' + (Math.round(raw * 100) / 100) + ' → ' + d + ' d. ' + (m.ai ? m.note : 'Rate case: ' + rt.lab + (rt.f !== 1 ? '; climate factor ' + rt.f + ' on ' + rt.base : '') + (m.conf ? '; confidence ' + m.conf : '') + '. Library: ' + (m.key || 'any item with this unit') + (m.source ? '; source: ' + m.source : '') + (m.cond ? '; conditions: ' + m.cond : '') + (m.note ? ' (' + m.note + ')' : '')) }; } }
  return { d: Math.max(1, +set.dur[k] || 1), src: 'placeholder', note: 'Placeholder from Project settings – not confirmed by the engineer' };
};

/* ---- work items: optional grouping of small BOQ lines ---- */
E.bbWork = function (B) {
  const w = [], groups = {}, agg = +B.set.agg || 0;
  for (const it of B.items) {
    if (agg > 0 && it.amount < agg && !B.over[it.n]) {
      const key = (it.area || '') + '|' + it.bill; let g = groups[key];
      if (!g) { g = groups[key] = { n: 'g' + Object.keys(groups).length, item: 'Minor items', desc: 'Minor items (grouped)', unit: '', qty: 0, rate: 0, amount: 0, bill: it.bill, area: it.area || '', sect: '', disc: it.disc, members: [], group: true }; w.push(g); }
      g.amount += it.amount; g.members.push(it); g.desc = 'Minor items below ' + Math.round(agg).toLocaleString('en-US') + ' (' + g.members.length + ' BOQ lines)'; g.item = 'Minor items [' + g.members.map(x => x.item)[0] + '…]';
    } else w.push(Object.assign({}, it, { members: [it] }));
  }
  return w;
};

/* ---- build ---- */
E.bbBuild = function (B) {
  const set = B.set, lk = B.lk || { edit: {}, removed: [], manual: [], accepted: false };
  const work = E.bbWork(B), wbs = [], acts = [], assigns = [], links = [], tmpl = [], pkgs = [], pk = {};
  let wid = 1, aid = 1, ta = 1, lid = 1;
  const root = { id: wid++, parent: null, code: set.prefix, name: set.name }; wbs.push(root);
  const mk = o => { const a = Object.assign({ id: aid++, dur: 0, hasRes: false, amount: 0 }, o); acts.push(a); return a; };
  const link = (p, s, type, lag, origin, key) => { links.push({ id: lid++, pred: p.id, succ: s.id, type: type || 'FS', lag: +lag || 0, origin, key: key || '' }); };
  const mode = set.wbsMode === 'bill' ? 'bill' : 'phase', phaseN = {}, billIn = {};
  const PH = [['MS', 'Milestones'], ['MOB', 'Mobilization Work'], ['ENG', 'Engineering Work'], ['PRC', 'Procurement Work'], ['CON', 'Construction Work'], ['TCH', 'Testing and Commissioning'], ['CLS', 'Project Closure']];
  if (mode === 'phase') PH.forEach(([c, n]) => { const w = { id: wid++, parent: root.id, code: c, name: n }; wbs.push(w); phaseN[c] = w; });
  const msW = mode === 'phase' ? phaseN.MS.id : root.id;
  const startMS = mk({ code: set.prefix + '.MS.START', name: 'Project start', wbs: msW, mile: 'start', stage: 'M' });
  const areaN = {}, billN = {};
  const pkgOf = it => {
    const key = (it.area || '') + '|' + it.bill; if (pk[key]) return pk[key];
    if (mode === 'phase') { const p0 = pk[key] = { key, area: it.area || '', bill: it.bill, w: null, st: {}, items: [], cActs: [], idx: pkgs.length + 1, votes: {} }; pkgs.push(p0); return p0; }
    let par = root.id; if (it.area) { if (!areaN[it.area]) { const w = { id: wid++, parent: root.id, code: 'A' + (Object.keys(areaN).length + 1), name: it.area }; wbs.push(w); areaN[it.area] = w; } par = areaN[it.area].id; }
    const w = { id: wid++, parent: par, code: 'B' + String(pkgs.length + 1).padStart(2, '0'), name: it.bill }; wbs.push(w);
    const p = pk[key] = { key, area: it.area || '', bill: it.bill, w, st: {}, items: [], cActs: [], idx: pkgs.length + 1, votes: {} }; pkgs.push(p); return p;
  };
  const stNode = (p, k) => { if (!p.st[k]) { const m = E.bbStageMeta(k), w = { id: wid++, parent: p.w.id, code: m.code, name: m.name }; wbs.push(w); p.st[k] = w; } return p.st[k]; };
  const phaseOf = (p, k) => k === 'M' || k === 'G' ? 'MS' : k === 'E' || k === 'S' ? 'ENG' : k === 'P' ? 'PRC' : k === 'C' ? ((B.bills[p.bill] || {}).preset === 'prelim' ? 'MOB' : 'CON') : k === 'T' ? 'TCH' : 'CLS';
  const wbsFor = (p, k) => {
    if (mode !== 'phase') return k === 'M' || k === 'G' ? p.w.id : stNode(p, k).id;
    const ph = phaseOf(p, k); if (ph === 'MS') return phaseN.MS.id; const key = ph + '|' + p.key;
    if (!billIn[key]) { let par = phaseN[ph].id; if (p.area) { const ak = ph + '|A|' + p.area; if (!billIn[ak]) { const w = { id: wid++, parent: par, code: 'A' + (Object.keys(billIn).length + 1), name: p.area }; wbs.push(w); billIn[ak] = w; } par = billIn[ak].id; } const w = { id: wid++, parent: par, code: 'B' + String(p.idx).padStart(2, '0'), name: p.bill }; wbs.push(w); billIn[key] = w; }
    return billIn[key].id;
  };
  let no = 0;
  for (const it of work) {
    no++; const p = pkgOf(it), sp = E.bbSplitOf(B, it); p.votes[it.disc || 'Other'] = (p.votes[it.disc || 'Other'] || 0) + it.members.length;
    const hasVal = E.BB_STAGES.some(s => (+sp[s.k] || 0) > 0), chain = []; let prev = null;
    const vals = {}; E.BB_STAGES.forEach(s => vals[s.k] = +sp[s.k] || 0);
    for (const k of E.BB_ORDER) {
      let pct = 0;
      if (k === 'S') { if (!(E.bbEff(B, p, 'S') && (vals.P > 0 || vals.C > 0))) continue; }
      else if (k === 'H') { if (!(E.bbEff(B, p, 'H') && (vals.C > 0 || vals.T > 0))) continue; }
      else { pct = vals[k]; if (!(pct > 0)) continue; }
      const m = E.bbStageMeta(k), du = E.bbDuration(B, it, k), amt = it.amount * pct / 100;
      const a = mk({ code: set.prefix + '.' + m.code + '.' + String(no).padStart(4, '0'), name: m.verb + ' – ' + (it.desc || it.item).slice(0, 110), stage: k, item: it, pct, wbs: wbsFor(p, k), dur: du.d, durSrc: du.src, durNote: du.note, amount: amt, pkg: p });
      if (pct > 0) { a.hasRes = true; assigns.push({ id: ta++, act: a.id, rs: 'PROG', qty: amt, price: +set.price, cost: amt * (+set.price) }); const q = it.qty > 0 ? it.qty * pct / 100 : amt; assigns.push({ id: ta++, act: a.id, rs: 'COST', qty: q, price: 0, cost: 0 }); }
      if (prev) link(prev, a, 'FS', 0, 'chain'); chain.push(a); prev = a; if (k === 'C') p.cActs.push(a);
    }
    p.items.push({ it, chain });
  }
  const fin = mk({ code: set.prefix + '.MS.FIN', name: 'Project completion', wbs: msW, mile: 'finish', stage: 'M' });
  for (const p of pkgs) {
    p.disc = Object.entries(p.votes).sort((a, b) => b[1] - a[1])[0][0]; p.rank = p.cActs.length ? (E.BB_RANK[p.disc] || null) : null;
    const label = (p.area ? p.area + ' / ' : '') + p.bill;
    if (p.cActs.length) { p.sg = mk({ code: set.prefix + '.G' + String(p.idx).padStart(2, '0') + '.S', name: label + ' – construction can start', wbs: wbsFor(p, 'G'), mile: 'start', stage: 'G', pkg: p }); link(startMS, p.sg, 'FS', 0, 'gate'); for (const a of p.cActs) link(p.sg, a, 'FS', 0, 'gate'); }
    p.fg = mk({ code: set.prefix + '.G' + String(p.idx).padStart(2, '0') + '.F', name: label + ' – complete', wbs: wbsFor(p, 'G'), mile: 'finish', stage: 'G', pkg: p });
    for (const x of p.items) { if (!x.chain.length) continue; const f = x.chain[0]; if (f.stage !== 'C') link(startMS, f, 'FS', 0, 'gate'); link(x.chain[x.chain.length - 1], p.fg, 'FS', 0, 'gate'); }
    link(p.fg, fin, 'FS', 0, 'gate');
  }
  // template sequencing between packages (suggestions until accepted)
  const byArea = {}; pkgs.filter(p => p.rank).forEach(p => (byArea[p.area] = byArea[p.area] || []).push(p));
  for (const grp of Object.values(byArea)) {
    const ranks = [...new Set(grp.map(p => p.rank))].sort((a, b) => a - b);
    for (let i = 1; i < ranks.length; i++) for (const s of grp.filter(p => p.rank === ranks[i])) for (const pr of grp.filter(p => p.rank === ranks[i - 1])) {
      const key = pr.key + '>' + s.key; if ((lk.removed || []).includes(key)) continue;
      const ed = (lk.edit || {})[key] || {}, t = { key, pred: pr, succ: s, type: ed.type || 'SS', lag: ed.lag != null ? +ed.lag : 10, status: ed.status || (lk.accepted ? 'accepted' : 'suggested'), basis: pr.disc + ' → ' + s.disc };
      tmpl.push(t);
      if (t.status === 'accepted') { if (t.type === 'FS') link(pr.fg, s.sg, 'FS', t.lag, 'template', key); else if (t.type === 'SS') link(pr.sg, s.sg, 'SS', t.lag, 'template', key); else if (t.type === 'FF') link(pr.fg, s.fg, 'FF', t.lag, 'template', key); }
    }
  }
  const byCode = new Map(acts.map(a => [a.code, a])), badManual = [];
  for (const m of (lk.manual || [])) { const p = byCode.get(m.pred), s = byCode.get(m.succ); if (!p || !s) { badManual.push(m); continue; } link(p, s, m.type, m.lag, 'manual', 'm' + m.id); }
  { const parentOf = new Map(wbs.map(w => [w.id, w.parent])), used = new Set([root.id]); acts.forEach(a => { let id = a.wbs; while (id && !used.has(id)) { used.add(id); id = parentOf.get(id); } }); for (let i = wbs.length - 1; i >= 0; i--) if (!used.has(wbs[i].id)) wbs.splice(i, 1); }
  const stageTot = {}; [...E.BB_STAGES, ...E.BB_EXTRA].forEach(s => stageTot[s.k] = { n: 0, amt: 0 }); acts.forEach(a => { if (stageTot[a.stage]) { stageTot[a.stage].n++; stageTot[a.stage].amt += a.amount; } });
  const totAmt = B.items.reduce((s, x) => s + x.amount, 0), totCost = assigns.reduce((s, a) => s + a.cost, 0), totProg = assigns.filter(a => a.rs === 'PROG').reduce((s, a) => s + a.qty, 0), totCostRes = assigns.filter(a => a.rs === 'COST').reduce((s, a) => s + a.cost, 0);
  const R = { acts, links, tmpl, pkgs, wbs, assigns, startMS, fin, badManual, totAmt, totCost, totProg, totCostRes, byStage: stageTot, nWork: work.length };
  R.cpm = E.bbCPM(R, set); R.issues = E.bbValidate(B, R); return R;
};

/* ---- validation ---- */
E.bbValidate = function (B, R) {
  const iss = [], set = B.set, add = (sev, txt) => iss.push({ sev, txt }); const finite = v => typeof v === 'number' && isFinite(v);
  if (!(set.name || '').trim()) add('bad', 'Project name is empty.'); if (!(set.prefix || '').trim()) add('bad', 'Activity ID prefix is empty.'); if (!set.start) add('bad', 'Planned start date is empty.');
  const days = set.days || []; if (!days.length) add('bad', 'No working days selected for the calendar.'); { const hl = E.bbHolidays(set.holText); if (hl.bad.length) add('bad', 'Holiday list: cannot read ' + hl.bad.slice(0, 3).map(x => '"' + x + '"').join(', ') + '. Use YYYY-MM-DD, or YYYY-MM-DD to YYYY-MM-DD, one per line.'); }
  if (days.length && !E.bbCalCheck(days, set.hrs, E.bbCalData(days, set.hrs, []))) add('bad', 'The calendar written to the XER does not match the working days chosen.');
  const dsp = B.def; for (const s of E.BB_STAGES) { const v = dsp[s.k]; if (!finite(v) || v < 0 || v > 100) add('bad', 'Project default ' + s.name + ' % is ' + v + ' – must be 0 to 100.'); }
  for (const s of E.BB_STAGES.concat(E.BB_EXTRA)) { const d = +set.dur[s.k]; if (!finite(d) || d < 1) add('bad', s.name + ' duration must be at least 1 day.'); }
  if (Math.abs(E.bbSum(dsp) - 100) > 0.001) add('bad', 'Project default split adds to ' + E.bbSum(dsp) + '%, not 100%.');
  for (const [n, b] of Object.entries(B.bills)) if (b.split) { if (E.BB_STAGES.some(s => !finite(+b.split[s.k]) || b.split[s.k] < 0 || b.split[s.k] > 100)) add('bad', 'Bill "' + n + '": a stage percentage is negative, above 100 or not a number.'); else if (Math.abs(E.bbSum(b.split) - 100) > 0.001) add('bad', 'Bill "' + n + '": split adds to ' + E.bbSum(b.split) + '%, not 100%.'); }
  const itemSeen = {};
  for (const it of B.items) {
    const sp = E.bbSplitOf(B, it), vals = E.BB_STAGES.map(s => sp[s.k]);
    if (vals.some(v => !finite(+v) || v < 0 || v > 100)) add('bad', 'Item ' + it.item + ': a stage percentage is negative, above 100 or not a number.'); else if (Math.abs(E.bbSum(sp) - 100) > 0.001) add('bad', 'Item ' + it.item + ': stage split adds to ' + E.bbSum(sp) + '%, not 100%.');
    if (!finite(it.amount)) add('bad', 'Item ' + it.item + ': amount is not a number.'); else if (it.amount < 0) add('warn', 'Item ' + it.item + ': negative amount (adjustment or credit) – check it should be scheduled.');
    if (it.qty > 0 && it.rate > 0 && Math.abs(it.qty * it.rate - it.amount) > Math.max(1, Math.abs(it.amount) * 0.005)) add('warn', 'Item ' + it.item + ': quantity × rate = ' + Math.round(it.qty * it.rate).toLocaleString('en-US') + ' but the amount is ' + Math.round(it.amount).toLocaleString('en-US') + '.');
    { const dk = [it.bill, it.sect, it.item].join('|'); if (itemSeen[dk]) add('warn', 'BOQ item number ' + it.item + ' appears more than once in the same bill/section (' + (it.bill || '') + (it.sect ? ' / ' + it.sect : '') + ').'); else itemSeen[dk] = 1; }
  }
  const ids = new Set(); for (const a of R.acts) { if (ids.has(a.code)) add('bad', 'Duplicate activity ID ' + a.code + '.'); ids.add(a.code); }
  const byId = new Map(R.acts.map(a => [a.id, a])), indeg = new Map(R.acts.map(a => [a.id, 0])), out = new Map(R.acts.map(a => [a.id, []])), pairs = new Set();
  for (const m of R.badManual) add('bad', 'Manual link ' + m.pred + ' → ' + m.succ + ' refers to an activity ID that does not exist.');
  for (const l of R.links) {
    const pa = byId.get(l.pred), sa = byId.get(l.succ); if (!pa || !sa) { add('bad', 'A relationship refers to a missing activity.'); continue; }
    if (l.pred === l.succ) add('bad', 'Activity ' + pa.code + ' is linked to itself.');
    const pk = l.pred + '>' + l.succ + l.type; if (pairs.has(pk)) add('warn', 'Duplicate ' + l.type + ' link ' + pa.code + ' → ' + sa.code + '.'); pairs.add(pk);
    if (l.lag < 0) add('warn', 'Negative lag (' + l.lag + ' d) on ' + pa.code + ' → ' + sa.code + '. Prefer an overlap relationship.');
    indeg.set(l.succ, indeg.get(l.succ) + 1); out.get(l.pred).push(l.succ);
  }
  const q = [...indeg].filter(x => x[1] === 0).map(x => x[0]); let seen = 0; const ind2 = new Map(indeg); while (q.length) { const x = q.pop(); seen++; for (const y of out.get(x)) { ind2.set(y, ind2.get(y) - 1); if (!ind2.get(y)) q.push(y); } }
  if (seen < R.acts.length) add('bad', 'The activity logic contains a loop.');
  const noPred = R.acts.filter(a => a !== R.startMS && !indeg.get(a.id)), noSucc = R.acts.filter(a => a !== R.fin && !out.get(a.id).length);
  if (noPred.length) add('bad', noPred.length + ' activit' + (noPred.length > 1 ? 'ies have' : 'y has') + ' no predecessor, e.g. ' + noPred.slice(0, 3).map(a => a.code).join(', ') + '.');
  if (noSucc.length) add('bad', noSucc.length + ' activit' + (noSucc.length > 1 ? 'ies have' : 'y has') + ' no successor, e.g. ' + noSucc.slice(0, 3).map(a => a.code).join(', ') + '.');
  const par = new Map(R.acts.map(a => [a.id, a.id])), find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  for (const l of R.links) if (byId.has(l.pred) && byId.has(l.succ)) par.set(find(l.pred), find(l.succ));
  const comps = new Set(R.acts.map(a => find(a.id))); if (comps.size > 1) add('bad', 'The network is split into ' + comps.size + ' disconnected groups.');
  if (R.totCostRes !== 0) add('bad', 'The cost resource must carry zero cost, but it carries ' + R.totCostRes + '.');
  if (R.acts.length && Math.abs(R.totCost - R.totAmt) > 1) add('warn', +set.price === 1 ? 'Budget cost ' + Math.round(R.totCost).toLocaleString('en-US') + ' does not equal the BOQ total ' + Math.round(R.totAmt).toLocaleString('en-US') + '.' : 'The progress resource price is ' + set.price + ', so the project budget in P6 will be ' + Math.round(R.totCost).toLocaleString('en-US') + ', not the BOQ total ' + Math.round(R.totAmt).toLocaleString('en-US') + '.');
  const sugg = R.tmpl.filter(t => t.status !== 'accepted').length; if (sugg) add('warn', sugg + ' template link' + (sugg > 1 ? 's are' : ' is') + ' still only a suggestion and not in the schedule. Accept or remove them in the sequencing section.');
  for (const it of B.items) { const m = E.bbProdMatch(B, it); if (m && m.maxCrews > 0) { const cr = Math.max(1, +(B.crewOv && B.crewOv[it.n]) || m.crews || +set.crews || 1); if (cr > m.maxCrews) add('warn', 'Item ' + it.item + ': ' + cr + ' crews assumed, but the library limit for this work is ' + m.maxCrews + '.'); } }
  { const lc = new Set(); for (const it of B.items) { const m = E.bbProdMatch(B, it); if (m && !m.ai && /^low$/i.test(m.conf || '') && (+(E.bbSplitOf(B, it).C) || 0) > 0) lc.add(it.n); } if (lc.size) add('warn', lc.size + ' BOQ item' + (lc.size > 1 ? 's use' : ' uses') + ' a Low-confidence library rate (single source or unsourced estimate) – validate before baseline.'); }
  const ph = R.acts.filter(a => a.durSrc === 'placeholder' && a.stage === 'C').length; if (ph) add('warn', ph + ' construction activit' + (ph > 1 ? 'ies use' : 'y uses') + ' a placeholder duration, not a productivity-based one.');
  return iss;
};

/* ---- CPM preview (single project calendar, FS/SS/FF with lag, no constraints) ---- */
E.bbDates = function (start, days, n, hol) {
  const out = [], hs = new Set(hol || []); if (!start || !days.length) return out; const d = new Date(start + 'T00:00:00Z'); let guard = 0;
  while (out.length < n && guard++ < 40000) { const dow = d.getUTCDay() + 1; if (days.includes(dow) && !hs.has(d.getTime() / 864e5)) out.push(d.getTime() / 864e5); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};
E.bbCPM = function (R, set) {
  const acts = R.acts, byId = new Map(acts.map(a => [a.id, a])), inc = new Map(acts.map(a => [a.id, []])), outg = new Map(acts.map(a => [a.id, []]));
  for (const l of R.links) if (byId.has(l.pred) && byId.has(l.succ)) { inc.get(l.succ).push(l); outg.get(l.pred).push(l); }
  const indeg = new Map(acts.map(a => [a.id, inc.get(a.id).length])), order = [], q = acts.filter(a => !indeg.get(a.id)).map(a => a.id);
  while (q.length) { const x = q.shift(); order.push(x); for (const l of outg.get(x)) { indeg.set(l.succ, indeg.get(l.succ) - 1); if (!indeg.get(l.succ)) q.push(l.succ); } }
  if (order.length < acts.length) return null;
  const T = new Map(acts.map(a => [a.id, { es: 0, ef: 0, ls: 0, lf: 0, tf: 0 }]));
  for (const id of order) { const a = byId.get(id), t = T.get(id); let es = 0; for (const l of inc.get(id)) { const p = T.get(l.pred); const v = l.type === 'SS' ? p.es + l.lag : l.type === 'FF' ? p.ef + l.lag - a.dur : l.type === 'SF' ? p.es + l.lag - a.dur : p.ef + l.lag; if (v > es) es = v; } t.es = es; t.ef = es + a.dur; }
  let fin = 0; for (const t of T.values()) if (t.ef > fin) fin = t.ef;
  for (const id of order.slice().reverse()) {
    const a = byId.get(id), t = T.get(id); let lf = fin, ls = Infinity;
    for (const l of outg.get(id)) { const s = T.get(l.succ); if (l.type === 'FS') lf = Math.min(lf, s.ls - l.lag); else if (l.type === 'SS') ls = Math.min(ls, s.ls - l.lag); else if (l.type === 'FF') lf = Math.min(lf, s.lf - l.lag); else ls = Math.min(ls, s.lf - l.lag); }
    if (ls !== Infinity) lf = Math.min(lf, ls + a.dur); t.lf = lf; t.ls = lf - a.dur; t.tf = t.ls - t.es;
  }
  const dts = E.bbDates(set.start, set.days, fin + 5, E.bbHolidays(set.holText).days), dt = i => dts[Math.max(0, Math.min(i, dts.length - 1))];
  for (const a of acts) { const t = T.get(a.id); t.crit = t.tf <= 0; t.sd = a.mile === 'finish' ? dt(Math.max(t.ef - 1, 0)) : dt(t.es); t.fd = a.dur > 0 ? dt(t.ef - 1) : t.sd; a.cpm = t; }
  // driving path back from completion
  const path = []; let cur = R.fin; const seen = new Set();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); path.push(cur); const t = T.get(cur.id); let nxt = null, bestEF = -1; for (const l of inc.get(cur.id)) { const p = T.get(l.pred); const slack = l.type === 'SS' ? t.es - (p.es + l.lag) : l.type === 'FF' ? t.ef - (p.ef + l.lag) : t.es - (p.ef + l.lag); if (slack <= 0 && p.ef >= bestEF) { bestEF = p.ef; nxt = byId.get(l.pred); } } cur = nxt; }
  return { finish: fin, finishDate: dt(Math.max(fin - 1, 0)), startDate: dt(0), path: path.reverse(), dt };
};
