/* ===== ENGINE PART 7: delay analysis (driving-path trace, slip split, windows) ===== */
E.DL_CAUSES = { LATE: 'Late start / waiting', DUR: 'Duration growth', LOGIC: 'Logic change', REC: 'Recovery', NEW: 'Not in earlier file', CARRY: 'Carried from predecessor' };
{
  const MS_ = 86400000;
  const wdBetween = (cal, from, to) => { if (to <= from) return 0; let n = 0; for (let d = from; d < to && d - from < 500; d++) n += cal ? (E.isWorking(cal, d) ? 1 : 0) : (([5, 6].includes(new Date(d * MS_).getUTCDay())) ? 0 : 1); return n; };
  const r1 = x => Math.round(x * 10) / 10;
  const skipType = t => t.type === 'TT_LOE' || t.type === 'TT_WBS';
  const done = t => t.status === 'TK_Complete';

  /* every predecessor of a with the gap (working days) between what the link implies and when a actually starts */
  /* v6.7: lags are counted in working days on the predecessor's calendar; start milestones take no time (successor starts the same day), a finish milestone takes the finish day of its predecessor; o = { ES, EF, links } lets the recovery scenarios use recalculated dates and changed links */
  const shiftWd = (cal, d, n) => { n = Math.round(n || 0); const st = n >= 0 ? 1 : -1; for (let i = 0; i < Math.abs(n); i++) { d += st; let g = 0; while (cal && !E.isWorking(cal, d) && g++ < 400) d += st; } return d; };
  E.dlDrivers = function (M, a, o) {
    o = o || {}; const ES = o.ES || (t => t.es), EF = o.EF || (t => t.ef), cal = M.cal[a.clndr], aes = ES(a), aef = EF(a); const span = (aef != null && aes != null) ? aef - aes : 0; const out = [];
    for (const l of a.pre) {
      const p = l.from, pes = ES(p), pef = EF(p); if (pes == null || pef == null || aes == null) continue; const pcal = M.cal[p.clndr];
      for (const c of ((o.links && o.links.get(l)) || [{ type: l.type, lagWd: l.lagWd }])) {
        let imp; if (c.type === 'FS') { const f = shiftWd(pcal, pef, c.lagWd); imp = (p.isMile && !p.isFinMile) || a.isFinMile ? f : f + 1; } else if (c.type === 'SS') imp = shiftWd(pcal, pes, c.lagWd); else if (c.type === 'FF') imp = shiftWd(pcal, pef, c.lagWd) - span; else imp = shiftWd(pcal, pes, c.lagWd) - span;
        out.push({ link: l, from: p, imp, gap: wdBetween(cal, imp, aes), type: c.type });
      }
    }
    return out;
  };
  E.dlTrace = function (M, end, used) {
    end.viaLink = null; end.gapWd = 0; const chain = [end], seen = new Set([end.id]); let cur = end, reason = 'start', joins = null;
    for (;;) {
      let ds = E.dlDrivers(M, cur).filter(d => !skipType(d.from)); const mg = ds.length ? Math.min(...ds.map(d => d.gap)) : 99; ds = mg <= 1 ? ds.filter(d => d.gap === mg) : (mg <= 60 ? ds.filter(d => d.gap === mg) : []); cur.gapWd = mg > 1 && ds.length ? mg : 0; cur.linkGap = ds.length ? mg : null;
      if (!ds.length) { reason = cur.as != null ? 'Actual start – no driving predecessor' : (cur.cstrType ? 'Start constraint' : 'No driving predecessor'); break; }
      ds.sort((x, y) => (y.imp - x.imp) || ((y.from.ef || 0) - (x.from.ef || 0)));
      const d = ds[0]; cur.tieAlt = ds.slice(1).filter(x => x.imp === d.imp && x.gap === d.gap).map(x => x.from.code);
      if (seen.has(d.from.id)) { reason = 'Loop'; break; }
      if (used && used.has(d.from.id)) { joins = d.from; reason = 'Joins a higher path'; break; }
      chain.unshift(d.from); seen.add(d.from.id); cur = d.from; chain[0].viaLink = null; chain[1].viaLink = d.link;
    }
    return { chain, reason, joins };
  };
  /* path 1 = longest (driving) path to the target; paths 2..n = next lowest total float, traced back the same way */
  E.dlPaths = function (M, target, n) {
    const paths = []; const used = new Set();
    const p1 = E.dlTrace(M, target, null); p1.chain.forEach(t => used.add(t.id)); paths.push(Object.assign({ rank: 1, end: target }, p1));
    const pool = M.tasks.filter(t => !done(t) && !skipType(t) && t.tfWd != null && t.ef != null);
    const groups = new Map(); for (const t of pool) { const k = Math.round(t.tfWd * 2) / 2; (groups.get(k) || groups.set(k, []).get(k)).push(t); }
    const keys = [...groups.keys()].sort((a, b) => a - b); let tries = 0;
    for (const k of keys) {
      if (paths.length >= n || tries > 80) break;
      const cand = groups.get(k).filter(t => !used.has(t.id)).sort((a, b) => (b.ef - a.ef) || (b.pre.length - a.pre.length));
      for (const c of cand.slice(0, 4)) {
        if (used.has(c.id) || paths.length >= n) continue; tries++;
        const tr = E.dlTrace(M, c, used); if (tr.chain.length < 3) continue;
        tr.chain.forEach(t => used.add(t.id)); paths.push(Object.assign({ rank: paths.length + 1, end: c, tf: k }, tr));
      }
    }
    /* v8.2.1: report each path's true lowest float (the half-day grouping above is only for choosing candidates, not for display) */
    paths.forEach((p, i) => { const v = p.chain.filter(t => !done(t) && t.tfWd != null).map(t => t.tfWd); const m = v.length ? Math.min(...v) : (i ? p.tf : 0); p.tf = i === 0 ? Math.min(m, 0) : m; if (!isFinite(p.tf)) p.tf = 0; });
    return paths;
  };

  const pick = (M, code) => (M.byCode[code] || [])[0] || null;
  const linkOf = (M, fromT, toT) => toT && fromT ? toT.pre.find(l => l.from === fromT) || null : null;

  /* measure the slip of a chain between an earlier model (Me) and a later model (Ml). chainModel = which of the two the chain was traced in */
  E.dlSlip = function (path, Me, Ml, chainIsLater, minD) {
    minD = minD || 3; const rows = []; let carry = 0, prevItem = null;
    if (path.joins) { const jt = path.joins, je = chainIsLater ? pick(Me, jt.code) : jt, jl = chainIsLater ? jt : pick(Ml, jt.code); if (je && jl && je.ef != null && jl.ef != null) carry = jl.ef - je.ef; }
    path.chain.forEach((t, i) => {
      const e = chainIsLater ? pick(Me, t.code) : t, l = chainIsLater ? t : pick(Ml, t.code);
      const r = { code: t.code, name: t.name, wbs: t.wbsPath, t: t, status: (l || t).status, flags: [], cause: null, own: 0, dF: null, dS: null, e: !!e, l: !!l };
      if (e && l && e.ef != null && l.ef != null && e.es != null && l.es != null) {
        r.sE = e.es; r.fE = e.ef; r.sL = l.es; r.fL = l.ef; r.dS = l.es - e.es; r.dF = l.ef - e.ef; r.spanE = e.ef - e.es; r.spanL = l.ef - l.es; r.grow = r.spanL - r.spanE;
        r.own = r.dF - carry; carry = r.dF;
        // logic change on the link into this activity
        let lc = null;
        if (i > 0) {
          const pe = chainIsLater ? pick(Me, path.chain[i - 1].code) : path.chain[i - 1], pl = chainIsLater ? path.chain[i - 1] : pick(Ml, path.chain[i - 1].code);
          const le = linkOf(Me, pe, e), ll = linkOf(Ml, pl, l);
          if (pe && pl) { if (!le && ll) lc = 'New link added'; else if (le && !ll) lc = 'Link removed'; else if (le && ll && (le.type !== ll.type || Math.abs(le.lagCal - ll.lagCal) >= 0.5)) lc = 'Link changed (' + le.type + ' ' + r1(le.lagWd) + 'd → ' + ll.type + ' ' + r1(ll.lagWd) + 'd)'; }
        }
        r.logic = lc; if (lc) r.flags.push(lc);
        if ((l.cstrType || '') !== (e.cstrType || '') || l.cstrDate !== e.cstrDate) r.flags.push('Constraint ' + (l.cstrType ? 'set/changed (' + String(l.cstrType).replace('CS_', '') + ')' : 'removed'));
        if (e.clndr !== l.clndr) { const ce = Me.cal[e.clndr], cl = Ml.cal[l.clndr]; if ((ce && ce.name) !== (cl && cl.name)) r.flags.push('Calendar changed'); }
        const lateStart = (l.as != null && e.es != null && l.as - e.es >= 1) ? 'Started ' + (l.as - e.es) + ' d after the earlier planned start' : null;
        const dd = Ml.dataDate; if (!done(l) && l.as == null && l.es != null && dd != null && l.es < dd) r.flags.push('Should have started before the data date');
        if (!done(l) && l.ef != null && dd != null && l.ef < dd) r.flags.push('Should have finished before the data date');
        // cause
        if (r.own >= minD) {
          if (lc && /new|changed|removed/i.test(lc) && r.grow < r.own * 0.5) r.cause = E.DL_CAUSES.LOGIC;
          else if (r.grow >= 1 && r.grow >= r.own * 0.5) r.cause = E.DL_CAUSES.DUR;
          else r.cause = E.DL_CAUSES.LATE;
        } else if (r.own <= -minD) r.cause = E.DL_CAUSES.REC; else r.cause = null;
        if (!r.cause) r.flags = r.flags.filter(f => !/^Waited|^Link|^Constraint|^Calendar/.test(f)); else if (lateStart) r.flags.push(lateStart);
      } else {
        r.dF = carry; r.cause = null;
        if (!e) { r.flags.push(chainIsLater ? 'New activity – not in the earlier file' : 'Not in the earlier file'); r.cause = null; r.noMatch = 'new'; }
        else if (!l) { r.flags.push(chainIsLater ? 'Missing in the later file' : 'Deleted / missing in the later file'); r.noMatch = 'gone'; }
        else r.flags.push('Dates missing');
      }
      r.carry = r.dF; r.via = i > 0 ? t.viaLink : null; if (t.gapWd > 1) { r.gapWd = t.gapWd; r.flags.push('Waited ' + t.gapWd + ' working days after the driving predecessor finished'); } rows.push(r); prevItem = r;
    });
    const total = rows.length ? (rows[rows.length - 1].dF || 0) : 0;
    const events = rows.filter(r => r.cause && Math.abs(r.own) >= minD).map(r => ({ code: r.code, name: r.name, wbs: r.wbs, own: r.own, cause: r.cause, flags: r.flags, row: r }));
    return { rows, events, total };
  };

  E.dlIntegrity = function (M, label) {
    const issues = []; const add = (sev, title, n, ex) => { if (n) issues.push({ sev, title, n, ex }); };
    const dd = M.dataDate; const live = M.tasks.filter(t => !skipType(t));
    let oos = [], open = [], hard = [], softc = {};
    for (const t of live) {
      if (t.as != null) for (const l of t.pre) { if (l.type === 'FS' && l.from.af == null && !l.from.isMile) oos.push(t.code); else if (l.type === 'FS' && l.from.af != null && t.as < l.from.af) oos.push(t.code); }
      if (!t.isMile && !done(t) && (!t.pre.length || !t.succ.length)) open.push(t.code);
      const cs = t.cstrType; if (cs) { if (/MAND|^CS_MSO$|^CS_MEO$/.test(cs)) hard.push(t.code); softc[cs] = (softc[cs] || 0) + 1; }
    }
    const early = live.filter(t => !done(t) && t.as == null && t.es != null && dd != null && t.es < dd).map(t => t.code);
    const late = live.filter(t => !done(t) && t.as != null && t.ef != null && dd != null && t.ef < dd).map(t => t.code);
    add('bad', 'Out-of-sequence progress (started before the predecessor finished)', oos.length, oos.slice(0, 8));
    add('bad', 'Mandatory constraints (they override the logic and can hide the real driving path)', hard.length, hard.slice(0, 8));
    add('warn', 'Open-ended activities (no predecessor or no successor)', open.length, open.slice(0, 8));
    add('warn', 'Not started but planned before the data date', early.length, early.slice(0, 8));
    add('warn', 'In progress but forecast to finish before the data date', late.length, late.slice(0, 8));
    const lg = M.so && (M.so.sched_retained_logic || M.so.retained_logic); if (lg === 'N') add('info', 'Progress override is used (not retained logic) – out-of-sequence activities break the logic', 1, []);
    const nc = Object.values(softc).reduce((a, b) => a + b, 0) - hard.length; if (nc > 0) add('info', 'Other date constraints on activities', nc, Object.keys(softc));
    const live2 = live.filter(t => !t.isMile && !done(t)); const crit = live2.filter(t => t.tfWd != null && t.tfWd <= 0).length;
    const sev = issues.some(x => x.sev === 'bad') ? 'bad' : issues.some(x => x.sev === 'warn') ? 'warn' : 'ok';
    return { label, issues, sev, tasks: live.length, critical: crit };
  };
  E.dlBaselineCheck = function (Mb, Mu) {
    const w = [];
    if (Mb.dataDate != null && Mu.dataDate != null && Mb.dataDate >= Mu.dataDate) w.push('The baseline data date (' + E.fmtDate(Mb.dataDate) + ') is not earlier than the update data date (' + E.fmtDate(Mu.dataDate) + ') – check the files are in the right order.');
    const act = Mb.tasks.filter(t => t.as != null).length; if (act > 0 && Mb.dataDate != null && Mb.dataDate > Mb.planStart + 30) w.push('The "baseline" file already contains progress (' + act + ' activities with actual dates, data date ' + E.fmtDate(Mb.dataDate) + '). It looks like an update, not a true baseline – the slip is measured against that earlier update.');
    if ((Mb.proj.proj_short_name || '') !== (Mu.proj.proj_short_name || '')) w.push('The project names differ (“' + (Mb.proj.proj_short_name || '') + '” and “' + (Mu.proj.proj_short_name || '') + '”).');
    return w;
  };

  const tscore = t => (t.isFinMile ? 4 : t.isMile ? 2 : 0) + (/project finish|project completion|completion of the project|handover/i.test(t.name) ? 8 : 0) + Math.min(t.pre.length, 50) / 100 - t.succ.length;
  const defaultTarget = M => { let b = null; for (const t of M.tasks) { if (skipType(t) || t.ef == null) continue; if (!b || t.ef > b.ef || (t.ef === b.ef && tscore(t) > tscore(b))) b = t; } return b; };
  E.dlTargets = function (M) { const l = M.tasks.filter(t => (t.isMile || t.isFinMile) && t.ef != null && !t.succ.length).sort((a, b) => b.ef - a.ef).slice(0, 25); const d = defaultTarget(M); if (d && !l.includes(d)) l.unshift(d); return l; };


  /* ---- the three lists: what drives the finish now, what is delayed and driving, what is delayed but not driving ---- */
  E.dlProv = function (M, chain) {
    const out = [], dd = M.dataDate, codes = a => a.slice(0, 6).join(', ') + (a.length > 6 ? ' (+' + (a.length - 6) + ' more)' : '');
    const oos = [], hard = [], open = [], gaps = [], ties = [];
    chain.forEach((t, i) => {
      if (t.as != null) for (const l of t.pre) { if (l.type === 'FS' && ((l.from.af == null && !l.from.isMile) || (l.from.af != null && t.as < l.from.af))) { oos.push(t.code); break; } }
      if (t.cstrType && /MAND|^CS_MSO$|^CS_MEO$/.test(t.cstrType)) hard.push(t.code);
      if (!t.isMile && !t.pre.length && i > 0) open.push(t.code);
      if (t.linkGap > 0) gaps.push(t.code + ' (' + t.linkGap + ' wd)');
      if (t.tieAlt && t.tieAlt.length) ties.push(t.code + ' ties with ' + t.tieAlt.join(', '));
    });
    if (oos.length) out.push('Out-of-sequence progress on the path: ' + codes(oos) + '. The logic does not control these dates.');
    if (hard.length) out.push('Mandatory constraints on the path: ' + codes(hard) + '. They override the logic and can hide the real driving activity.');
    if (open.length) out.push('Activities on the path with no predecessor: ' + codes(open) + '.');
    if (gaps.length) out.push('Links on the path that are not strictly zero-gap (the successor starts later than the link requires): ' + codes(gaps) + '. The driving link here is the closest one, not an exact one.');
    if (ties.length) out.push('Tie between driving predecessors, both branches would move the finish: ' + codes(ties) + '.');
    if (dd != null) { const stale = M.tasks.filter(t => !skipType(t) && !done(t) && t.as == null && t.es != null && t.es < dd); if (stale.length) out.push(stale.length + ' activities are not started but planned before the data date (' + E.fmtDate(dd) + '), e.g. ' + codes(stale.map(t => t.code)) + '. The schedule may not have been recalculated (F9) after the update, so the driving path reflects the file as it is.'); }
    return out;
  };
  /* driving path at two points: who left it and who joined it */
  E.dlCmp = function (chainA, chainB, nameA, nameB) {
    const a = new Map(chainA.map(t => [t.code, t])), b = new Map(chainB.map(t => [t.code, t])), keep = [...a.keys()].filter(k => b.has(k));
    const row = t => ({ code: t.code, name: t.name, es: t.es, ef: t.ef, tf: t.tfWd });
    return { nameA, nameB, nA: a.size, nB: b.size, kept: keep.length, dropped: [...a.keys()].filter(k => !b.has(k)).map(k => row(a.get(k))), joined: [...b.keys()].filter(k => !a.has(k)).map(k => row(b.get(k))), pct: b.size ? Math.round(keep.length / b.size * 100) : null };
  };
  E.dlLists = function (rawPath, res, Me, Ml, chainIsLater, minD) {
    minD = minD || 3; const chain = rawPath.chain, codes = new Set(chain.map(t => t.code));
    const now = res.rows.map((r, i) => {
      const t = chain[i], v = r.via; let why;
      if (i === 0) why = rawPath.reason === 'Joins a higher path' ? 'Joins a higher path' : (t.as != null ? 'Actual start; no driving predecessor' : (t.cstrType ? 'Start constraint' : 'No driving predecessor'));
      else why = 'Starts when ' + (v ? v.from.code : chain[i - 1].code) + ' ' + (v && v.type === 'SS' || v && v.type === 'SF' ? 'starts' : 'finishes') + ' (' + (v ? v.type : 'FS') + ', lag ' + (v ? Math.round((v.lagWd || 0) * 10) / 10 : 0) + ' d' + (t.linkGap > 0 ? ', gap ' + t.linkGap + ' wd' : ', zero gap') + ')';
      return { code: r.code, name: r.name, wbs: r.wbs, status: r.status, why, tie: (t.tieAlt || []).slice(), sL: r.sL != null ? r.sL : t.es, fL: r.fL != null ? r.fL : t.ef, tf: t.tfWd };
    });
    const drv = res.rows.filter(r => r.dF != null && r.dF >= 1).map(r => ({ code: r.code, name: r.name, wbs: r.wbs, dF: r.dF, added: r.own, cause: r.cause, carried: !(r.cause && r.own >= minD), flags: r.flags }));
    const off = []; const later = chainIsLater ? Ml : Ml;
    for (const l of Ml.tasks) {
      if (skipType(l) || codes.has(l.code)) continue; const e = pick(Me, l.code); if (!e || e.ef == null || l.ef == null) continue; if (done(e) && done(l)) continue;
      const d = l.ef - e.ef; if (d >= minD) off.push({ code: l.code, name: l.name, wbs: l.wbsPath, dF: d, tf: l.tfWd, status: l.status, crit: l.tfWd != null && l.tfWd <= 0 });
    }
    off.sort((a, b) => b.dF - a.dF);
    return { now, drv, off: off.slice(0, 200), offTotal: off.length, prov: E.dlProv(chainIsLater ? Ml : Me, chain) };
  };

  const pathResult = (rank, p, Me, Ml, chainIsLater, minD) => { const s = E.dlSlip(p, Me, Ml, chainIsLater, minD); return { rank, tf: p.tf, end: p.end, reason: p.reason, joins: p.joins, rows: s.rows, events: s.events, total: s.total, len: p.chain.length }; };

  const headline = (res) => {
    const T = res.target, ev = res.paths[0].events.filter(e => e.own > 0).sort((a, b) => b.own - a.own);
    if (!T.slip) return 'The finish of “' + T.name + '” has not moved (' + E.fmtDate(T.fE) + ').';
    const sg = T.slip > 0 ? 'moved later by ' + T.slip + ' days' : 'moved earlier by ' + (-T.slip) + ' days';
    let s = 'The finish of “' + T.name + '” has ' + sg + ' (' + E.fmtDate(T.fE) + ' → ' + E.fmtDate(T.fL) + ').';
    if (T.slip > 0 && ev.length) { let acc = 0, k = 0; for (const e of ev) { acc += e.own; k++; if (acc >= T.slip * 0.8) break; } s += ' ' + k + ' activit' + (k === 1 ? 'y' : 'ies') + ' on the driving path introduced ' + Math.round(Math.min(100, acc / T.slip * 100)) + '% of it; the largest is ' + ev[0].code + ' “' + ev[0].name + '” (+' + ev[0].own + ' days, ' + ev[0].cause.toLowerCase() + ').'; }
    return s;
  };

  /* Option A – earlier file (baseline) against the current update; paths traced in the update */
  E.delayA = function (Mb, Mu, opt) {
    opt = opt || {}; const tl = opt.targetCode ? pick(Mu, opt.targetCode) : null; if (opt.targetCode && !tl) throw new Error('The target activity ' + opt.targetCode + ' is not in the update. Choose another target.'); const target = tl || defaultTarget(Mu), te = pick(Mb, target.code);
    const rawPaths = E.dlPaths(Mu, target, opt.n || 3), paths = rawPaths.map(p => pathResult(p.rank, p, Mb, Mu, true, opt.min));
    const res = { mode: 'A', target: { code: target.code, name: target.name, fE: te ? te.ef : null, fL: target.ef, slip: te && te.ef != null ? target.ef - te.ef : 0, found: !!te }, paths, from: { name: opt.nameE, dd: Mb.dataDate }, to: { name: opt.nameL, dd: Mu.dataDate }, integrity: [E.dlIntegrity(Mb, 'Baseline / earlier'), E.dlIntegrity(Mu, 'Current update')], baseWarn: E.dlBaselineCheck(Mb, Mu) };
    res.headline = headline(res); res.lists = E.dlLists(rawPaths[0], paths[0], Mb, Mu, true, opt.min); try { const te0 = pick(Mb, target.code); if (te0) res.cmp = E.dlCmp(E.dlTrace(Mb, te0, null).chain, rawPaths[0].chain, opt.nameE || 'Earlier', opt.nameL || 'Current'); } catch (e) { }
    res.concurrent = paths.slice(1).map(p => ({ rank: p.rank, end: p.end, endSlip: (p.rows[p.rows.length - 1] || {}).dF || 0, events: p.events.filter(e => e.own > 0), total: p.total })).filter(c => c.endSlip > 0 || c.events.length);
    return res;
  };
  /* Option B – windows: paths traced at the START of each window, slip measured in that window only */
  E.delayB = function (models, opt) {
    opt = opt || {}; const last = models[models.length - 1].M, tcode = opt.targetCode || (defaultTarget(last) || {}).code; const wins = [];
    for (let i = 0; i < models.length - 1; i++) {
      const A = models[i].M, B = models[i + 1].M; let ta = pick(A, tcode); if (!ta) throw new Error('Window ' + (i + 1) + ': the target activity ' + tcode + ' is not in ' + models[i].name + '. Choose a target that exists in every schedule.'); const tb = pick(B, ta.code); if (!tb) throw new Error('Window ' + (i + 1) + ': the target activity ' + ta.code + ' is not in ' + models[i + 1].name + '.');
      const rawPaths = E.dlPaths(A, ta, opt.n || 3), paths = rawPaths.map(p => pathResult(p.rank, p, A, B, false, opt.min));
      const finMove = (tb && tb.ef != null && ta.ef != null) ? tb.ef - ta.ef : 0;
      const projMove = B.maxEF - A.maxEF;
      // stability: how much of the start-of-window path is still the driving path at the end of the window
      let overlap = null; try { const pb = E.dlTrace(B, tb, null); const sa = new Set(paths[0].rows.map(r => r.code)); const nb = pb.chain.map(t => t.code); overlap = nb.length ? Math.round(nb.filter(c => sa.has(c)).length / nb.length * 100) : null; } catch (e) { }
      const w = { idx: i + 1, from: models[i].name, to: models[i + 1].name, ddE: A.dataDate, ddL: B.dataDate, target: { code: ta.code, name: ta.name, fE: ta.ef, fL: tb ? tb.ef : null, slip: finMove, found: !!tb }, projMove, paths, overlap, integrity: E.dlIntegrity(B, models[i + 1].name) };
      w.concurrent = paths.slice(1).map(p => ({ rank: p.rank, end: p.end, endSlip: (p.rows[p.rows.length - 1] || {}).dF || 0, events: p.events.filter(e => e.own > 0), total: p.total })).filter(c => c.endSlip > 0);
      w.headline = headline({ target: w.target, paths }); w.lists = E.dlLists(rawPaths[0], paths[0], A, B, false, opt.min); try { w.cmp = E.dlCmp(rawPaths[0].chain, E.dlTrace(B, tb, null).chain, models[i].name, models[i + 1].name); } catch (e) { } if (overlap != null && overlap < 60) w.lists.prov.push('The driving path changed during this window: only ' + overlap + '% of the path driving at the end was on it at the start.');
      wins.push(w);
    }
    const first = models[0].M, tf = pick(first, tcode) || defaultTarget(first);
    const total = last.maxEF - first.maxEF, tt = pick(last, tcode) ? pick(last, tcode).ef - (tf ? tf.ef : 0) : null;
    return { mode: 'B', windows: wins, target: { code: tcode, name: (pick(last, tcode) || {}).name || '', fE: tf ? tf.ef : null, fL: (pick(last, tcode) || {}).ef, slip: tt == null ? 0 : tt }, models: models.map(m => ({ name: m.name, dd: m.M.dataDate, fin: m.M.maxEF })), integrity: models.map(m => E.dlIntegrity(m.M, m.name)), baseWarn: models.length > 1 ? E.dlBaselineCheck(models[0].M, models[1].M) : [] };
  };
}
