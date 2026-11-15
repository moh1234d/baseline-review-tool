/* ===== ENGINE PART 11: build structure – where, what and in which order the baseline is built (Quick review > Build sequence) ===== */
E.STRUCT_TRADES = [
  ['Testing & handover', '^(testing|test\\b|commission|snag|inspection|handover|hand over|t&c)|close ?out'],
  ['Sewerage network', 'sewer|sewage|manhole'],
  ['Drainage network', 'storm|catch ?basin|drainage network|drainage grp'],
  ['Potable water network', 'potable|valve chamber|water network'],
  ['Irrigation / TSE', 'irrigat|\\btse\\b'],
  ['District cooling', 'district cooling'],
  ['Roads & paving', 'road|asphalt|kerb|paving|interlock|sidewalk'],
  ['Street lighting', 'street ?light'],
  ['Dry utilities (power & ICT)', 'duct bank|substation|fib(?:er|re)'],
  ['Structure (RC)', 'concrete|rebar|reinforc|formwork|shuttering|slab\\b|raft|footing|shear|column|retaining|blinding|cast ?#'],
  ['Earthworks', 'excavat|backfill|earth ?work|compaction|dewater'],
  ['Waterproofing & insulation', 'waterproof|insulation|termite|damp ?proof'],
  ['Masonry', 'mason|block ?work|brick'],
  ['Plaster & screed', 'plaster|render|screed'],
  ['Paint', 'paint|primer|putty'],
  ['Ceilings', 'ceiling|gypsum'],
  ['Flooring & tiling', 'floor finish|tile|tiling|porcelain|marble|granite|stone|skirting|parquet|carpet|epoxy'],
  ['Doors, windows & glazing', 'door|window|glaz|curtain wall|alumin|louver'],
  ['Facade & cladding', 'facade|façade|cladding|\\bacp\\b|elevation|gfrc|grc'],
  ['Joinery & FF&E', 'joinery|wood|cabinet|wardrobe|vanity|furniture|kitchen|wallpaper|oak'],
  ['Metalwork', 'steel|metal|handrail|balustrade|railing|stair|canopy|pergola'],
  ['HVAC', 'hvac|duct|chilled|\\bfcu|\\bahu|split|\\bvrf|ventilat|damper|air condition'],
  ['Plumbing, drainage & fire fighting', 'plumb|drain|sanit|water supply|potable|sewer|pipe|leakage|sprinkler|fire ?fight|hydrant'],
  ['Electrical', 'electric|cable|conduit|wiring|lighting|\\bdb\\b|panel|earthing|socket|switch|generator|transformer|\\blv\\b|\\bmv\\b'],
  ['ELV / low current', '\\bict|telecom|\\bdata\\b|cctv|fire alarm|access control|\\bbms|\\bpa\\b|audio|intercom|structured cabling'],
  ['Lifts', 'lift|elevator|escalator'],
  ['Landscape & external', 'landscape|hardscape|softscape|irrigat|paving|interlock|kerb|asphalt|road|sign|external']
];
E.normFloor = function (raw, strict) {
  const s = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').replace('SECOUND', 'SECOND'); if (!s) return null; let m;
  const ord = n => n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th', num = n => n === 0 ? { label: 'Ground', ord: 0 } : { label: n + ord(n), ord: n };
  if (/^(ALL|TYPICAL)\s*(ALL\s*)?FLOORS?$/.test(s)) return null;
  if (/UPPER ROOF|^UR$|PENTHOUSE|^PH$/.test(s)) return { label: 'Upper roof', ord: 99 };
  if (/ROOF|^RF$/.test(s)) return { label: 'Roof', ord: 98 };
  if (/SUB ?-?STRUCTURE|^FOUNDATION/.test(s)) return { label: 'Sub-structure', ord: -2 };
  if ((m = s.match(/^(?:BASEMENT|BSMT|B)\s*-?\s*0?(\d)\s*(?:FLOOR|LEVEL)?$/))) return { label: 'Basement ' + m[1], ord: -(+m[1]) };
  if (/^BASEMENT|^BA$|^BF$/.test(s)) return { label: 'Basement', ord: -1 };
  if (/^(GROUND|GF|G|GR)(\s*(FLOOR|LEVEL))?$|^GROUND/.test(s)) return { label: 'Ground', ord: 0 };
  if (/^MEZZ/.test(s)) return { label: 'Mezzanine', ord: 0.5 };
  if (/^TYPICAL/.test(s)) return { label: 'Typical', ord: 50 };
  const w = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5, SIXTH: 6, SEVENTH: 7, EIGHTH: 8 }; for (const k in w) if (s.indexOf(k) === 0) return num(w[k]);
  if (s === 'FF') return num(1); if (s === 'SF') return num(2); if (s === 'TF') return num(3);
  if ((m = s.match(/^(?:LEVEL|LVL|LV|L)\s*-?\s*0?(\d{1,2})$/))) return num(+m[1]);
  if ((m = s.match(/^0?(\d{1,2})\s*(?:ST|ND|RD|TH|F)?(?:\s*(?:FLOOR|LEVEL))?$/))) return num(+m[1]);
  if (strict) return null;
  return { label: s.charAt(0) + s.slice(1).toLowerCase(), ord: 200 };
};
E.STRUCT_RX = {
  bldgSeg: /^(plot|building|bldg|block|tower|villa)\s*-?\s*0?(\d+[A-Z]?)\s*$/i,
  bldgName: /\b(?:(plot|building|bldg|block|tower|villa)\s*-?\s*0?(\d+[A-Z]?)|B-?0?(\d{1,2}))\b/i,
  floorSeg: /^(?:(ground|first|second|secound|third|fourth|fifth|sixth|seventh|eighth|\d{1,2}(?:st|nd|rd|th)|basement(?:\s*\d)?|sub-?\s*structure|upper roof|roof|mezzanine|typical)\s*(?:floor|level|roof)?|(?:level|lvl|l)\s*-?0?(\d{1,2}))\b/i,
  floorName: /\b(GF|FF|SF|[1-9]F|RF|UR|BF|G\.F|F\.F|S\.F)\b|\b(ground|first|second|secound|third|fourth|fifth|sixth|\d{1,2}(?:st|nd|rd|th)|basement\s*\d?|sub-?structure|upper roof|roof)\s*(?:floor|level)\b|\b(?:level|lvl)\s*-?0?(\d{1,2})\b|\bL-?0?(\d{1,2})\b/i,
  zoneSeg: /^zone\s*-?\s*([A-Z0-9]+)\b/i,
  zoneName: /\bZ-?0?(\d{1,2})\b|\bzone\s*-?\s*([A-Z0-9]+)\b/i
};
E.structBuildingLabel = (kind, num) => (kind ? kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase() : 'Building') + ' ' + String(num).toUpperCase();
E.structCodeCandidates = function (M, minVals) {
  const types = new Map();
  for (const t of M.tasks) { if (t.isMile) continue; for (const k in t.codes) { let o = types.get(k); if (!o) types.set(k, o = { name: k, n: 0, vals: new Set() }); o.n++; o.vals.add(t.codes[k].short); } }
  return [...types.values()].filter(o => o.vals.size >= (minVals || 2));
};
E.structSuggestCodes = function (M) {
  const C = E.structCodeCandidates(M), pick = (rxs) => { for (const rx of rxs) { const c = C.filter(o => rx.test(o.name)).sort((a, b) => b.n - a.n)[0]; if (c) return c.name; } return null; };
  const unit = C.filter(o => /^(villa type|package|cluster)/i.test(o.name)).map(o => o.name);
  return { building: pick([/plot|building|bldg|block|tower|villa/i]), unit: unit.length ? unit : null, zone: pick([/zone/i, /rooms?\s*\/\s*areas?|^[^-]*-\s*rooms?$/i]), floor: pick([/floor/i, /level/i]), trade: pick([/major activit/i, /^[^-]*-?\s*trades?$/i, /work package|discipline/i]), contractor: pick([/sub-?contractor/i, /contractor/i, /vendor|supplier/i]) };
};
E.STRUCT_STAGES = [['mobilization', 'mobili[sz]'], ['engineering', 'engineering|shop ?draw|drawings?\\b'], ['procurement', 'procurement|purchas|procure'], ['closeout', 'close ?out|handing ?over|hand ?over|commissioning'], ['construction', 'construction']];
E.structStage = function (t, segs, rules) {
  let found = null; const R = (rules || E.STRUCT_STAGES).map(r => [r[0], new RegExp(r[1], 'i')]); for (let i = 1; i < segs.length; i++) for (const [k, rx] of R) if (rx.test(segs[i])) found = k;
  if (t.cat && t.cat !== 'general') { if (found && (found === 'engineering' || found === 'procurement') && (t.cat === 'construction' || t.cat === 'engineering')) return found; return t.cat === 'delivery' || (t.cat === 'engineering' && found === 'procurement') ? 'procurement' : t.cat; }
  return found || t.cat || 'general';
};
E.structure = function (M, cfg) {
  const sc = Object.assign({ bareBuilding: false, codeMap: null, tradeRules: null, stageRules: null, floorStrict: true, zoneSystem: null, unitWords: 'area|stage|phase|package|cluster|village', unitSkipParents: 'floor|typical|podium|basement|level', contractorAliases: '' }, cfg.structure || {});
  const codeMap = Object.assign({}, E.structSuggestCodes(M), sc.codeMap || {}), rules = (sc.tradeRules || E.STRUCT_TRADES).map(r => [r[0], new RegExp(r[1], 'i')]);
  const R = Object.assign({}, E.STRUCT_RX), T = M.tasks.filter(t => !t.isMile), rows = [], day = t => t.ts != null ? t.ts : t.es, dayE = t => t.te != null ? t.te : t.ef;
  const skipRx = sc.unitSkipParents ? new RegExp(sc.unitSkipParents, 'i') : null, aliasMap = new Map(String(sc.contractorAliases || '').split(/[\n;]+/).map(l => l.split('=').map(x => x.trim())).filter(a => a.length === 2 && a[0] && a[1]).map(a => [a[0].toLowerCase(), a[1]])), bnRx = sc.bareBuilding ? R.bldgName : /\b(?:(plot|building|bldg|block|tower|villa)\s*-?\s*0?(\d+[A-Z]?))\b/i, unitRx = new RegExp('^(' + sc.unitWords + ')\\s*[-(]*\\s*0?(\\d+[A-Z]?)\\)?', 'i'), srcCount = { building: {}, unit: {}, zone: {}, floor: {}, trade: {}, contractor: {} }, inc = (d, s) => { srcCount[d][s] = (srcCount[d][s] || 0) + 1; };
  const fromCode = (t, d) => { const nms = [].concat(codeMap[d] || []); const nm = nms.find(n => t.codes[n]); if (!nm) return null; const c = t.codes[nm]; return c.name && c.name !== c.short && d !== 'floor' && d !== 'zone' ? c.name : c.short; };
  for (const t of T) {
    const segs = (M.wbs[t.wbs] && M.wbs[t.wbs].path) || [], o = { t, stage: E.structStage(t, segs, sc.stageRules), b: null, u: null, z: null, f: null, tr: null, s: {} };
    // building
    let v = fromCode(t, 'building'), s = v ? 'code' : null; if (v) { const m = String(v).match(bnRx); if (m && m[0].length >= String(v).trim().length - 1) v = m[1] ? E.structBuildingLabel(m[1], m[2]) : E.structBuildingLabel('Building', m[3]); }
    if (!v) for (const sg of segs) { const m = String(sg).trim().match(R.bldgSeg); if (m) { v = E.structBuildingLabel(m[1], m[2]); s = 'wbs'; } }
    if (!v) { const m = t.name.match(bnRx); if (m) { v = m[1] ? E.structBuildingLabel(m[1], m[2]) : E.structBuildingLabel('Building', m[3]); s = 'name'; } }
    o.b = v || null; o.s.b = s; inc('building', s || 'none');
    // package / area / stage
    v = fromCode(t, 'unit'); s = v ? 'code' : null; if (v) v = String(v).trim();
    if (!v) { const parts = []; for (let si = 0; si < segs.length; si++) { const sg = segs[si]; if (skipRx && si > 0 && skipRx.test(String(segs[si - 1]))) continue; const m = String(sg).trim().match(unitRx); if (m) parts.push(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + ' ' + m[2].toUpperCase()); } if (parts.length) { v = parts.join(' \u00b7 '); s = 'wbs'; } }
    o.u = v || null; o.s.u = s; inc('unit', s || 'none'); o.loc = [o.u, o.b].filter(Boolean).join(' \u00b7 ') || null;
    // zone
    v = fromCode(t, 'zone'); s = v ? 'code' : null; if (v) v = 'Zone ' + String(v).replace(/^zone\s*/i, '').replace(/^0+(?=\d)/, '');
    if (!v) for (const sg of segs) { const m = String(sg).trim().match(R.zoneSeg); if (m) { v = 'Zone ' + m[1].toUpperCase().replace(/^0+(?=\d)/, ''); s = 'wbs'; } }
    if (!v) { const m = t.name.match(R.zoneName); if (m) { v = 'Zone ' + (m[1] || m[2]).toUpperCase().replace(/^0+(?=\d)/, ''); s = 'name'; } }
    o.z = v || null; o.s.z = s; inc('zone', s || 'none');
    // floor
    v = fromCode(t, 'floor'); let fl = v ? E.normFloor(v, sc.floorStrict !== false) : null; s = fl ? 'code' : null;
    if (!fl) for (const sg of segs) { const m = String(sg).trim().match(R.floorSeg); if (m) { fl = E.normFloor(m[1] || m[2], true); if (fl) s = 'wbs'; } }
    if (!fl) { const m = t.name.match(R.floorName); if (m) { fl = E.normFloor(m[1] || m[2] || m[3] || m[4], true); if (fl) s = 'name'; } }
    o.f = fl; o.s.f = s; inc('floor', s || 'none');
    // contractor / vendor
    v = fromCode(t, 'contractor'); o.c = v ? String(v).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim() : null; if (o.c) { const al = aliasMap.get(o.c.toLowerCase()) || aliasMap.get(o.c.replace(/\s*\(.*$/, '').toLowerCase()); if (al) o.c = al; } inc('contractor', o.c ? 'code' : 'none');
    // trade
    v = fromCode(t, 'trade'); s = v ? 'code' : null;
    if (!v) { const txt = t.name + ' | ' + segs.slice(-2).join(' | '); for (const [n, rx] of rules) if (rx.test(t.name)) { v = n; s = 'keywords'; break; } if (!v) for (const [n, rx] of rules) if (rx.test(txt)) { v = n; s = 'keywords'; break; } }
    o.tr = v || 'Other'; o.s.tr = s || 'none'; inc('trade', s || 'none');
    o.a = day(t); o.e = dayE(t); rows.push(o);
  }
  const byId = new Map(rows.map(o => [o.t.id, o]));
  const res = { M, rows, codeMap, n: rows.length, srcCount };
  const dist = (k, label) => { const m = new Map(); for (const o of rows) { const v = k === 'f' ? (o.f && o.f.label) : o[k]; if (!v) continue; let x = m.get(v); if (!x) m.set(v, x = { v, n: 0, a: Infinity, e: -Infinity, ord: k === 'f' ? o.f.ord : 0 }); x.n++; if (o.a != null && o.a < x.a) x.a = o.a; if (o.e != null && o.e > x.e) x.e = o.e; } return [...m.values()].sort((p, q) => k === 'f' ? p.ord - q.ord : (k === 'tr' ? p.a - q.a : (p.v < q.v ? -1 : 1))); };
  res.vals = { building: dist('b'), unit: dist('u'), zone: dist('z'), floor: dist('f'), trade: dist('tr'), contractor: dist('c') };
  const zl = res.vals.zone.map(x => x.v.replace(/^Zone /, '')); res.zoneSuggestSystem = zl.length >= 4 && zl.filter(x => /^[A-Za-z]{2,}$/.test(x)).length / zl.length >= 0.6; res.zoneSystem = sc.zoneSystem == null ? res.zoneSuggestSystem : !!sc.zoneSystem; res.floorStrict = sc.floorStrict !== false;
  // stages
  const st = new Map(); for (const o of rows) { let x = st.get(o.stage); if (!x) st.set(o.stage, x = { v: o.stage, n: 0, a: Infinity, e: -Infinity }); x.n++; if (o.a != null && o.a < x.a) x.a = o.a; if (o.e != null && o.e > x.e) x.e = o.e; }
  const ORDER = ['mobilization', 'engineering', 'procurement', 'delivery', 'construction', 'closeout', 'general']; res.stages = [...st.values()].sort((p, q) => ORDER.indexOf(p.v) - ORDER.indexOf(q.v));
  res.span = [Math.min(...rows.map(o => o.a).filter(x => x != null)), Math.max(...rows.map(o => o.e).filter(x => x != null))];
  // grids: building x floor (construction), and building+zone x floor
  const mkGrid = (keyFn) => { const g = new Map(); for (const o of rows) { if (o.stage !== 'construction' || !o.f) continue; const k = keyFn(o); if (!k) continue; let r = g.get(k); if (!r) g.set(k, r = { k, cells: new Map() }); let c = r.cells.get(o.f.label); if (!c) r.cells.set(o.f.label, c = { n: 0, a: Infinity, e: -Infinity, trades: new Set() }); c.n++; c.trades.add(o.tr); if (o.a != null && o.a < c.a) c.a = o.a; if (o.e != null && o.e > c.e) c.e = o.e; } return [...g.values()].sort((p, q) => p.k < q.k ? -1 : 1); };
  res.gridB = mkGrid(o => o.loc || '(no building)'); res.gridBZ = res.zoneSystem ? [] : mkGrid(o => o.z ? (o.loc || '(no building)') + ' · ' + o.z : null);
  // stage lanes per package (building / plot / area / stage)
  const pk = new Map(); for (const o of rows) { if (!o.loc && !o.b) continue; const k = o.u || o.b; let r = pk.get(k); if (!r) pk.set(k, r = { k, st: {} }); let c = r.st[o.stage]; if (!c) c = r.st[o.stage] = { n: 0, a: Infinity, e: -Infinity }; c.n++; if (o.a != null && o.a < c.a) c.a = o.a; if (o.e != null && o.e > c.e) c.e = o.e; }
  res.pkgLanes = [...pk.values()].map(r => { const g = x => r.st[x] && r.st[x].a < Infinity ? r.st[x] : null, en = g('engineering'), pr = g('procurement'), co = g('construction'), cl = g('closeout'); r.ovEP = en && pr ? en.e - pr.a : null; r.ovPC = pr && co ? pr.e - co.a : null; r.ovEC = en && co ? en.e - co.a : null; r.ovCC = co && cl ? co.e - cl.a : null; r.cs = co ? co.a : Infinity; return r; }).filter(r => Object.keys(r.st).length).sort((p, q) => p.cs - q.cs);
  // link scope and trade matrix
  const scope = { sameFloor: 0, crossFloor: 0, crossZone: 0, crossBuilding: 0, unknown: 0, sharedToLocation: 0 }, mx = new Map(), tin = new Map(), tout = new Map();
  for (const l of M.links) { const a = byId.get(l.from.id), b = byId.get(l.to.id); if (!a || !b) continue;
    const la = a.loc || (a.f ? '(no building)' : null), lb = b.loc || (b.f ? '(no building)' : null);
    if (!la && lb) scope.sharedToLocation++; else if (!la || !lb) scope.unknown++; else if (la !== lb) scope.crossBuilding++; else if (a.f && b.f && a.f.label !== b.f.label) scope.crossFloor++; else if (!res.zoneSystem && a.z && b.z && a.z !== b.z) scope.crossZone++; else scope.sameFloor++;
    const k = a.tr + '\u0001' + b.tr; let x = mx.get(k); if (!x) mx.set(k, x = { a: a.tr, b: b.tr, n: 0, FS: 0, SS: 0, FF: 0, SF: 0, lag: 0 }); x.n++; x[l.type] = (x[l.type] || 0) + 1; x.lag += l.lagWd || 0;
    tout.set(a.tr, (tout.get(a.tr) || 0) + 1); tin.set(b.tr, (tin.get(b.tr) || 0) + 1); }
  res.scope = scope; res.matrix = [...mx.values()]; res.tin = tin; res.tout = tout;
  return res;
};
