/* ===== ENGINE PART 12: sequence rules – warnings on the order of works (v5.12). Rules are editable settings; they describe, they do not judge. ===== */
E.SEQ_STEPS = [
  ['ptest', 'Pressure / leakage test', 'pressure test|leak(?:age)? test|hydro(?:static)? test|water ?tightness test'],
  ['integ', 'Integrated systems test', 'integrated (?:systems? )?test|\\bist\\b'],
  ['handover', 'Handover', 'hand ?over|handing over|taking over'],
  ['inspect', 'Authority inspection', 'civil defen[cs]e|authority inspection|\\bdcd\\b|\\bcd inspection'],
  ['tab', 'Testing and balancing', 'testing (?:and|&) balancing|\\btab\\b|air balanc'],
  ['tc', 'Testing and commissioning', 'test(?:ing)? (?:and|&) commission|\\bt ?& ?c\\b|commissioning'],
  ['lifttest', 'Lift testing', '(?:lift|elevator|escalator).*(?:test|commission)'],
  ['liftinst', 'Lift installation', 'lift|elevator|escalator'],
  ['power', 'Permanent power', 'permanent power|energi[sz]ation|energi[sz]ing'],
  ['facade', 'Facade and glazing', 'facade|façade|curtain wall|glazing|cladding|\\bacp\\b|gfrc|window'],
  ['finalfix', 'Final fixtures and devices', 'final fix|switch(?:es)?\\b|socket|luminaire|light(?:ing)? fitting|lighting fixture|sanitary ?ware|sanitary fixture|wash ?basin|\\bbasin|\\bwc\\b|water closet|\\btaps?\\b|mixer|diffuser|grille|smoke detector|detector|fire alarm device|cctv camera'],
  ['secondfix', 'MEP second fix', 'second fix|2nd fix|cable pull|wire pull|wiring|cabling|cable installation'],
  ['firstfix', 'MEP first fix', 'first fix|1st fix|rough[- ]?in|conduit|embedded|sleeve|pipework|piping|duct(?:ing| ?work)|cable tray|containment'],
  ['doorframe', 'Door frames', 'door ?frame|frames? install'],
  ['doorjoin', 'Door leaves and joinery', 'door (?:leaf|leaves|shutter|install)|doors? (?:install|fix|fit)|ironmongery|architrave|joinery|wardrobe|cabinet|vanity|kitchen unit|furniture|\\bdoors?\\b'],
  ['skirtT', 'Tile / stone skirting', '(?:tile|marble|granite|stone|ceramic|porcelain) skirting|skirting.*(?:tile|marble|granite|stone)'],
  ['skirtW', 'Timber / MDF skirting', 'skirting'],
  ['roofwp', 'Roof waterproofing', 'roof.*waterproof|waterproof.*roof'],
  ['roofin', 'Roof finishes', 'roof (?:finish|insulation|tile|screed|paving)'],
  ['roofstruct', 'Roof structure', 'roof.*(?:slab|concrete|structure|beam)|(?:slab|concrete).*roof'],
  ['waterproof', 'Waterproofing', 'waterproof'],
  ['screed', 'Screed', 'screed'],
  ['walltile', 'Wall tiling', 'wall (?:tile|tiling|ceramic|cladding)|(?:tile|tiling|ceramic).*wall'],
  ['floortile', 'Floor tiling and flooring', 'floor (?:tile|tiling|finish)|flooring|tiling|\\btiles?\\b|carpet|parquet|porcelain|marble|granite|epoxy|vinyl'],
  ['plaster', 'Plaster', 'plaster|render'],
  ['ceil', 'Ceiling', 'ceiling|gypsum|false ceiling|ceiling grid'],
  ['putty', 'Putty', 'putty'],
  ['paintFirst', 'Paint, first coat', 'primer|first coat|1st coat|base coat|sealer|undercoat'],
  ['paintFinal', 'Paint, final coat', 'final coat|finish(?:ing)? coat|top coat|2nd coat|second coat|final paint|touch[- ]?up'],
  ['paint', 'Paint (coat not stated)', 'paint'],
  ['clean', 'Cleaning', 'final clean|cleaning|clean-?up'],
  ['block', 'Block work', 'block ?work|blockwork|masonry|brick'],
  ['found', 'Foundations', 'foundation|raft|footing|blinding|pile cap'],
  ['struct', 'Structure (RC)', 'concrete|rebar|reinforc|formwork|shuttering|\\bslab|column|shear wall|\\bstructure|casting|\\bpour'],
  ['excav', 'Excavation', 'excavat|earth ?work']
];
E.SEQ_RULES = [
  { id: 'A1', on: true, title: 'Shop drawing approval → construction start', pred: ['stage:engineering'], succ: ['stage:construction'], scope: 'package', mode: 'fs' },
  { id: 'A2', on: true, title: 'Procurement / delivery → construction start', pred: ['stage:procurement'], succ: ['stage:construction'], scope: 'package', mode: 'fs' },
  { id: 'A3', on: true, title: 'Testing and commissioning should not finish before the construction it tests', pred: ['work'], succ: ['tc'], scope: 'building', mode: 'ff' },
  { id: 'A4', on: true, title: 'Testing and commissioning → handover', pred: ['tc'], succ: ['handover'], scope: 'building', mode: 'fs' },
  { id: 'B1', on: true, title: 'Excavation → foundations', pred: ['excav'], succ: ['found'], scope: 'building', mode: 'overlap' },
  { id: 'B2', on: true, title: 'Foundations → structure', pred: ['found'], succ: ['struct'], scope: 'building', mode: 'overlap' },
  { id: 'B3', on: true, title: 'Structure floor by floor: a floor must not start before the floor below', pred: ['struct'], succ: ['struct'], scope: 'floorcycle', mode: 'overlap' },
  { id: 'B5', on: true, title: 'Waterproofing → screed', pred: ['waterproof'], succ: ['screed'], scope: 'floorzone', mode: 'fs' },
  { id: 'B7', on: true, title: 'Block work on all floors → facade and glazing start (safety)', pred: ['block'], succ: ['facade'], scope: 'building', mode: 'fs' },
  { id: 'B8', on: true, title: 'Roof structure → roof waterproofing → roof finishes', pred: ['roofstruct', 'roofwp'], succ: ['roofwp', 'roofin'], scope: 'building', mode: 'fs' },
  { id: 'C1', on: true, title: 'Block work → MEP first fix', pred: ['block'], succ: ['firstfix'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C2', on: true, title: 'MEP first fix → plaster', pred: ['firstfix'], succ: ['plaster'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C3', on: true, title: 'Pressure / leakage test → closing walls and ceilings', pred: ['ptest'], succ: ['ceil', 'plaster'], scope: 'floorzone', mode: 'fs' },
  { id: 'C4', on: true, title: 'Plaster → wet-area waterproofing', pred: ['plaster'], succ: ['waterproof'], scope: 'floorzone', mode: 'fs' },
  { id: 'C5', on: true, title: 'Screed → floor tiling / flooring (cure time as lag)', pred: ['screed'], succ: ['floortile'], scope: 'floorzone', mode: 'fs' },
  { id: 'C6', on: true, title: 'MEP first fix above ceiling (tested) → ceiling', pred: ['firstfix'], succ: ['ceil'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C7', on: true, title: 'Ceiling → first-coat paint', pred: ['ceil'], succ: ['paintFirst'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C8a', on: true, title: 'Plaster → putty', pred: ['plaster'], succ: ['putty'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C8b', on: true, title: 'Putty → first-coat paint', pred: ['putty'], succ: ['paintFirst'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C8c', on: true, title: 'Plaster → first-coat paint (when the baseline has no putty activity)', pred: ['plaster'], succ: ['paintFirst'], scope: 'floorzone', mode: 'overlap', noStep: 'putty' },
  { id: 'C9', on: true, title: 'Plaster, or paint up to first coat → MEP second fix (cable pulling and similar)', pred: ['plaster', 'paintFirst'], succ: ['secondfix'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C10', on: true, title: 'Facade and glazing (weather-tight) → plaster', pred: ['facade'], succ: ['plaster'], scope: 'building', mode: 'fs' },
  { id: 'C13', on: true, title: 'Wall tiling in wet areas → ceiling closing', pred: ['walltile'], succ: ['ceil'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C14', on: true, title: 'Ceiling and first-coat paint → floor tiling (a floor tiled earlier is a warning)', pred: ['ceil', 'paintFirst'], succ: ['floortile'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C15', on: true, title: 'Floor tiling → tile / stone skirting', pred: ['floortile'], succ: ['skirtT'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C16', on: true, title: 'Ceiling, floor tiling, tile skirting and MEP second fix → final-coat paint', pred: ['ceil', 'floortile', 'skirtT', 'secondfix'], succ: ['paintFinal'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C17', on: true, title: 'Floor finish (including carpet) → timber / MDF skirting (no warning on the order with carpet)', pred: ['floortile'], succ: ['skirtW'], scope: 'floorzone', mode: 'overlap', logicOnly: true },
  { id: 'C19', on: true, title: 'Final-coat paint → door leaves and joinery (before the final coat is shown as "check", not wrong)', pred: ['paintFinal'], succ: ['doorjoin'], scope: 'floorzone', mode: 'overlap', soft: true },
  { id: 'C20', on: true, title: 'Final-coat paint → final fixtures and devices', pred: ['paintFinal'], succ: ['finalfix'], scope: 'floorzone', mode: 'overlap' },
  { id: 'C12', on: true, title: 'Final-coat paint, joinery and fixtures → cleaning', pred: ['paintFinal', 'doorjoin', 'finalfix'], succ: ['clean'], scope: 'floorzone', mode: 'fs' },
  { id: 'C21', on: false, title: 'Door frames → plaster (suggested, not yet confirmed)', pred: ['doorframe'], succ: ['plaster'], scope: 'floorzone', mode: 'overlap' },
  { id: 'D1', on: true, title: 'Lift installation → lift testing', pred: ['liftinst'], succ: ['lifttest'], scope: 'building', mode: 'fs' },
  { id: 'D2', on: true, title: 'Permanent power → testing and commissioning', pred: ['power'], succ: ['tc'], scope: 'building', mode: 'fs' },
  { id: 'D3', on: true, title: 'HVAC installation → testing and balancing', pred: ['tr:HVAC'], succ: ['tab'], scope: 'building', mode: 'fs' },
  { id: 'D4', on: true, title: 'Fire fighting and alarm installation → authority inspection', pred: ['tr:Plumbing, drainage & fire fighting'], succ: ['inspect'], scope: 'building', mode: 'fs' },
  { id: 'D5a', on: true, title: 'Testing and commissioning → integrated systems test', pred: ['tc'], succ: ['integ'], scope: 'building', mode: 'fs' },
  { id: 'D5b', on: true, title: 'Integrated systems test → handover', pred: ['integ'], succ: ['handover'], scope: 'building', mode: 'fs' }
];
E.SEQ_DEFAULTS = { thresholdWd: 10, tolDays: 0, paintGeneric: 'final', dirTau: 0.7, rules: null, steps: null };
E.seqSteps = (cfg) => ((cfg.structure && cfg.structure.seq && cfg.structure.seq.steps) || E.SEQ_STEPS).map(r => [r[0], r[1], new RegExp(r[2], 'i')]);
E.seqRules = (cfg) => (cfg.structure && cfg.structure.seq && cfg.structure.seq.rules) || E.SEQ_RULES;
E.seqCheck = function (st, cfg) {
  const sc = Object.assign({}, E.SEQ_DEFAULTS, (cfg.structure && cfg.structure.seq) || {}), steps = E.seqSteps(cfg), rules = E.seqRules(cfg), M = st.M, rows = st.rows;
  const lastSeg = o => { const w = M.wbs[o.t.wbs]; return w && w.path ? w.path[w.path.length - 1] || '' : ''; };
  const stepCount = {}; for (const o of rows) { let k = null; for (const [key, , rx] of steps) if (rx.test(o.t.name)) { k = key; break; } if (!k) { const sg = lastSeg(o); for (const [key, , rx] of steps) if (rx.test(sg)) { k = key; break; } } if (k === 'paint') k = sc.paintGeneric === 'first' ? 'paintFirst' : 'paintFinal'; o.step = k; if (k) stepCount[k] = (stepCount[k] || 0) + 1; }
  const WORKEXC = new Set(['tc', 'integ', 'handover', 'inspect', 'tab', 'ptest', 'lifttest', 'clean']);
  const mem = (o, spec) => spec.startsWith('stage:') ? o.stage === spec.slice(6) : spec.startsWith('tr:') ? o.tr === spec.slice(3) : spec === 'work' ? (o.stage === 'construction' && !WORKEXC.has(o.step)) : o.step === spec;
  const byId = new Map(rows.map(o => [o.t.id, o])), calPerWd = 7 / 6, thrDays = sc.thresholdWd * calPerWd;
  const dayOf = (o, side) => side === 'a' ? o.a : o.e;
  const span = list => { let a = Infinity, e = -Infinity; for (const o of list) { if (o.a != null && o.a < a) a = o.a; if (o.e != null && o.e > e) e = o.e; } return a < Infinity && e > -Infinity ? { a, e } : null; };
  const keyFn = { floorzone: o => o.f ? (o.loc || '(no building)') + ' | ' + o.f.label + (st.zoneSystem || !o.z ? '' : ' | ' + o.z) : null, building: o => o.b || o.u || '(project)', package: o => o.u || o.b || null };
  const reach = (from, toSet) => { const seen = new Set(), q = []; for (const o of from) { q.push(o.t); seen.add(o.t.id); } let n = 0; while (q.length && n < 3000) { const t = q.shift(); n++; for (const l of t.succ) { const x = l.to; if (toSet.has(x.id)) return true; if (!seen.has(x.id)) { seen.add(x.id); q.push(x); } } } return false; };
  const out = { rules: [], e1: [], e4: [], stepCount, steps, scan: Date.now() };
  const date = E.fmtDate;
  const evalPair = (r, g, P, S, res, label) => {
    const sp = span(P), ss = span(S); if (!sp || !ss) return; res.groups++;
    const Sset = new Set(S.map(o => o.t.id)), direct = []; for (const o of P) for (const l of o.t.succ) if (Sset.has(l.to.id)) direct.push(l);
    const add = (type, text) => { res.w[type] = (res.w[type] || 0) + 1; if (res.items.length < 12) res.items.push({ g: label, type, text }); };
    const fmt = x => date(x.a) + ' → ' + date(x.e), pd = fmt(sp), sd = fmt(ss);
    if (!direct.length && !reach(P, Sset)) { add('missing', 'No logic path from the predecessor (' + pd + ') to the successor (' + sd + ').'); }
    if (r.mode === 'ff') { if (ss.e < sp.e - sc.tolDays) add('overlap', 'Finishes (' + date(ss.e) + ') before the work it covers (' + date(sp.e) + ').'); return; }
    if (r.mode === 'fs') { if (ss.a < sp.e - sc.tolDays) add('overlap', 'Successor starts ' + date(ss.a) + ', ' + Math.round(sp.e - ss.a) + ' d before the predecessor finishes (' + date(sp.e) + ').'); }
    else if (!r.logicOnly) { if (ss.a < sp.e - sc.tolDays) { if (sp.e - sp.a < thrDays) add('overlap', 'Overlap with a short predecessor (' + Math.round(sp.e - sp.a) + ' d, below the ' + sc.thresholdWd + ' working-day limit): finish-to-start expected. Successor ' + sd + ', predecessor ' + pd + '.'); else if (ss.e < sp.e) add('overlap', 'Successor finishes (' + date(ss.e) + ') before the predecessor (' + date(sp.e) + ').'); } }
    if (direct.length) { const T = x => direct.filter(l => l.type === x); const fs = T('FS'), s = T('SS'), f = T('FF'); if (s.length && !f.length && !fs.length) add('relation', 'Start-to-start without finish-to-finish: the successor could finish before the predecessor.'); else if (s.length && f.length && !fs.length && s.every(l => l.lagWd <= 0) && f.every(l => l.lagWd <= 0)) add('relation', 'Start-to-start and finish-to-finish both with zero lag.'); if (fs.length && fs.every(l => l.lagWd < 0)) add('relation', 'Finish-to-start with a negative lag (' + fs[0].lagWd.toFixed(1) + ' wd).'); }
  };
  for (const r of rules) {
    const res = { rule: r, groups: 0, w: {}, items: [], on: r.on !== false }; out.rules.push(res); if (!res.on) continue;
    const inP = o => r.pred.some(s => mem(o, s)), inS = o => r.succ.some(s => mem(o, s));
    if (r.scope === 'floorcycle') {
      const bl = new Map(); for (const o of rows) { if (!o.f || o.step !== 'struct' || o.f.ord > 97) continue; const k = o.b || o.u || '(project)'; let m = bl.get(k); if (!m) bl.set(k, m = new Map()); let a = m.get(o.f.ord); if (!a) m.set(o.f.ord, a = []); a.push(o); }
      for (const [k, m] of bl) { const ords = [...m.keys()].sort((a, b) => a - b); for (let i = 1; i < ords.length; i++) { const lo = span(m.get(ords[i - 1])), hi = span(m.get(ords[i])); if (!lo || !hi) continue; res.groups++; if (hi.a < lo.a - sc.tolDays) { res.w.overlap = (res.w.overlap || 0) + 1; if (res.items.length < 12) res.items.push({ g: k + ' | ' + m.get(ords[i])[0].f.label, type: 'overlap', text: 'Structure of this floor starts (' + date(hi.a) + ') before the floor below (' + date(lo.a) + ').' }); } } }
      continue;
    }
    const kf = keyFn[r.scope]; if (!kf) continue;
    const involved = rows.filter(o => inP(o) || inS(o)); let keys = new Set(involved.map(kf).filter(Boolean)); const collapse = r.scope === 'building' && [...keys].filter(k => k !== '(project)').length < 2;
    const groups = new Map(); for (const o of involved) { const k = collapse ? '(whole project)' : kf(o); if (!k || (!collapse && r.scope === 'building' && k === '(project)' && keys.size > 1)) continue; let g = groups.get(k); if (!g) groups.set(k, g = { P: [], S: [] }); if (inP(o)) g.P.push(o); if (inS(o)) g.S.push(o); }
    for (const [k, g] of groups) { if (!g.P.length || !g.S.length) continue; if (r.noStep && rows.some(o => o.step === r.noStep && (collapse || kf(o) === k))) continue; evalPair(r, k, g.P, g.S, res, k); }
  }
  // E1 floor direction per trade step
  const dirSteps = ['struct', 'block', 'firstfix', 'plaster', 'ceil', 'floortile', 'paintFinal', 'doorjoin'], lbl = Object.fromEntries(steps.map(s => [s[0], s[1]]));
  for (const sk of dirSteps) { const bl = new Map(); for (const o of rows) { if (o.step !== sk || !o.f || o.f.ord > 97 || o.a == null) continue; const k = o.b || o.u || '(project)'; let m = bl.get(k); if (!m) bl.set(k, m = new Map()); const c = m.get(o.f.ord); if (c == null || o.a < c.a) m.set(o.f.ord, { a: o.a, f: o.f.label }); }
    for (const [k, m] of bl) { const fl = [...m.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]); if (fl.length < 4) continue; let c = 0, d = 0; for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { if (fl[j].a > fl[i].a) c++; else if (fl[j].a < fl[i].a) d++; } const tau = (c - d) / Math.max(1, c + d); out.e1.push({ step: lbl[sk], k, floors: fl.length, tau, dir: tau > 0 ? 'upward' : 'downward', warn: Math.abs(tau) < sc.dirTau, order: [...fl].sort((a, b) => a.a - b.a).slice(0, 14).map(x => x.f).join(' → ') }); } }
  // E4 same trade in several plots, overlapping, no link between them
  const pairLink = new Set(); for (const l of M.links) { const a = byId.get(l.from.id), b = byId.get(l.to.id); if (!a || !b || !a.step || a.step !== b.step) continue; const ka = a.b || a.u, kb = b.b || b.u; if (ka && kb && ka !== kb) pairLink.add(a.step + '|' + ka + '|' + kb); }
  for (const sk of ['struct', 'block', 'firstfix', 'plaster', 'ceil', 'floortile', 'paintFinal']) { const bl = new Map(); for (const o of rows) { if (o.step !== sk) continue; const k = o.b || o.u; if (!k) continue; let m = bl.get(k); if (!m) bl.set(k, m = []); m.push(o); } if (bl.size < 2) continue; const ks = [...bl.keys()], sp = ks.map(k => span(bl.get(k))), par = [];
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { if (!sp[i] || !sp[j]) continue; const ov = Math.min(sp[i].e, sp[j].e) - Math.max(sp[i].a, sp[j].a); if (ov > 14 && !pairLink.has(sk + '|' + ks[i] + '|' + ks[j]) && !pairLink.has(sk + '|' + ks[j] + '|' + ks[i])) par.push(ks[i] + ' and ' + ks[j] + ' (' + Math.round(ov) + ' d together)'); }
    if (par.length) out.e4.push({ step: lbl[sk], n: par.length, items: par.slice(0, 8) }); }
  return out;
};
