/* ===== ENGINE PART 3: scope (BOQ) + submitted documents ===== */
const MS3 = 86400000;
/* spread value of assignments evenly over calendar days -> Map('YYYY-MM' -> value) */
E.spread = function (M, asgFilter, valFn) {
  const mo = new Map();
  for (const a of M.asg) {
    if (!asgFilter(a)) continue;
    const v = valFn(a); if (!v) continue;
    let s = a.start != null ? a.start : a.task.es, e = a.end != null ? a.end : a.task.ef;
    if (s == null) continue; if (e == null || e < s) e = s;
    const n = e - s + 1, per = v / n;
    for (let d = s; d <= e; d++) { const k = E.ym(d); mo.set(k, (mo.get(k) || 0) + per); }
  }
  return mo;
};
E.cumToMonthly = arr => { let p = 0; return arr.map(x => { const v = x.value - p; p = x.value; return { ym: x.ym, value: v }; }); };
/* guess a time series inside a 2-D sheet: returns {orientation, dateIdx, valIdx, ...} candidates */
const toYM = v => {
  if (v instanceof Date && !isNaN(v)) return E.ym(Math.floor(v.getTime() / MS3));
  if (typeof v === 'number' && v > 36000 && v < 60000) return E.ym(v - 25569);
  if (typeof v === 'string') { const t = v.trim(); let m = /^(\d{4})[-\/](\d{1,2})/.exec(t); if (m) return m[1] + '-' + String(m[2]).padStart(2, '0');
    m = /^([A-Za-z]{3})[a-z]*[-\s\/']*(\d{2,4})$/.exec(t); if (m) { const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase()); if (mi >= 0) { let y = +m[2]; if (y < 100) y += 2000; return y + '-' + String(mi + 1).padStart(2, '0'); } }
    m = /^(\d{1,2})[\/-](\d{4})$/.exec(t); if (m) return m[2] + '-' + String(m[1]).padStart(2, '0'); }
  return null;
};
E.toYM = toYM;
E.guessSeries = function (rows) {
  // try row orientation: a row with >=4 date-like cells, then numeric rows below it
  let best = null;
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = rows[r] || []; const idx = []; cells.forEach((v, i) => { if (toYM(v)) idx.push(i); });
    if (idx.length >= 4) { for (let q = r + 1; q < Math.min(rows.length, r + 40); q++) { const nums = idx.filter(i => typeof rows[q][i] === 'number').length; if (nums >= idx.length * 0.7) { if (!best || nums > best.n) best = { orient: 'row', dateRow: r, valRow: q, n: nums }; } } if (best) break; }
  }
  if (best) return best;
  const ncol = Math.max(...rows.slice(0, 80).map(r => (r || []).length), 0);
  for (let c = 0; c < ncol; c++) { const idx = []; rows.forEach((row, i) => { if (row && toYM(row[c])) idx.push(i); });
    if (idx.length >= 4) for (let d = 0; d < ncol; d++) { if (d === c) continue; const nums = idx.filter(i => typeof rows[i][d] === 'number').length; if (nums >= idx.length * 0.7) return { orient: 'col', dateCol: c, valCol: d, n: nums }; } }
  return null;
};
E.readSeries = function (rows, sel) {
  const out = [];
  if (sel.orient === 'row') { const dr = rows[sel.dateRow] || [], vr = rows[sel.valRow] || []; for (let i = 0; i < dr.length; i++) { const k = toYM(dr[i]); if (k && typeof vr[i] === 'number') out.push({ ym: k, value: vr[i] }); } }
  else rows.forEach(r => { if (!r) return; const k = toYM(r[sel.dateCol]); if (k && typeof r[sel.valCol] === 'number') out.push({ ym: k, value: r[sel.valCol] }); });
  const m = new Map(); out.forEach(o => m.set(o.ym, (m.get(o.ym) || 0) + o.value));
  return [...m.entries()].sort().map(([ym, value]) => ({ ym, value }));
};
E.compareCurves = function (exp, sub, tolPct, floorFrac) {
  // exp: Map, sub: [{ym,value}]; returns rows of month differences exceeding tolerance
  const sm = new Map(sub.map(x => [x.ym, x.value])); const months = [...new Set([...exp.keys(), ...sm.keys()])].sort();
  const maxv = Math.max(...exp.values(), ...sm.values(), 1); const rows = [];
  for (const m of months) { const a = exp.get(m) || 0, b = sm.get(m) || 0; const base = Math.max(Math.abs(a), Math.abs(b)); if (base < maxv * (floorFrac || 0.01)) continue; const d = b - a; if (Math.abs(d) / base * 100 > tolPct) rows.push({ ym: m, schedule: a, submitted: b, diff: d, pct: 100 * d / (a || b) }); }
  return rows;
};
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
E.itemKey = s => String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/\.0+$/, '').toUpperCase();

