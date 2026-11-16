/* ===== ENGINE PART 16 (v8.0): delay train — where the delay entered the driving chain, and which levers ahead win time back =====
   The chain is traced back from the target through completed work (actual dates) to the start, so the origin of the delay is found even when it
   happened months before the data date. Slip = current finish − baseline finish (calendar days), by activity ID. Levers are tested with E.recalc. */
E.TRAIN_DEFAULTS = { originMin: 5, maxCars: 10, startAtPct: 50, lagMin: 10, lagTo: 7, crewPct: 30, minRemWd: 5, overlapMinWd: 10, twins: true, userHard: [], authWords: 'ECZA|MOI|site visit|certificate|permit|occupan|power on|as-?built|civil defen|inspector|snag|authority|approv|NOC' };
/* car title: the WBS the car shares; when it spans several branches, the branch most of its activities sit in, plus "+ n more" */
E._trainTitle = function (ps) {
  const common = arr => { let k = 0; while (arr.every(p => p[k] && p[k] === arr[0][k])) k++; return k; };
  let cur = ps, extra = 0, range = '';
  for (let g = 0; g < 6; g++) { const k = common(cur); if (cur.length === 1 || cur.every(p => p.length <= k)) break; const b = new Map(); for (const p of cur) { const key = p[k] ? p[k].id : ''; if (!b.has(key)) b.set(key, []); b.get(key).push(p); } if (b.size === 1) break;
    const big = [...b.values()].sort((x, y) => y.length - x.length)[0]; if (big.length < cur.length * 0.6) { const f = cur[0][k], l = cur[cur.length - 1][k]; if (f && l && f !== l) range = f.name + ' → ' + l.name; break; } extra += cur.length - big.length; cur = big; }
  const k = common(cur), names = cur[0].slice(1, k).map(w => w.name);
  return (range ? (names.slice(-1)[0] ? names.slice(-1)[0] + ': ' : '') + range : (names.slice(-3).join(' · ') || (cur[0][cur[0].length - 1] || {}).name || '')) + (extra ? ' (+' + extra + ' other)' : '');
};
E.delayTrain = function (A, B, o) {
  o = o || {}; const cfg = Object.assign({}, E.TRAIN_DEFAULTS, o.cfg || {}), aBy = new Map(A.tasks.map(t => [t.code, t]));
  const target = (o.targetCode && B.tasks.find(t => t.code === o.targetCode)) || B.tasks.filter(t => t.ef != null).sort((x, y) => y.ef - x.ef)[0];
  if (!target) return null;
  /* 1. walk back. Not finished: the driving link (zero gap). Finished or started: the predecessor that released it last, ignoring predecessors
        that finished after this activity had already finished (out-of-sequence progress does not drive). */
  const cons = (l) => { const p = l.from, lag = (l.lagCal || 0); return (l.type === 'SS' || l.type === 'SF' ? p.es : p.ef) + lag; };
  const chain = [], seen = new Set(); let t = target;
  while (t && !seen.has(t.id) && chain.length < 3000) {
    seen.add(t.id); chain.push(t); let nx = null;
    if (t.as == null) { let d = []; try { d = E.dlDrivers(B, t) || []; } catch (e) { d = []; } const z = d.filter(x => x.gap != null && x.gap <= 0.01 && !seen.has(x.from.id)).map(x => x.from); if (z.length) nx = z.sort((x, y) => y.ef - x.ef)[0]; }
    if (!nx) { const lim = (t.ef != null ? t.ef : t.es != null ? t.es : Infinity) + 1; const c = t.pre.filter(l => !seen.has(l.from.id) && l.from.ef != null && cons(l) <= lim).sort((x, y) => cons(y) - cons(x)); nx = c.length ? c[0].from : null; }
    t = nx;
  }
  chain.reverse();
  /* 2. slip per activity and the delay each one added */
  let prev = 0; const rows = chain.map(t => { const a = aBy.get(t.code), slip = a && a.ef != null && t.ef != null ? Math.round(t.ef - a.ef) : null, s = slip == null ? prev : slip, own = s - prev; prev = s;
    return { t, a, code: t.code, name: t.name, status: t.status, slip: s, isNew: !a, own, pDur: a && a.ef != null && a.es != null ? Math.round(a.ef - a.es) : null, cDur: t.ef != null && t.es != null ? Math.round(t.ef - t.es) : null }; });
  const oi = rows.findIndex(r => r.own >= cfg.originMin);
  let st = 0; if (oi > 0) { for (let i = oi - 1; i >= 0; i--) if (Math.abs(rows[i].slip) <= 1) { st = i; break; } }
  const R = rows.slice(st), origin = oi >= 0 ? R[oi - st] : null;
  /* 3. cars: consecutive activities in the same phase and the same WBS parent, merged down to maxCars */
  const phase = r => r.t === target ? 'end' : r.status === 'TK_Complete' ? 'done' : r.status === 'TK_Active' ? 'now' : 'next';
  const wpath = id => { const p = []; let w = B.wbs[id]; while (w) { p.unshift(w); w = w.parent ? B.wbs[w.parent] : null; } return p; };
  const paths = new Map(R.map(r => [r, wpath(r.t.wbs)])), maxD = Math.max(1, ...[...paths.values()].map(p => p.length));
  /* each phase (done / in progress / to come) gets its own share of cars; within it, the deepest WBS level that fits the share */
  const segs = []; for (const r of R) { const ph = phase(r), l = segs[segs.length - 1]; if (l && l.ph === ph) l.rows.push(r); else segs.push({ ph, rows: [r] }); }
  const fixed = segs.filter(x => x.ph === 'end' || x.ph === 'now').length, flex = segs.filter(x => x.ph === 'done' || x.ph === 'next'), budget = Math.max(flex.length, cfg.maxCars - fixed);
  const wRows = flex.reduce((a, x) => a + x.rows.length, 0) || 1, wChg = flex.reduce((a, x) => a + x.rows.reduce((b, r) => b + Math.abs(r.own), 0), 0) || 1;
  const share = sg => sg.ph === 'end' || sg.ph === 'now' ? 1 : Math.max(2, Math.round(budget * (0.5 * sg.rows.length / wRows + 0.5 * sg.rows.reduce((b, r) => b + Math.abs(r.own), 0) / wChg)));
  const groupRows = (rows, d) => { const cs = []; for (const r of rows) { const p = paths.get(r), k = (p[Math.min(d, p.length - 1)] || {}).id, last = cs[cs.length - 1]; if (last && last.key === k) last.rows.push(r); else cs.push({ key: k, rows: [r] }); } return cs; };
  const absd = c => Math.abs(c.rows[c.rows.length - 1].slip - c.rows[0].slip + c.rows[0].own);
  let cars = [];
  for (const sg of segs) { const n = share(sg); let cs = null;
    if (sg.ph === 'end' || sg.ph === 'now') cs = [{ rows: sg.rows }];
    else { for (let d = maxD - 1; d >= 1; d--) { const g = groupRows(sg.rows, d); if (g.length <= 2 * n) { cs = g; break; } } if (!cs) cs = groupRows(sg.rows, 1);
      /* single quiet activities (a milestone, one as-built) join their neighbour; then merge the quietest neighbours down to the share */
      for (let i = cs.length - 1; i > 0; i--) if (cs[i].rows.length === 1 && absd(cs[i]) <= 1) { cs[i - 1].rows.push(...cs[i].rows); cs.splice(i, 1); }
      if (cs.length > 1 && cs[0].rows.length === 1 && absd(cs[0]) <= 1) { cs[1].rows.unshift(...cs[0].rows); cs.shift(); }
      while (cs.length > n) { let bi = 0, bv = Infinity; for (let i = 0; i < cs.length - 1; i++) { const v = absd(cs[i]) + absd(cs[i + 1]); if (v < bv) { bv = v; bi = i; } } cs[bi].rows.push(...cs[bi + 1].rows); cs.splice(bi + 1, 1); }
      /* too coarse (one car for a long segment)? split at the largest changes in slip */
      if (cs.length < n && sg.rows.length > 2 * n) { const cut = sg.rows.map((r, i) => [i, Math.abs(r.own)]).filter(x => x[0] > 0).sort((x, y) => y[1] - x[1]).slice(0, n - 1).filter(x => x[1] >= 1).map(x => x[0]).sort((x, y) => x - y);
        if (cut.length >= cs.length) { cs = []; let st = 0; for (const c of cut.concat([sg.rows.length])) { if (c > st) cs.push({ rows: sg.rows.slice(st, c) }); st = c; } } } }
    for (const c of cs) cars.push({ phase: sg.ph, rows: c.rows }); }
  let before = R.length ? R[0].slip - R[0].own : 0;
  cars = cars.map((c, i) => { const ps = c.rows.map(r => wpath(r.t.wbs)); let k = 0; while (ps.every(p => p[k] && p[k] === ps[0][k])) k++; const com = ps[0].slice(1, k).map(w => w.name);
    const end = c.rows[c.rows.length - 1].slip, delta = end - before; before = end; const top = c.rows.slice().sort((x, y) => y.own - x.own)[0];
    return { idx: i, phase: c.phase, rows: c.rows, title: E._trainTitle(ps), first: c.rows[0].name, last: c.rows[c.rows.length - 1].name, slip: end, delta, n: c.rows.length, isOrigin: !!(origin && c.rows.includes(origin)), top,
      from: c.rows[0].t.es, to: c.rows[c.rows.length - 1].t.ef }; });
  const tA = aBy.get(target.code);
  return { cfg, target: { code: target.code, name: target.name, fA: tA ? tA.ef : null, fB: target.ef, slip: tA ? Math.round(target.ef - tA.ef) : null }, rows: R, origin, cars,
    added: cars.filter(c => c.phase === 'done' || c.phase === 'now').reduce((s, c) => s + Math.max(0, c.delta), 0), recovered: cars.filter(c => c.phase === 'done' || c.phase === 'now').reduce((s, c) => s + Math.min(0, c.delta), 0) };
};
/* Levers for the cars still to come. Each lever is a set of changes for E.recalc; "twins" = the same activity (same name and WBS leaf) elsewhere, e.g. identical plots. */
/* v8.2: pairs that are physical constraints — the successor needs the predecessor complete in the same place. Never overlapped. Editable in settings. */
E.TRAIN_HARD = [
  ['formwork|shuttering(?! closure)|one side shutter', 'rebar|reinforc', 'Formwork → rebar'],
  ['rebar|reinforc', 'pour|cast|concret', 'Rebar → pour'],
  ['shuttering closure|closing shutter', 'pour|cast|concret', 'Shuttering closure → pour'],
  ['post.?tension', 'pour|cast|concret', 'Post-tensioning → pour'],
  ['pour|cast|concret', 'de-?shutter|strip|remov.*form', 'Pour → de-shuttering (curing)'],
  ['drain|pipe|plumb|water supply|cold.*hot|sleeve', 'waterproof', 'Pipes / drainage → waterproofing'],
  ['waterproof', 'flood|screed|tile|tiling|porcelain|ceramic|floor finish', 'Waterproofing → flood test / screed / tiles'],
  ['pressure test|leak(?:age)? test|testing', 'ceiling|gypsum|closing', 'Tests → ceiling closing'],
  ['conduit|first fix|rough.?in|embedded', 'plaster|render', 'Conduits / first fix → plaster'],
  ['plaster|render', 'waterproof', 'Plaster → waterproofing'],
  ['plaster|putty', 'paint|primer', 'Plaster → paint'],
  ['floor drain', 'floor finish|porcelain|tile|tiling', 'Floor drain → floor finishes'],
  ['ceiling|gypsum', 'final coat|paint.*final|final paint', 'Ceiling → final paint']
];
E.trainNorm = n => String(n || '').toLowerCase().replace(/\b(?:\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|ground|basement|roof|ph|penthouse|floor|level|zone|plot|area|all|[a-z])\b/g, ' ').replace(/[^a-z&]+/g, ' ').trim();
E.trainLevers = function (B, train, o) {
  o = o || {}; const cfg = train.cfg, raw = o.raw, rx = (w, d) => { try { return w ? new RegExp(w, 'i') : d; } catch (e) { return d; } }, hold0 = rx(o.holdWords || E.DELAY_DEFAULTS.holdWords, /approv|authority|permit|inspect|test|cure|curing/i), auth = rx(cfg.authWords, /(?!)/), hold = { test: s => hold0.test(s) || auth.test(s) };
  const remOf = t => { const r = raw && raw.get(t.code); if (r) { const h = parseFloat(r.remain_drtn_hr_cnt); if (!isNaN(h)) return h / ((B.cal[t.clndr] || {}).dayHr || 8); } return t.remWd != null ? t.remWd : (t.durWd || 0); };
  const leaf = t => (B.wbs[t.wbs] || {}).name || '', twinKey = t => t.name + '\u0001' + leaf(t), byKey = new Map();
  for (const t of B.tasks) if (t.status !== 'TK_Complete') { const k = twinKey(t); let l = byKey.get(k); if (!l) byKey.set(k, l = []); l.push(t); }
  const base = E.recalc(B, { raw }), out = [];
  /* overlap checks: physical-constraint pairs, the sequence rules marked "no overlap", same place vs different place, the contractor's own precedent */
  const hardL = (cfg.hardPairs || E.TRAIN_HARD).map(([a, b, n]) => { try { return [new RegExp(a, 'i'), new RegExp(b, 'i'), n]; } catch (e) { return null; } }).filter(Boolean);
  const userHard = new Set((cfg.userHard || []).map(x => x[0] + '\u2192' + x[1]));
  const steps = E.seqSteps ? E.seqSteps(o.seqCfg || {}) : [], rules = E.seqRules ? E.seqRules(o.seqCfg || {}) : [], stepOf = nm => { for (const [k, , rx] of steps) if (rx.test(nm)) return k; return null; };
  let loc = null; try { const st = E.structure(B, Object.assign(E.defaultCfg(), o.seqCfg || {})); loc = new Map(st.rows.map(r => [r.t.id, r])); } catch (e) { loc = null; }
  const prec = new Map(); for (const t of B.tasks) for (const l of t.pre) if (l.type === 'SS' || (l.type === 'FS' && (l.lagWd || 0) < 0)) { const k = E.trainNorm(l.from.name) + '\u2192' + E.trainNorm(t.name); prec.set(k, (prec.get(k) || 0) + 1); }
  const where = (a, b) => { if (a.wbs === b.wbs) return 'same'; const x = loc && loc.get(a.id), y = loc && loc.get(b.id); if (!x || !y) return 'unknown'; const v = q => q && typeof q === 'object' ? q.label : q; for (const k of ['b', 'f', 'z']) if (v(x[k]) && v(y[k]) && v(x[k]) !== v(y[k])) return 'diff'; return (x.f && y.f) || (x.z && y.z) ? 'same' : 'unknown'; };
  const canOverlap = (p, t, pr) => { const k = E.trainNorm(p.name) + '\u2192' + E.trainNorm(t.name);
    if (userHard.has(k)) return [false, 'marked never-overlap by you'];
    for (const [a, b, n] of hardL) if (a.test(p.name) && b.test(t.name)) return [false, 'physical constraint: ' + n];
    const sa = stepOf(p.name), sb = stepOf(t.name), rule = rules.find(r => r.on !== false && r.mode === 'fs' && sa && sb && r.pred.includes(sa) && r.succ.includes(sb)); if (rule) return [false, 'sequence rule ' + rule.id + ': ' + rule.title];
    if (pr < cfg.overlapMinWd) return [false, 'too short to split (' + Math.round(pr) + ' wd < ' + cfg.overlapMinWd + ')'];
    const w = where(p, t); if (w === 'diff') return [true, 'different area'];
    if (prec.get(k)) return [true, 'precedent: linked SS ' + prec.get(k) + ' time' + (prec.get(k) === 1 ? '' : 's') + ' elsewhere'];
    if (pr >= 2 * cfg.overlapMinWd) return [true, 'long activity in the same area: start on finished parts (check)'];
    return [false, 'same area, no precedent']; };
  const run = ch => { const r = E.recalc(B, { raw, rem: ch.rem, links: ch.links }); return Math.round(base.finish - r.finish); };
  for (const c of train.cars) {
    if (c.phase !== 'next' && c.phase !== 'now') continue;
    const own = c.rows.map(r => r.t).filter(t => t.status !== 'TK_Complete');
    const scopes = [['car', new Set(own.map(t => t.id))]];
    if (cfg.twins) { const s = new Set(); for (const t of own) for (const x of (byKey.get(twinKey(t)) || [t])) s.add(x.id); if (s.size > own.length) scopes.unshift(['twins', s]); }
    const mk = (kind, inS) => { const ch = { rem: new Map(), links: new Map(), n: 0 };
      for (const t of B.tasks) { if (!inS.has(t.id)) continue;
        if (kind === 'crew' && !t.isMile && !hold.test(t.name)) { const r = remOf(t); if (r >= cfg.minRemWd) { ch.rem.set(t.id, r * (1 - cfg.crewPct / 100)); ch.n++; } }
        for (const l of t.pre) { if (!inS.has(l.from.id) || l.from.status === 'TK_Complete') continue; const ph = hold.test(l.from.name) || hold.test(t.name);
          if (kind === 'overlap' && !ph && l.type === 'FS' && !l.from.isMile && !t.isMile) { const pr = remOf(l.from); const [ok, why] = canOverlap(l.from, t, pr); ch.why = ch.why || { ok: {}, no: {}, map: new Map() }; (ok ? ch.why.ok : ch.why.no)[why.split(':')[0]] = ((ok ? ch.why.ok : ch.why.no)[why.split(':')[0]] || 0) + 1; ch.why.map.set(l, why); if (ok) { ch.links.set(l, [{ type: 'SS', lagWd: Math.max(0, Math.ceil(pr * cfg.startAtPct / 100)) }, { type: 'FF', lagWd: Math.max(1, Math.ceil(remOf(t) * 0.2)) }]); ch.n++; } }
          if (kind === 'lag' && (l.lagWd || 0) >= cfg.lagMin) { ch.links.set(l, [{ type: l.type, lagWd: Math.min(l.lagWd, cfg.lagTo) }]); ch.n++; }
          if (kind === 'parallel' && auth.test(l.from.name) && auth.test(t.name) && l.type === 'FS') { ch.links.set(l, [{ type: 'SS', lagWd: 2 }]); ch.n++; } } }
      return ch; };
    for (const [kind, label, how] of [['overlap', 'Overlap the trades', 'Start each activity when its predecessor is ' + cfg.startAtPct + '% done'], ['lag', 'Shorten long lags', 'Lags of ' + cfg.lagMin + ' working days or more cut to ' + cfg.lagTo], ['crew', 'Extra crew or second shift', 'Remaining durations −' + cfg.crewPct + '% (not approvals, curing, tests)'], ['parallel', 'Run approvals and authority steps in parallel', 'Start each when the previous one starts + 2 days']]) {
      let first = null;
      for (const [sc, set] of scopes) { const ch = mk(kind, set); if (!ch.n) continue; const g = run(ch);
        const lv = { why: ch.why || null, car: c.idx, kind, label, how, who: kind === 'parallel' ? 'Needs the authority / employer' : 'Contractor', scope: sc, n: ch.n, copies: sc === 'twins' ? Math.round(set.size / Math.max(1, own.length)) : 1, gain: g, ch };
        if (!first) { first = lv; out.push(lv); } else first.gainCarOnly = g; }
    }
  }
  return { base: base.finish, levers: out };
};
E.trainCombine = function (B, levers, o) {
  const rem = new Map(), links = new Map(); for (const lv of levers) { for (const [k, v] of lv.ch.rem) rem.set(k, Math.min(v, rem.has(k) ? rem.get(k) : Infinity)); for (const [k, v] of lv.ch.links) links.set(k, v); }
  const r0 = (o && o.r0) || E.recalc(B, { raw: o && o.raw }), r1 = levers.length ? E.recalc(B, { raw: o && o.raw, rem, links }) : r0; return { gain: Math.round(r0.finish - r1.finish), finish: r1.finish, r0, r1 };
};
/* what each switched-on lever adds when they are switched on one after another (for the waterfall) */
E.trainSequence = function (B, levers, o) {
  const r0 = (o && o.r0) || E.recalc(B, { raw: o && o.raw }), out = []; let prev = 0;
  for (let i = 0; i < levers.length; i++) { const g = E.trainCombine(B, levers.slice(0, i + 1), { r0, raw: o && o.raw }).gain; out.push({ lv: levers[i], marg: g - prev, cum: g }); prev = g; }
  return out;
};
/* real examples of what a lever changes: up to n consecutive links on the chain (or any changed links), or durations for crews */
E.leverExamples = function (train, lv, n) {
  n = n || 3; const c = train.cars[lv.car], ids = new Set(c.rows.map(r => r.t.id)), out = [];
  if (lv.kind === 'crew') { for (const r of c.rows) { if (lv.ch.rem.has(r.t.id)) out.push({ kind: 'dur', name: r.name, code: r.code, from: Math.round(r.t.remWd != null ? r.t.remWd : r.t.durWd || 0), to: Math.round(lv.ch.rem.get(r.t.id)) }); if (out.length >= n) break; }
    if (!out.length) for (const [id, v] of lv.ch.rem) { out.push({ kind: 'dur', id, to: Math.round(v) }); if (out.length >= n) break; } return out; }
  const lk = l => ({ why: lv.why && lv.why.map.get(l), nk: [E.trainNorm(l.from.name), E.trainNorm(l.to.name)], kind: 'link', pred: l.from.name, succ: l.to.name, pcode: l.from.code, scode: l.to.code, before: l.type + (l.lagWd ? '+' + Math.round(l.lagWd) : ''), after: lv.ch.links.get(l).map(x => x.type + (x.lagWd ? '+' + x.lagWd : '')).join(' & ') });
  for (let i = 1; i < c.rows.length && out.length < n; i++) { const l = c.rows[i].t.pre.find(x => x.from === c.rows[i - 1].t); if (l && lv.ch.links.has(l)) out.push(lk(l)); }
  if (out.length < n) for (const [l] of lv.ch.links) { if (out.length >= n) break; if (ids.has(l.to.id) && !out.some(x => x.pcode === l.from.code && x.scode === l.to.code)) out.push(lk(l)); }
  if (out.length < n) for (const [l] of lv.ch.links) { if (out.length >= n) break; if (!out.some(x => x.pcode === l.from.code && x.scode === l.to.code)) out.push(lk(l)); }
  return out;
};
