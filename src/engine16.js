/* ===== ENGINE PART 16 (v8.0): delay train — where the delay entered the driving chain, and which levers ahead win time back =====
   The chain is traced back from the target through completed work (actual dates) to the start, so the origin of the delay is found even when it
   happened months before the data date. Slip = current finish − baseline finish (calendar days), by activity ID. Levers are tested with E.recalc. */
E.TRAIN_DEFAULTS = { originMin: 5, maxCars: 10, startAtPct: 50, lagMin: 10, lagTo: 7, crewPct: 30, minRemWd: 5, overlapMinWd: 10, maxRounds: 6, noCrewWords: 'mobili[sz]|preliminar|overhead|site office|site facilit|site establish|management|supervision|insurance|temporary|hoarding|handing over|hand ?over', twins: true, userHard: [], authBodies: 'ECZA|MOI|civil defen|SEC|NWC|STC|municipal|baladi|DRC|MODON|royal commission', lagKeepWords: 'cur(e|ing)|pour|cast|concret|approv|review|submit|deliver|procure|fabricat|test|inspect|settl|dry', crewTrades: [['formwork|shutter', 30], ['rebar|reinforc|steel fix', 30], ['block|masonry|plaster|paint|til(e|ing)|gypsum|ceiling', 30], ['conduit|duct|pipe|cable|wiring|hvac|plumb|electr|fire fight|mep', 25], ['excavat|backfill|earthwork', 35]], authWords: 'ECZA|MOI|site visit|certificate|permit|occupan|power on|as-?built|civil defen|inspector|snag|authority|approv|NOC' };
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
  /* v9.10: a level of effort or WBS summary takes its dates from other work and never drives */
  const noDrive = x => x.type === 'TT_LOE' || x.type === 'TT_WBS';
  const chain = [], seen = new Set(), oos = new Set(); let t = o.chain && o.chain.length ? null : target;
  while (t && !seen.has(t.id) && chain.length < 3000) {
    seen.add(t.id); chain.push(t); let nx = null;
    if (t.as == null) { let d = []; try { d = E.dlDrivers(B, t) || []; } catch (e) { d = []; } const z = d.filter(x => x.gap != null && x.gap <= 0.01 && !seen.has(x.from.id) && !noDrive(x.from)).map(x => x.from); if (z.length) nx = z.sort((x, y) => y.ef - x.ef)[0]; }
    if (!nx) { /* the as-built driver: the predecessor that released this activity last, up to its finish. Site work overlaps (rebar starts while the formwork is finishing), so a predecessor
         that finished after this activity STARTED still controlled its finish; v9.8 counts those (worked in overlap) instead of dropping them. */
      const lim = (t.ef != null ? t.ef : t.es != null ? t.es : Infinity) + 1; const c = t.pre.filter(l => !seen.has(l.from.id) && !noDrive(l.from) && l.from.ef != null && cons(l) <= lim).sort((x, y) => cons(y) - cons(x)); nx = c.length ? c[0].from : null;
      if (nx && t.as != null && t.es != null && (c[0].type === 'FS' || c[0].type === 'SS') && cons(c[0]) > t.es) oos.add(t.id); }
    t = nx;
  }
  if (o.chain && o.chain.length) chain.push(...o.chain); else chain.reverse();
  /* 2. slip per activity and the delay each one added */
  /* v9.38: the slip an activity passes along the path is measured at the end its outgoing link uses: SS and SF pass the START slip,
     FS and FF the FINISH slip. An activity linked to the next one only by SS hands on its start; its late finish does not drive the path. */
  const outLk = chain.map((t, i) => { const nx = chain[i + 1]; if (!nx) return null; const ls = nx.pre.filter(l => l.from === t); if (!ls.length) return null;
    return ls.find(l => l.type === 'FS' || l.type === 'FF') || ls[0]; });
  let prev = 0; if (o.joins) { const ja = aBy.get(o.joins.code); if (ja && ja.ef != null && o.joins.ef != null) prev = Math.round(o.joins.ef - ja.ef); } const rows = chain.map((t, i) => { const a = aBy.get(t.code), lk = outLk[i], byStart = !!(lk && (lk.type === 'SS' || lk.type === 'SF')),
      fSlip = a && a.ef != null && t.ef != null ? Math.round(t.ef - a.ef) : null, sSlip = a && a.es != null && t.es != null ? Math.round(t.es - a.es) : null,
      slip = byStart ? (sSlip != null ? sSlip : fSlip) : fSlip, s = slip == null ? prev : slip, own = s - prev; prev = s;
    return { t, a, oos: oos.has(t.id), code: t.code, name: t.name, status: t.status, slip: s, fSlip, sSlip, via: lk ? lk.type : null, byStart, isNew: !a, own, pDur: a && a.ef != null && a.es != null ? Math.round(a.ef - a.es) : null, cDur: t.ef != null && t.es != null ? Math.round(t.ef - t.es) : null }; });
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
  /* v9.9: o.pre = changes already taken in earlier rounds; levers are then measured on top of them and never touch the same link or activity twice */
  const pre = o.pre || { rem: new Map(), links: new Map() }, withPre = ch => { const rem = new Map(pre.rem), links = new Map(pre.links); if (ch) { for (const [k, v] of ch.rem) rem.set(k, Math.min(v, rem.has(k) ? rem.get(k) : Infinity)); for (const [k, v] of ch.links) links.set(k, v); } return { raw, rem, links }; };
  const base = E.recalc(B, withPre(null)), out = [], blocked = [];
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
  const noCrew = rx(cfg.noCrewWords, /(?!)/);
  const lagKeep = rx(cfg.lagKeepWords, /(?!)/), bodies = rx(cfg.authBodies, /(?!)/), bodyOf = nm => { const m = bodies.exec(nm); return m ? m[0].toLowerCase() : ''; };
  const trades = (cfg.crewTrades || []).map(([w, q]) => { try { return [new RegExp(w, 'i'), Math.max(0, Math.min(60, +q || 0))]; } catch (e) { return null; } }).filter(Boolean), crewPctOf = nm => { for (const [r, q] of trades) if (r.test(nm)) return q; return Math.max(0, Math.min(60, +cfg.crewPct || 0)); };
  const note = (ch, ok, why, l) => { ch.why = ch.why || { ok: {}, no: {}, map: new Map() }; const k = why.split(':')[0], b = ok ? ch.why.ok : ch.why.no; b[k] = (b[k] || 0) + 1; ch.why.map.set(l, why); };
  const run = ch => { const r = E.recalc(B, withPre(ch)); return Math.round(base.finish - r.finish); };
  for (const c of train.cars) {
    if (c.phase !== 'next' && c.phase !== 'now') continue;
    const own = c.rows.map(r => r.t).filter(t => t.status !== 'TK_Complete');
    const scopes = [['car', new Set(own.map(t => t.id))]];
    if (cfg.twins) { const s = new Set(); for (const t of own) for (const x of (byKey.get(twinKey(t)) || [t])) s.add(x.id); if (s.size > own.length) scopes.unshift(['twins', s]); }
    const mk = (kind, inS) => { const ch = { rem: new Map(), links: new Map(), n: 0, pcts: new Set() };
      for (const t of B.tasks) { if (!inS.has(t.id)) continue;
        if (kind === 'crew' && !t.isMile && !hold.test(t.name) && !noCrew.test(t.name) && !pre.rem.has(t.id)) { const r = remOf(t); const q = crewPctOf(t.name); if (r >= cfg.minRemWd && q > 0) { ch.rem.set(t.id, r * (1 - q / 100)); ch.pcts.add(q); ch.n++; } }
        for (const l of t.pre) { if (!inS.has(l.from.id) || l.from.status === 'TK_Complete' || pre.links.has(l)) continue; const ph = hold.test(l.from.name) || hold.test(t.name);
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

/* v9.9: recovery in rounds (the crashing procedure). Round 1 = the levers already chosen on the driving path. After each round the schedule is recalculated with everything
   taken so far, the NEW driving path of the work still to come is traced on the recalculated dates, and the best contractor lever of each stage of that path is taken.
   Stops when the slip is recovered, when no lever on the new driving path gains a day, or after cfg.maxRounds. */
E.trainRounds = function (B, train, start, o) {
  o = o || {}; const cfg = train.cfg, raw = o.raw, done = t => t.status === 'TK_Complete', skip = t => t.type === 'TT_LOE' || t.type === 'TT_WBS';
  const pre = { rem: new Map(), links: new Map() }, add = lv => { for (const [k, v] of lv.ch.rem) pre.rem.set(k, Math.min(v, pre.rem.has(k) ? pre.rem.get(k) : Infinity)); for (const [k, v] of lv.ch.links) pre.links.set(k, v); };
  const calc = () => E.recalc(B, { raw, rem: pre.rem, links: pre.links }), r0 = E.recalc(B, { raw }), slip = Math.max(0, train.target.slip || 0), rounds = [];
  const wpath = id => { const p = []; let w = B.wbs[id]; while (w) { p.unshift(w); w = w.parent ? B.wbs[w.parent] : null; } return p; };
  const title = ts => { try { return E._trainTitle(ts.map(t => wpath(t.wbs))); } catch (e) { return ts.length ? ts[0].name : ''; } };
  const lvRow = (lv, cars) => ({ label: lv.label, kind: lv.kind, who: lv.who, where: (cars[lv.car] || {}).title || '', n: lv.n, copies: lv.copies, alone: lv.gain, effect: lv.effect || lv.how });
  /* the driving path of the remaining work on recalculated dates */
  const trace = r => { const ES = t => r.es.has(t.id) ? r.es.get(t.id) : t.es, EF = t => r.ef.has(t.id) ? r.ef.get(t.id) : t.ef; let end = null;
    for (const t of B.tasks) { if (done(t) || skip(t) || !r.ef.has(t.id)) continue; if (!end || EF(t) > EF(end) || (EF(t) === EF(end) && t.isMile && !end.isMile)) end = t; }
    const chain = [], seen = new Set(); let t = end;
    /* v9.11: the hour-level recalculation records the link that drives each activity: follow it */
    if (r.drv) { if (r.efM) { end = null; for (const x of B.tasks) { if (done(x) || skip(x) || !r.rsM.has(x.id)) continue; const v = r.efM.get(x.id); if (!end || v > r.efM.get(end.id) + 1e-6 || (Math.abs(v - r.efM.get(end.id)) <= 1e-6 && x.isMile && !end.isMile)) end = x; } t = end; }
      while (t && !seen.has(t.id) && chain.length < 3000) { seen.add(t.id); chain.unshift(t); const l = r.drv.get(t.id); t = l && !done(l.from) && !skip(l.from) ? l.from : null; } return chain; }
    while (t && !seen.has(t.id) && chain.length < 3000) { seen.add(t.id); chain.unshift(t); let ds = []; try { ds = E.dlDrivers(B, t, { ES, EF, links: pre.links }) || []; } catch (e) { ds = []; }
      const z = ds.filter(x => x.gap != null && x.gap <= 0.01 && !done(x.from) && !skip(x.from) && !seen.has(x.from.id)).sort((x, y) => (y.imp - x.imp) || (EF(y.from) - EF(x.from))); t = z.length ? z[0].from : null; }
    return chain; };
  const cut = chain => { const cs = []; for (const t of chain) { const k = (B.wbs[t.wbs] || {}).parent || t.wbs, l = cs[cs.length - 1]; if (l && l.key === k) l.ts.push(t); else cs.push({ key: k, ts: [t] }); }
    while (cs.length > 4) { let bi = 0, bv = Infinity; for (let i = 0; i < cs.length - 1; i++) { const v = cs[i].ts.length + cs[i + 1].ts.length; if (v < bv) { bv = v; bi = i; } } cs[bi].ts.push(...cs[bi + 1].ts); cs.splice(bi + 1, 1); }
    return cs.map((c, i) => ({ idx: i, phase: 'next', rows: c.ts.map(t => ({ t, name: t.name, code: t.code })), title: title(c.ts), n: c.ts.length })); };
  let cum = 0, stop = '';
  if (start && start.length) { start.forEach(add); const g = Math.round(r0.finish - calc().finish); cum = g; rounds.push({ n: 1, yours: true, path: { label: title(train.rows.filter(r => !done(r.t)).map(r => r.t)), n: train.rows.filter(r => !done(r.t)).length }, levers: start.map(lv => lvRow(lv, train.cars)), gain: g, cum }); }
  const max = Math.max(1, Math.min(20, Math.round(+cfg.maxRounds || 6)));
  while (rounds.length < max) {
    if (slip && cum >= slip) { stop = 'The slip is recovered.'; break; }
    const r = calc(), chain = trace(r); if (chain.length < 2) { stop = 'No driving path could be traced in the remaining work.'; break; }
    const cars = cut(chain), L = E.trainLevers(B, { cfg, cars }, { raw, holdWords: o.holdWords, seqCfg: o.seqCfg, pre });
    const best = new Map(); for (const lv of L.levers) if (lv.gain > 0 && lv.kind !== 'parallel' && (!best.has(lv.car) || lv.gain > best.get(lv.car).gain)) best.set(lv.car, lv);
    const pick = [...best.values()]; const path = { label: title(chain), n: chain.length, first: chain[0].name, last: chain[chain.length - 1].name };
    if (!pick.length) { rounds.push({ n: rounds.length + 1, path, levers: [], gain: 0, cum, blocked: L.blocked.length, none: true }); const hd = chain.filter(t => !t.isMile).sort((x, y) => (y.remWd || 0) - (x.remWd || 0))[0];
      stop = chain.length <= 3 && hd ? 'The finish is now held by “' + hd.name + '” (' + hd.code + ', ' + Math.round(hd.remWd != null ? hd.remWd : hd.durWd || 0) + ' working days remaining), and no lever applies to it. If it is a time-related activity (temporary works, site management), ask the contractor to make it a level of effort or correct its remaining duration, then run the rounds again.' : 'No contractor lever on the new driving path gains a day' + (L.levers.some(x => x.kind === 'parallel' && x.gain > 0) ? ' (an authority lever does)' : '') + '.'; break; }
    const before = r.finish; pick.forEach(add); const g = Math.round(before - calc().finish);
    if (g <= 0) { stop = 'The levers on the new driving path do not add up to a day.'; break; }
    cum += g; rounds.push({ n: rounds.length + 1, path, levers: pick.map(lv => lvRow(lv, cars)), gain: g, cum });
  }
  if (!stop) stop = slip && cum >= slip ? 'The slip is recovered.' : 'Stopped after ' + max + ' rounds (the limit in the settings).';
  const rN = calc(), nAct = pre.rem.size, nLink = pre.links.size;
  return { rounds, total: cum, slip, residual: Math.max(0, slip - cum), stop, finish: rN.finish, base: r0.finish, nAct, nLink, pre };
};

/* ===== v9.12: P6 check report. P6 stores its own dates in the file; the tool recalculates the same file without looking at them, and the two are compared activity by activity. ===== */
E.p6Check = function (M, o) {
  o = o || {}; const r = E.recalc(M, { all: true }), raw = new Map(); for (const x of ((M.T && M.T.TASK && M.T.TASK.r) || [])) raw.set(x.task_id, x);
  const nd = t => t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS', day = m => m == null ? null : Math.floor(m / 1440), so = M.so || {}, P = M.proj || {};
  const rows = new Map(), st = { n: 0, sSame: 0, s1: 0, sMore: 0, fSame: 0, f1: 0, fMore: 0 }; let p6fin = -Infinity;
  for (const t of M.tasks) { if (!nd(t) || t.ef == null || !r.ef.has(t.id)) continue; const act = t.status === 'TK_Active';
    /* start: for work in progress the start of the REMAINING work (P6 "remaining early start") */
    const p6s = act ? (t.rsM != null ? day(t.rsM) : null) : t.es, ts = act ? day(r.rsM.get(t.id)) : r.es.get(t.id), dS = p6s == null || ts == null ? 0 : ts - p6s, dF = r.ef.get(t.id) - t.ef;
    st.n++; if (!dS) st.sSame++; else if (Math.abs(dS) <= 1) st.s1++; else st.sMore++; if (!dF) st.fSame++; else if (Math.abs(dF) <= 1) st.f1++; else st.fMore++; if (t.ef > p6fin) p6fin = t.ef;
    rows.set(t.id, { t, dS, dF, p6s, ts, p6f: t.ef, tf: r.ef.get(t.id), diff: !!(dS || dF) }); }
  /* roots: the first activity where a difference starts (all its unfinished predecessors agree) */
  const diffs = [...rows.values()].filter(x => x.diff), rootOf = new Map();
  const cause = x => { const t = x.t, w = raw.get(t.id) || {}, c = [];
    if (t.pre.some(l => (l.type === 'SS' || l.type === 'SF') && l.from.status === 'TK_Active')) c.push('follows an in-progress activity through a start-to-start link');
    if (t.status === 'TK_Active') c.push('in progress: the start of its remaining work differs');
    if (t.cstrType || t.cstrType2) c.push('has a constraint (' + String(t.cstrType || t.cstrType2).replace('CS_', '') + ')');
    if (w.suspend_date || w.resume_date) c.push('suspended and resumed');
    if (t.type === 'TT_Rsrc') c.push('resource dependent (follows resource calendars)');
    if (w.external_early_start_date) c.push('has an external early start date');
    if (t.pre.some(l => l.from.clndr !== t.clndr && nd(l.from))) c.push('predecessor on a different calendar');
    if (t.pre.some(l => l.from.type === 'TT_LOE')) c.push('follows a level of effort');
    return c.length ? c[0] + (c.length > 1 ? ' (also: ' + c.slice(1).join('; ') + ')' : '') : 'not identified'; };
  const find = (x, depth) => { if (rootOf.has(x.t.id)) return rootOf.get(x.t.id); let up = null; if (depth < 400) for (const l of x.t.pre) { const q = rows.get(l.from.id); if (q && q.diff) { up = q; break; } } const rt = up ? find(up, depth + 1) : x; rootOf.set(x.t.id, rt); return rt; };
  for (const x of diffs) find(x, 0);
  const roots = new Map(); for (const x of diffs) { const rt = rootOf.get(x.t.id); let g = roots.get(rt.t.id); if (!g) roots.set(rt.t.id, g = { root: rt, cause: cause(rt), n: 0, worst: 0 }); g.n++; g.worst = Math.max(g.worst, Math.abs(x.dF), Math.abs(x.dS)); }
  const rootList = [...roots.values()].sort((a, b) => b.n - a.n || b.worst - a.worst), byCause = new Map(); for (const g of rootList) { const k = g.cause.replace(/ \(also:.*$/, ''); const c = byCause.get(k) || { cause: k, roots: 0, acts: 0 }; c.roots++; c.acts += g.n; byCause.set(k, c); }
  /* longest path: P6's flag against the tool's own (every tied driving link, back from the finish) */
  const flag = t => (raw.get(t.id) || {}).driving_path_flag, hasFlag = M.tasks.some(t => flag(t) === 'Y'), p6lp = new Set(M.tasks.filter(t => nd(t) && flag(t) === 'Y').map(t => t.id)), loeLp = M.tasks.filter(t => t.status !== 'TK_Complete' && t.type === 'TT_LOE' && flag(t) === 'Y');
  const tlp = new Set(), stack = M.tasks.filter(t => nd(t) && r.rsM.has(t.id) && r.efM.get(t.id) >= r.finishM - 1); while (stack.length) { const t = stack.pop(); if (tlp.has(t.id)) continue; tlp.add(t.id); for (const l of (r.drvAll.get(t.id) || [])) if (nd(l.from) && !tlp.has(l.from.id)) stack.push(l.from); }
  let both = 0, onlyP6 = [], onlyTool = []; for (const id of p6lp) if (tlp.has(id)) both++; else onlyP6.push(id); for (const id of tlp) if (!p6lp.has(id)) onlyTool.push(id);
  const byId = new Map(M.tasks.map(t => [t.id, t]));
  /* entries that make P6 behave in ways planners do not expect */
  const part = M.tasks.filter(t => nd(t) && !t.isMile && t.remHr != null && (() => { const fr = (t.remHr / ((M.cal[t.clndr] || {}).dayHr || 8)) % 1; return fr > 0.02 && fr < 0.98; })());
  let noCrew = /(?!)/; try { noCrew = new RegExp((o.noCrewWords || E.TRAIN_DEFAULTS.noCrewWords), 'i'); } catch (e) { }
  const timeRel = M.tasks.filter(t => nd(t) && !t.isMile && tlp.has(t.id) && noCrew.test(t.name) && (t.remWd || 0) >= 20);
  const beforeDD = M.dataDate == null ? [] : M.tasks.filter(t => nd(t) && t.status === 'TK_NotStart' && t.es != null && t.es < M.dataDate);
  /* was the file scheduled after its last change? */
  const ls = E.pm(P.last_schedule_date), stale = ls == null ? null : ((M.T && M.T.TASK && M.T.TASK.r) || []).filter(x => x.status_code !== 'TK_Complete' && E.pm(x.update_date) != null && E.pm(x.update_date) > ls + 15).length;
  /* v9.25: progress entered without scheduling again. After F9, P6 sets the early dates of a finished activity to its actual dates;
     if they differ, the progress (status, actual dates, remaining duration) was changed after the last schedule and P6's stored dates are stale. */
  const unsched = ((M.T && M.T.TASK && M.T.TASK.r) || []).filter(x => x.status_code === 'TK_Complete' && x.act_end_date && x.early_end_date && (x.early_end_date !== x.act_end_date || (x.act_start_date && x.early_start_date && x.early_start_date !== x.act_start_date))).map(x => ({ code: x.task_code, name: x.task_name, act: x.act_end_date, early: x.early_end_date }));
  const dFin = st.n ? r.finish - p6fin : 0, pF = st.n ? st.fSame / st.n : 1, verdict0 = !st.n ? 'none' : dFin === 0 && pF >= 0.995 ? 'match' : Math.abs(dFin) <= 1 && pF >= 0.95 ? 'minor' : 'no', verdict = unsched.length && verdict0 !== 'match' ? 'unsched' : verdict0;
  const lagMode = { rcal_Predecessor: 'predecessor calendar', rcal_Successor: 'successor calendar', rcal_24Hour: '24-hour calendar', rcal_ProjDefault: 'project default calendar' }[so.sched_calendar_on_relationship_lag] || (so.sched_calendar_on_relationship_lag || 'not stated');
  const settings = [['Data date', P.last_recalc_date || ''], ['Last scheduled in P6', P.last_schedule_date || 'not stated'], ['Out-of-sequence progress', so.sched_retained_logic === 'N' ? (so.sched_progress_override === 'Y' ? 'Progress override' : 'Actual dates') : 'Retained logic'], ['Calendar for lags', lagMode], ['Expected finish dates', so.sched_use_expect_end_flag === 'Y' ? 'Used' : 'Not used'], ['Critical activities defined by', P.critical_path_type === 'CT_DrivPath' ? 'Longest path' : 'Total float ≤ ' + (parseFloat(P.critical_drtn_hr_cnt) || 0) + ' h'], ['Open ends made critical', so.sched_open_critical_flag === 'Y' ? 'Yes' : 'No'], ['Multiple longest paths', so.enable_multiple_longest_path_calc === 'Y' ? 'Yes' : 'No']];
  return { verdict, st, finish: r.finish, p6fin, dFin, diffs, rootList, byCause: [...byCause.values()].sort((a, b) => b.acts - a.acts), rootOf, lp: { hasFlag, p6: p6lp.size, tool: tlp.size, both, onlyP6: onlyP6.map(id => byId.get(id)), onlyTool: onlyTool.map(id => byId.get(id)), loe: loeLp }, part, timeRel, beforeDD, stale, unsched, settings,
    notChecked: ['Total float and late dates (the tool does not calculate its own backward pass yet)', 'Resource levelling and resource-dependent calendars', 'Suspend and resume dates', 'Activities already completed (their actual dates are taken as they are)', 'Whether the logic itself is right: this report only checks that the tool calculates the same dates as P6 from the same logic'] };
};

/* v9.37: are these two files the same project? Three tests, all on the CURRENT update's activities:
   ids  = share of the update's activity IDs found in the baseline
   wbs  = share of the update's WBS elements (that hold activities) found in the baseline, by WBS code path or by name path
          (the project's top node is left out: its name changes with every update)
   same = of the IDs found, share that sit in the same WBS element in both files (catches two projects that both use A1000 …)
   verdict: 'diff' if any test is below min %, 'warn' if any is below warn %, else 'ok'. */
E.fileMatch = function (A, B, o) {
  o = o || {}; const min = isFinite(+o.min) ? +o.min : 30, warn = isFinite(+o.warn) ? +o.warn : 80;
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  const keys = M => { const K = {}; const get = id => { if (K[id]) return K[id]; const w = M.wbs[id]; if (!w) return (K[id] = { c: '', n: '' });
      if (!w.parent || !M.wbs[w.parent]) return (K[id] = { c: '', n: '' }); const p = get(w.parent);
      return (K[id] = { c: (p.c ? p.c + '.' : '') + norm(w.short), n: (p.n ? p.n + '/' : '') + norm(w.name) }); };
    Object.keys(M.wbs || {}).forEach(get); return K; };
  const KA = keys(A), KB = keys(B), cA = new Set(), nA = new Set();
  Object.values(KA).forEach(k => { if (k.c) cA.add(k.c); if (k.n) nA.add(k.n); });
  const aBy = new Map(); A.tasks.forEach(t => { if (!aBy.has(t.code)) aBy.set(t.code, t); });
  let n = 0, hit = 0, same = 0; const wb = new Set(), wbHit = new Set(), miss = [];
  for (const t of B.tasks) { if (t.type === 'TT_WBS') continue; n++;
    const k = KB[t.wbs]; if (k && (k.c || k.n)) { wb.add(t.wbs); if (cA.has(k.c) || nA.has(k.n)) wbHit.add(t.wbs); }
    const a = aBy.get(t.code); if (!a) { if (miss.length < 5) miss.push(t.code); continue; } hit++;
    const ka = KA[a.wbs]; if (k && ka && ((k.c && k.c === ka.c) || (k.n && k.n === ka.n))) same++; }
  const pc = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
  const r = { n, hit, ids: pc(hit, n), wbsN: wb.size, wbsHit: wbHit.size, wbs: pc(wbHit.size, wb.size), same: hit ? pc(same, hit) : null, sameN: same, miss, min, warn,
    nameA: (A.proj && A.proj.proj_short_name) || '', nameB: (B.proj && B.proj.proj_short_name) || '' };
  const v = [r.ids, r.wbs, r.same].filter(x => x != null);
  r.verdict = !n || r.ids < min || (r.wbs != null && r.wbs < min) || (r.same != null && hit >= 20 && r.same < min) ? 'diff' : v.some(x => x < warn) ? 'warn' : 'ok';
  return r;
};
