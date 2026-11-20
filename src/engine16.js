/* ===== ENGINE PART 16 (v8.0): delay train — where the delay entered the driving chain, and which levers ahead win time back =====
   The chain is traced back from the target through completed work (actual dates) to the start, so the origin of the delay is found even when it
   happened months before the data date. Slip = current finish − baseline finish (calendar days), by activity ID. Levers are tested with E.recalc. */
E.TRAIN_DEFAULTS = { originMin: 5, maxCars: 10, startAtPct: 50, lagMin: 10, lagTo: 7, crewPct: 30, minRemWd: 5, overlapMinWd: 10, twins: true, userHard: [], authBodies: 'ECZA|MOI|civil defen|SEC|NWC|STC|municipal|baladi|DRC|MODON|royal commission', lagKeepWords: 'cur(e|ing)|pour|cast|concret|approv|review|submit|deliver|procure|fabricat|test|inspect|settl|dry', crewTrades: [['formwork|shutter', 30], ['rebar|reinforc|steel fix', 30], ['block|masonry|plaster|paint|til(e|ing)|gypsum|ceiling', 30], ['conduit|duct|pipe|cable|wiring|hvac|plumb|electr|fire fight|mep', 25], ['excavat|backfill|earthwork', 35]], authWords: 'ECZA|MOI|site visit|certificate|permit|occupan|power on|as-?built|civil defen|inspector|snag|authority|approv|NOC' };
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
  /* v8.5: o.chain = a path already traced by the Delay analysis (paths 2 and 3 stop where they join a higher path; o.joins = that shared activity, whose slip is carried in) */
  const chain = [], seen = new Set(), oos = new Set(); let t = o.chain && o.chain.length ? null : target;
  while (t && !seen.has(t.id) && chain.length < 3000) {
    seen.add(t.id); chain.push(t); let nx = null;
    if (t.as == null) { let d = []; try { d = E.dlDrivers(B, t) || []; } catch (e) { d = []; } const z = d.filter(x => x.gap != null && x.gap <= 0.01 && !seen.has(x.from.id)).map(x => x.from); if (z.length) nx = z.sort((x, y) => y.ef - x.ef)[0]; }
    if (!nx) { /* the as-built driver: the predecessor that released this activity last, up to its finish. Site work overlaps (rebar starts while the formwork is finishing), so a predecessor
         that finished after this activity STARTED still controlled its finish; v9.8 counts those (worked in overlap) instead of dropping them. */
      const lim = (t.ef != null ? t.ef : t.es != null ? t.es : Infinity) + 1; const c = t.pre.filter(l => !seen.has(l.from.id) && l.from.ef != null && cons(l) <= lim).sort((x, y) => cons(y) - cons(x)); nx = c.length ? c[0].from : null;
      if (nx && t.as != null && t.es != null && (c[0].type === 'FS' || c[0].type === 'SS') && cons(c[0]) > t.es) oos.add(t.id); }
    t = nx;
  }
  if (o.chain && o.chain.length) chain.push(...o.chain); else chain.reverse();
  /* 2. slip per activity and the delay each one added */
  let prev = 0; if (o.joins) { const ja = aBy.get(o.joins.code); if (ja && ja.ef != null && o.joins.ef != null) prev = Math.round(o.joins.ef - ja.ef); } const rows = chain.map(t => { const a = aBy.get(t.code), slip = a && a.ef != null && t.ef != null ? Math.round(t.ef - a.ef) : null, s = slip == null ? prev : slip, own = s - prev; prev = s;
    return { t, a, oos: oos.has(t.id), code: t.code, name: t.name, status: t.status, slip: s, isNew: !a, own, pDur: a && a.ef != null && a.es != null ? Math.round(a.ef - a.es) : null, cDur: t.ef != null && t.es != null ? Math.round(t.ef - t.es) : null }; });
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
  return { cfg, target: { code: target.code, name: target.name, fA: tA ? tA.ef : null, fB: target.ef, slip: tA ? Math.round(target.ef - tA.ef) : null }, rows: R, origin, cars, oos: R.filter(r => r.oos).length,
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
  const base = E.recalc(B, { raw }), out = [], blocked = [];
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
  const lagKeep = rx(cfg.lagKeepWords, /(?!)/), bodies = rx(cfg.authBodies, /(?!)/), bodyOf = nm => { const m = bodies.exec(nm); return m ? m[0].toLowerCase() : ''; };
  const trades = (cfg.crewTrades || []).map(([w, q]) => { try { return [new RegExp(w, 'i'), Math.max(0, Math.min(60, +q || 0))]; } catch (e) { return null; } }).filter(Boolean), crewPctOf = nm => { for (const [r, q] of trades) if (r.test(nm)) return q; return Math.max(0, Math.min(60, +cfg.crewPct || 0)); };
  const note = (ch, ok, why, l) => { ch.why = ch.why || { ok: {}, no: {}, map: new Map() }; const k = why.split(':')[0], b = ok ? ch.why.ok : ch.why.no; b[k] = (b[k] || 0) + 1; ch.why.map.set(l, why); };
  const run = ch => { const r = E.recalc(B, { raw, rem: ch.rem, links: ch.links }); return Math.round(base.finish - r.finish); };
  for (const c of train.cars) {
    if (c.phase !== 'next' && c.phase !== 'now') continue;
    const own = c.rows.map(r => r.t).filter(t => t.status !== 'TK_Complete');
    const scopes = [['car', new Set(own.map(t => t.id))]];
    if (cfg.twins) { const s = new Set(); for (const t of own) for (const x of (byKey.get(twinKey(t)) || [t])) s.add(x.id); if (s.size > own.length) scopes.unshift(['twins', s]); }
    const mk = (kind, inS) => { const ch = { rem: new Map(), links: new Map(), n: 0, pcts: new Set() };
      for (const t of B.tasks) { if (!inS.has(t.id)) continue;
        if (kind === 'crew' && !t.isMile && !hold.test(t.name)) { const r = remOf(t); const q = crewPctOf(t.name); if (r >= cfg.minRemWd && q > 0) { ch.rem.set(t.id, r * (1 - q / 100)); ch.pcts.add(q); ch.n++; } }
        for (const l of t.pre) { if (!inS.has(l.from.id) || l.from.status === 'TK_Complete') continue; const ph = hold.test(l.from.name) || hold.test(t.name);
          if (kind === 'overlap' && !ph && l.type === 'FS' && !l.from.isMile && !t.isMile) { const pr = remOf(l.from); const [ok, why] = canOverlap(l.from, t, pr); ch.why = ch.why || { ok: {}, no: {}, map: new Map() }; (ok ? ch.why.ok : ch.why.no)[why.split(':')[0]] = ((ok ? ch.why.ok : ch.why.no)[why.split(':')[0]] || 0) + 1; ch.why.map.set(l, why); if (ok) { ch.links.set(l, [{ type: 'SS', lagWd: Math.max(0, Math.ceil(pr * cfg.startAtPct / 100)) }, { type: 'FF', lagWd: Math.max(1, Math.ceil(remOf(t) * 0.2)) }]); ch.n++; } }
          /* v9.8: a lag is only cut when nothing says why it is there (curing, review period, delivery, test); approvals run in parallel only between different authorities or different places */
          if (kind === 'lag' && (l.lagWd || 0) >= cfg.lagMin) { const m = lagKeep.exec(l.from.name) || lagKeep.exec(t.name), why = m ? 'kept, lag has a reason: ' + m[0].toLowerCase() : 'no stated reason'; note(ch, !m, why, l); if (!m) { ch.links.set(l, [{ type: l.type, lagWd: Math.min(l.lagWd, cfg.lagTo) }]); ch.n++; } }
          if (kind === 'parallel' && auth.test(l.from.name) && auth.test(t.name) && l.type === 'FS') { const ba = bodyOf(l.from.name), bb = bodyOf(t.name), w = where(l.from, t), ok = (ba && bb && ba !== bb) || w === 'diff', why = ba && bb && ba !== bb ? 'different authorities' : w === 'diff' ? 'different area' : 'same authority and place: sequential by nature'; note(ch, ok, why, l); if (ok) { ch.links.set(l, [{ type: 'SS', lagWd: 2 }]); ch.n++; } } } }
      if (kind === 'crew' && ch.pcts.size) { const v = [...ch.pcts].sort((x, y) => x - y), lo = v[0], hi = v[v.length - 1], ex = q => Math.round(q / (100 - q) * 100), rg = (x, y, f) => x === y ? f(x) : f(x) + ' to ' + f(y);
        ch.how = 'Remaining durations ' + rg(lo, hi, q => '−' + q + '%') + (v.length > 1 ? ' by trade' : '') + ' (not approvals, curing, tests); the same work in less time needs about ' + rg(lo, hi, q => '+' + ex(q) + '%') + ' crew'; ch.effect = '−' + hi + '% time, +' + ex(hi) + '% crew'; }
      return ch; };
    for (const [kind, label, how] of [['overlap', 'Overlap the trades', 'Start each activity when its predecessor is ' + cfg.startAtPct + '% done'], ['lag', 'Shorten long lags', 'Lags of ' + cfg.lagMin + ' working days or more cut to ' + cfg.lagTo], ['crew', 'Extra crew or second shift', 'Remaining durations −' + cfg.crewPct + '% (not approvals, curing, tests)'], ['parallel', 'Run approvals and authority steps in parallel', 'Start each when the previous one starts + 2 days']]) {
      let first = null;
      for (const [sc, set] of scopes) { const ch = mk(kind, set); if (!ch.n && !(ch.why && sc === scopes[0][0])) continue; const g = ch.n ? run(ch) : 0;
        const lv = { why: ch.why || null, car: c.idx, kind, label, how: ch.how || how, effect: ch.effect || '', blocked: !ch.n, who: kind === 'parallel' ? 'Needs the authority / employer' : 'Contractor', scope: sc, n: ch.n, copies: sc === 'twins' ? Math.round(set.size / Math.max(1, own.length)) : 1, gain: g, ch };
        if (lv.blocked) { blocked.push(lv); break; } if (!first) { first = lv; out.push(lv); } else first.gainCarOnly = g; }
    }
  }
  return { base: base.finish, levers: out, blocked };
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

/* v9.8: paths ranked by float RELATIVE TO THE TARGET (the P6 "multiple float paths" idea): path 1 is the driving path; the next path is the chain feeding an
   already-found path through the link with the smallest gap, so its relative float = working days it can slip before it drives the target.
   Branches that repeat the trades of a path already found (the same sequence in another zone, floor or plot) are folded into it as copies. */
E.dlPathsRel = function (M, target, n) {
  const done = t => t.status === 'TK_Complete', skip = t => t.type === 'TT_LOE' || t.type === 'TT_WBS';
  const wpath = id => { const p = []; let w = M.wbs[id]; while (w) { p.unshift(w); w = w.parent ? M.wbs[w.parent] : null; } return p; };
  const remain = ch => ch.filter(t => !done(t)), sigOf = ch => new Set(remain(ch).filter(t => !t.isMile).map(t => E.trainNorm(t.name)).filter(Boolean));
  const label = ch => { const r = remain(ch); try { return r.length ? E._trainTitle(r.map(t => wpath(t.wbs))) : ''; } catch (e) { return ''; } };
  const paths = [], used = new Set(), cand = [];
  const take = (chain, r) => { for (const t of chain) used.add(t.id);
    for (const a of chain) { if (done(a)) continue; let ds = []; try { ds = E.dlDrivers(M, a) || []; } catch (e) { ds = []; } for (const d of ds) { const p = d.from; if (done(p) || skip(p) || used.has(p.id) || d.gap == null) continue; cand.push({ p, into: a, rel: r + Math.max(0, d.gap) }); } } };
  const p1 = E.dlTrace(M, target, null); paths.push(Object.assign({ rank: 1, end: target, rel: 0, into: null, copies: [], sig: sigOf(p1.chain), label: label(p1.chain) }, p1)); take(p1.chain, 0);
  let tries = 0;
  while (paths.length < n && cand.length && tries++ < 2500) {
    let bi = 0; for (let i = 1; i < cand.length; i++) if (cand[i].rel < cand[bi].rel || (cand[i].rel === cand[bi].rel && (cand[i].p.ef || 0) > (cand[bi].p.ef || 0))) bi = i;
    const c = cand.splice(bi, 1)[0]; if (used.has(c.p.id)) continue;
    const tr = E.dlTrace(M, c.p, used), sg = sigOf(tr.chain), rem = remain(tr.chain).length; take(tr.chain, c.rel);
    if (!sg.size) continue;
    const twin = paths.find(q => { let k = 0; for (const x of sg) if (q.sig.has(x)) k++; return k / sg.size >= 0.8; });
    if (twin) { twin.copies.push({ label: label(tr.chain), n: rem, rel: c.rel, code: c.p.code }); continue; }
    if (rem < 3) continue;
    paths.push(Object.assign({ rank: paths.length + 1, end: c.p, rel: c.rel, into: c.into, copies: [], sig: sg, label: label(tr.chain) }, tr));
  }
  paths.forEach((p, i) => { const v = p.chain.filter(t => !done(t) && t.tfWd != null).map(t => t.tfWd); p.tf = v.length ? Math.min(...v) : 0; if (i === 0) p.tf = Math.min(p.tf, 0); });
  return paths;
};