E.runDocs = function (M, cfg, out) {
  const R = out.results; const num = x => (x == null || isNaN(x)) ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const add = o => { R.push(Object.assign({ status: 'notrun', tier: 'normal', count: 0, items: [], evidence: [], single: false, action: '', why: '', source: '' }, o)); return R[R.length - 1]; };
  const nm = M.tasks.filter(t => !t.isMile); const progId = cfg.rsrc.progress, costId = cfg.rsrc.cost; const rs = M.rsrc;
  const D = cfg.docs || {}; const unreliable = out.costReliable === false;
  const miss = (c, what) => { c.status = 'notrun'; c.summary = 'Not provided – ' + what; };

  /* ===== SCOPE (BOQ) ===== */
  const boq = cfg.boq, mp = cfg.mapping;
  { const c = add({ id: 'S1', group: 'Scope & BOQ', title: 'BOQ total agrees with contract value', rule: 'The BOQ total must equal the contract value.', single: true });
    if (!boq) miss(c, 'BOQ file not loaded.'); else if (!cfg.contractValue) { c.summary = 'Contract value not entered.'; }
    else { const d = boq.total - cfg.contractValue; c.evidence = ['BOQ total: ' + num(boq.total), 'Contract value: ' + num(cfg.contractValue), 'Difference: ' + num(d)]; c.status = Math.abs(d) / cfg.contractValue * 100 > cfg.costTol ? 'fail' : 'pass'; c.count = c.status === 'fail' ? 1 : 0; c.summary = c.status === 'fail' ? 'BOQ total differs from the contract value by ' + num(d) + '.' : 'BOQ total agrees.'; c.action = 'Confirm the BOQ revision used and the contract value.'; } }
  const sc = add({ id: 'S2', group: 'Scope & BOQ', title: 'Every BOQ item is covered by activities', rule: 'Every BOQ item must be linked to at least one activity (by the contractor\'s mapping sheet, or by name matching if none was supplied).' });
  const s3 = add({ id: 'S3', group: 'Scope & BOQ', title: 'Mapping sheet refers to real activities', rule: 'Every activity named in the BOQ mapping sheet must exist in the schedule.' });
  const s4 = add({ id: 'S4', group: 'Scope & BOQ', title: 'Scheduled amount agrees with the BOQ item', rule: 'For each BOQ item, the cost-resource units of its mapped activities must equal the BOQ amount.' });
  if (!boq) { miss(sc, 'BOQ file not loaded.'); miss(s3, 'BOQ file not loaded.'); miss(s4, 'BOQ file not loaded.'); }
  else if (mp && mp.rows.length) {
    const byItem = new Map(); for (const r of mp.rows) { const k = E.itemKey(r.item); if (!byItem.has(k)) byItem.set(k, []); byItem.get(k).push(r); }
    const byCode = {}; M.tasks.forEach(t => byCode[t.code.toUpperCase()] = t);
    for (const it of boq.items) { if (!byItem.has(E.itemKey(it.item))) sc.items.push({ id: it.item, name: it.desc, wbs: it.part || '', field: 'BOQ item not in mapping sheet', value: num(it.amount), note: '' }); }
    sc.count = sc.items.length; sc.total = boq.items.length; sc.status = sc.count ? 'fail' : 'pass'; sc.summary = sc.count ? sc.count + ' BOQ items missing from the mapping sheet (amount ' + num(sc.items.reduce((s, i) => s + parseFloat(String(i.value).replace(/,/g, '')) || 0, 0)) + ').' : 'All BOQ items mapped.'; sc.action = 'Add the missing BOQ items to the mapping sheet and the schedule.';
    for (const r of mp.rows) if (r.act && !byCode[String(r.act).trim().toUpperCase()]) s3.items.push({ id: r.act, name: 'BOQ item ' + r.item, wbs: '', field: 'Activity not in schedule', value: '', note: '' });
    s3.count = s3.items.length; s3.total = mp.rows.length; s3.status = s3.count ? 'fail' : 'pass'; s3.summary = s3.count ? s3.count + ' mapped activities do not exist in the schedule.' : 'All mapped activities exist.'; s3.action = 'Correct the activity IDs in the mapping sheet or the schedule.';
    const cost = t => t.asg.filter(a => a.rsrc === costId).reduce((s, a) => s + a.qty, 0);
    if (!costId) miss(s4, 'cost resource not identified.');
    else { for (const it of boq.items) { const rows = byItem.get(E.itemKey(it.item)); if (!rows) continue; const sum = [...new Set(rows.map(r => String(r.act).trim().toUpperCase()))].map(k => byCode[k]).filter(Boolean).reduce((s, t) => s + cost(t), 0); if (it.amount && Math.abs(sum - it.amount) / it.amount * 100 > cfg.costTol) s4.items.push({ id: it.item, name: it.desc, wbs: it.part || '', field: 'Scheduled vs BOQ amount', value: num(sum) + ' vs ' + num(it.amount), note: 'Difference ' + num(sum - it.amount) }); }
      s4.count = s4.items.length; s4.total = boq.items.length; s4.status = s4.count ? 'fail' : 'pass'; s4.summary = s4.count ? s4.count + ' BOQ items where the scheduled amount differs.' : 'Amounts agree.'; s4.action = 'Re-load the cost resource so each item equals its BOQ amount.'; if (unreliable) s4.summary += ' (cost resource itself failed R2 – treat as unreliable)'; }
  } else {
    // fallback: name matching
    const stop = new Set(['and', 'the', 'for', 'with', 'of', 'to', 'in', 'on', 'at', 'a', 'type', 'supply', 'install', 'installation', 'including', 'all', 'complete']);
    const tok = s => norm(s).split(' ').filter(w => w.length > 2 && !stop.has(w));
    const actTok = nm.map(t => new Set(tok(t.name + ' ' + t.wbsPath)));
    for (const it of boq.items) { const tk = tok(it.desc); if (tk.length < 2) continue; const need = Math.ceil(tk.length * 0.7); const hit = actTok.some(s => tk.filter(w => s.has(w)).length >= need); if (!hit) sc.items.push({ id: it.item, name: it.desc, wbs: it.part || '', field: 'No activity with matching words (name matching)', value: num(it.amount), note: 'Confirm manually' }); }
    sc.count = sc.items.length; sc.total = boq.items.length; sc.status = sc.count ? 'fail' : 'pass'; sc.summary = 'No mapping sheet supplied – name matching used. ' + sc.count + ' BOQ items have no similar activity.'; sc.tier = 'minor'; sc.action = 'Provide the BOQ mapping sheet or confirm the listed items are covered.';
    miss(s3, 'mapping sheet not provided.'); miss(s4, 'mapping sheet not provided.');
  }

  /* ===== DOCUMENTS (rule 18) ===== */
  const curveDoc = (id, title, doc, expMap, label, rule) => {
    const c = add({ id, group: 'Submitted documents', title, rule });
    if (!doc || !doc.series || !doc.series.length) { miss(c, label + ' not supplied.'); return c; }
    if (!expMap || !expMap.size) { c.summary = 'Cannot build the schedule curve (resource missing).'; c.status = 'notrun'; return c; }
    let sub = doc.series; if (doc.cumulative) sub = E.cumToMonthly(sub);
    const expTot = [...expMap.values()].reduce((a, b) => a + b, 0); const subTot = sub.reduce((s, x) => s + x.value, 0);
    let scale = 1; if (doc.unit === 'percent') scale = expTot / 100; else if (doc.unit === 'hours') scale = 1; else if (doc.unit === 'days') scale = 8; else if (doc.unit === 'months') scale = 208;
    sub = sub.map(x => ({ ym: x.ym, value: x.value * scale }));
    const rows = E.compareCurves(expMap, sub, cfg.curveTol); const tot2 = sub.reduce((s, x) => s + x.value, 0);
    c.evidence = ['Schedule total: ' + num(expTot), 'Submitted total: ' + num(tot2), 'Difference: ' + num(tot2 - expTot)];
    rows.forEach(r => c.items.push({ id: r.ym, name: label, wbs: '', field: 'Month differs by more than ' + cfg.curveTol + '%', value: 'Schedule ' + num(r.schedule) + ' | Submitted ' + num(r.submitted), note: num(r.pct) + '%' }));
    const totBad = expTot && Math.abs(tot2 - expTot) / expTot * 100 > cfg.costTol;
    c.count = c.items.length + (totBad ? 1 : 0); c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? (totBad ? 'Total differs. ' : '') + c.items.length + ' months differ.' : 'Agrees with the schedule.'; c.action = 'Re-issue the ' + label + ' consistent with the baseline programme.';
    if (id === 'D2' && unreliable) c.summary += ' (cost resource failed R2 – comparison unreliable)';
    c.curve = { exp: [...expMap.entries()].sort(), sub: sub.map(x => [x.ym, x.value]) };
    return c;
  };
  curveDoc('D1', 'Progress S-curve agrees with the progress resource', D.scurve, progId ? E.spread(M, a => a.rsrc === progId, a => a.qty * a.price) : null, 'progress S-curve', 'The contractor\'s S-curve must match the planned progress curve built from the progress resource.');
  curveDoc('D2', 'Cash flow agrees with the cost resource', D.cashflow, costId ? E.spread(M, a => a.rsrc === costId, a => a.qty) : null, 'cash flow', 'The cash flow must match the BOQ amounts (cost-resource units) spread over the activity dates, and total the contract value.');
  { const isLab = a => rs[a.rsrc] && rs[a.rsrc].type === 'RT_Labor' && a.rsrc !== progId && a.rsrc !== costId;
    const c = curveDoc('D3', 'Manpower histogram agrees with labour units', D.manpower, E.spread(M, isLab, a => a.qty), 'manpower histogram', 'The histogram must match the labour hours in the schedule by month (total and peak).');
    if (c.status !== 'notrun' && D.manpower && D.manpower.series) { const e = E.spread(M, isLab, a => a.qty); const pk = Math.max(...e.values()); const sc2 = D.manpower.unit === 'days' ? 8 : D.manpower.unit === 'months' ? 208 : 1; const sp = Math.max(...D.manpower.series.map(x => x.value)) * sc2; c.evidence.push('Peak month – schedule: ' + num(pk) + ' h | submitted: ' + num(sp) + ' h'); if (pk && Math.abs(sp - pk) / pk * 100 > cfg.curveTol) { c.status = 'fail'; c.count++; c.summary += ' Peak differs.'; } } }
  { const c = add({ id: 'D4', group: 'Submitted documents', title: 'Resource calculations reconcile with the schedule', rule: 'For each activity in the resource-calculation sheet, the duration and resource hours must match the schedule.' });
    const d = D.rescalc; if (!d || !d.rows || !d.rows.length) miss(c, 'resource calculations not supplied.');
    else { const byCode = {}; M.tasks.forEach(t => byCode[t.code.toUpperCase()] = t); const isLab = a => rs[a.rsrc] && rs[a.rsrc].type === 'RT_Labor' && a.rsrc !== progId && a.rsrc !== costId; const isEq = a => rs[a.rsrc] && rs[a.rsrc].type === 'RT_Equip';
      for (const r of d.rows) { const t = byCode[String(r.act).trim().toUpperCase()]; if (!t) { c.items.push({ id: r.act, name: '', wbs: '', field: 'Activity not in schedule', value: '', note: '' }); continue; }
        if (r.dur != null && t.durWd != null && Math.abs(r.dur - t.durWd) > 0.5) c.items.push({ id: t.code, name: t.name, wbs: t.wbsPath, field: 'Duration (days)', value: 'Calc ' + num(r.dur) + ' | Schedule ' + num(t.durWd), note: '' });
        const hl = t.asg.filter(isLab).reduce((s, a) => s + a.qty, 0), he = t.asg.filter(isEq).reduce((s, a) => s + a.qty, 0);
        if (r.labour != null && Math.abs(r.labour - hl) > Math.max(1, hl * 0.05)) c.items.push({ id: t.code, name: t.name, wbs: t.wbsPath, field: 'Labour hours', value: 'Calc ' + num(r.labour) + ' | Schedule ' + num(hl), note: '' });
        if (r.equip != null && Math.abs(r.equip - he) > Math.max(1, he * 0.05)) c.items.push({ id: t.code, name: t.name, wbs: t.wbsPath, field: 'Equipment hours', value: 'Calc ' + num(r.equip) + ' | Schedule ' + num(he), note: '' }); }
      c.count = c.items.length; c.total = d.rows.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' differences.' : 'Calculations reconcile.'; c.action = 'Align the resource calculations with the schedule.'; } }
  { const c = add({ id: 'D5', group: 'Submitted documents', title: 'BOQ mapping sheet provided', rule: 'The contractor must submit the sheet linking BOQ items to activities (tested in S2–S4).' });
    if (!mp || !mp.rows.length) miss(c, 'BOQ mapping sheet not supplied.'); else { c.status = 'pass'; c.summary = mp.rows.length + ' links supplied; see S2–S4.'; } }
  { const c = add({ id: 'D6', group: 'Submitted documents', title: 'Narrative report agrees with the schedule', rule: 'The baseline narrative must state the same finish date, working calendars and critical path as the schedule.' });
    const d = D.narrative; if (!d || !d.text) miss(c, 'narrative report not supplied.');
    else { const txt = d.text; const fin = out.finish ? out.finish.ef : M.maxEF; const forms = d => { const x = new Date(d * MS3); const mon = ['January','February','March','April','May','June','July','August','September','October','November','December'][x.getUTCMonth()]; const dd = x.getUTCDate(), yy = x.getUTCFullYear(); return [dd + ' ' + mon + ' ' + yy, mon + ' ' + dd + ', ' + yy, mon.slice(0, 3) + ' ' + dd + ', ' + yy, dd + '-' + mon.slice(0, 3) + '-' + yy, E.dayToStr(d), String(dd).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0') + '/' + yy]; };
      const low = txt.toLowerCase(); const hasFin = forms(fin).some(f => low.includes(f.toLowerCase()));
      if (!hasFin) c.items.push({ id: 'Finish date', name: 'The schedule finishes on ' + E.fmtDate(fin), wbs: '', field: 'Not stated in narrative', value: '', note: 'Looked for common date formats' });
      const calw = /(six|6)[\s-]*day|(five|5)[\s-]*day|(seven|7)[\s-]*day/i.test(txt); if (!calw) c.items.push({ id: 'Working week', name: 'No working-week statement found', wbs: '', field: 'Calendars', value: '', note: '' });
      if (!/critical path/i.test(txt)) c.items.push({ id: 'Critical path', name: 'No critical path description found', wbs: '', field: 'Critical path', value: '', note: '' });
      if (d.ai) c.evidence.push('AI-extracted statements: ' + JSON.stringify(d.ai).slice(0, 600));
      c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' items not found in the narrative.' : 'Narrative states finish date, working week and critical path.'; c.action = 'Complete the narrative so it describes the programme as submitted.'; c.tier = 'minor'; } }
  { const c = add({ id: 'D7', group: 'Submitted documents', title: 'General layout zones and roads agree with the WBS', rule: 'Every zone and road on the general layout must exist as a WBS branch and every zone / road in the WBS must be on the layout.' });
    const d = D.layout; if (!d || (!d.zones.length && !d.roads.length)) miss(c, 'general layout not supplied / read.');
    else { const wz = new Set(), wr = new Set(); Object.values(M.wbs).forEach(w => { const z = w.path.slice(1).join(' / '); (function () { const r = /zone\s*-?\s*([A-Z][0-9]?(?:\s*,\s*[A-Z][0-9]?)*)/gi; let m; while ((m = r.exec(z))) m[1].split(',').forEach(x => wz.add(x.trim()[0].toUpperCase())); })(); const r2 = /\broad\s*-?\s*(\d{1,3}[A-Z]?)\b/gi; let m2; while ((m2 = r2.exec(w.name))) wr.add(m2[1].toUpperCase()); });
      const lz = new Set(d.zones.map(z => String(z).replace(/zone|[\s-]/gi, '').toUpperCase()[0]).filter(Boolean)); const lr = new Set(d.roads.map(r => (/(\d{1,3}[A-Z]?)/.exec(String(r)) || [])[1]).filter(Boolean).map(x => x.toUpperCase()));
      lz.forEach(z => { if (!wz.has(z)) c.items.push({ id: 'Zone ' + z, name: 'On layout, no WBS branch', wbs: '', field: 'Possible scope gap', value: '', note: '' }); }); wz.forEach(z => { if (!lz.has(z)) c.items.push({ id: 'Zone ' + z, name: 'In WBS, not on layout', wbs: '', field: 'Not on layout', value: '', note: '' }); });
      lr.forEach(r => { if (!wr.has(r)) c.items.push({ id: 'Road ' + r, name: 'On layout, no WBS branch', wbs: '', field: 'Possible scope gap', value: '', note: '' }); }); wr.forEach(r => { if (!lr.has(r)) c.items.push({ id: 'Road ' + r, name: 'In WBS, not on layout', wbs: '', field: 'Not on layout', value: '', note: '' }); });
      c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' zones/roads differ.' : 'Layout and WBS agree.'; c.action = 'Add missing WBS branches or confirm the differences.'; } }
  return out;
};

/* ===== BOQ / sheet helpers ===== */
E.guessBoqColumns = function (rows) {
  const hdrIdx = rows.findIndex(r => r && r.filter(x => typeof x === 'string').length >= 3 && r.some(x => /desc/i.test(String(x))));
  const h = hdrIdx >= 0 ? rows[hdrIdx].map(x => String(x || '').toLowerCase()) : [];
  const find = rx => h.findIndex(x => rx.test(x));
  return { header: hdrIdx, item: find(/item|ref|no\b|sr/), desc: find(/desc|work|particular/), unit: find(/unit|uom/), qty: find(/qty|quant/), rate: find(/rate|price/), amount: find(/amount|total|value|cost/), part: find(/part|section|bill|group/) };
};
E.readBoq = function (rows, col) {
  const items = []; let total = 0;
  for (let i = col.header + 1; i < rows.length; i++) {
    const r = rows[i] || []; const amt = parseFloat(String(r[col.amount]).replace(/,/g, '')); const item = r[col.item];
    if (item === undefined || item === '' || isNaN(amt)) { if (/total|grand/i.test(String(r[col.desc] || r[col.item] || '')) && !isNaN(amt)) { } continue; }
    if (/total/i.test(String(r[col.desc] || ''))) continue;
    items.push({ item: String(item), desc: String(r[col.desc] || ''), unit: r[col.unit], qty: parseFloat(r[col.qty]), rate: parseFloat(r[col.rate]), amount: amt, part: col.part >= 0 ? r[col.part] : '' }); total += amt;
  }
  return { items, total };
};
