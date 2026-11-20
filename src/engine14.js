/* ===== ENGINE PART 14: what-if recalculation of the remaining schedule (v5.15). Day-level forward pass on the activity calendars; only start constraints (start on, start on or after, mandatory start) are applied; in-progress work follows retained logic unless the file uses progress override; start milestones take no time, finish milestones take the finish day of their predecessor; results are used as a difference against the same calculation without the change. ===== */
E.recalcDays = function (M, o) {
  o = o || {}; const dd = M.dataDate != null && M.ddNext ? M.dataDate + 1 : M.dataDate, cals = Object.values(M.cal), calOf = t => M.cal[t.clndr] || cals[0];
  const work = (cal, d) => { let n = 0; while (!E.isWorking(cal, d) && n++ < 400) d++; return d; }, workBack = (cal, d) => { let n = 0; while (!E.isWorking(cal, d) && n++ < 400) d--; return d; };
  const shift = (cal, d, lag) => { const n = Math.round(lag || 0), st = n >= 0 ? 1 : -1; for (let i = 0; i < Math.abs(n); i++) { d += st; let g = 0; while (!E.isWorking(cal, d) && g++ < 400) d += st; } return d; };
  const addWd = (cal, s, n) => { let d = work(cal, s), c = 1; while (c < n) { d++; if (E.isWorking(cal, d)) c++; } return d; };
  const subW = (cal, e, n) => { let d = workBack(cal, e), c = 1; while (c < n) { d--; if (E.isWorking(cal, d)) c++; } return d; };
  const remOf = t => { if (o.rem && o.rem.has(t.id)) return o.rem.get(t.id); const raw = o.raw && o.raw.get(t.code); if (raw) { const h = parseFloat(raw.remain_drtn_hr_cnt); if (!isNaN(h)) return h / (calOf(t).dayHr || 8); } return t.remWd != null ? t.remWd : (t.durWd || 0); };
  const inc = M.tasks.filter(t => t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS'), es = new Map(), ef = new Map(); for (const t of M.tasks) if (t.status === 'TK_Complete') { es.set(t.id, t.es); ef.set(t.id, t.ef); }
  const indeg = new Map(), ids = new Set(inc.map(t => t.id)); for (const t of inc) indeg.set(t.id, 0); for (const t of inc) for (const l of t.pre) if (ids.has(l.from.id)) indeg.set(t.id, indeg.get(t.id) + 1);
  const q = inc.filter(t => !indeg.get(t.id)), order = []; while (q.length) { const t = q.pop(); order.push(t); for (const l of t.succ) { if (!ids.has(l.to.id)) continue; const k = indeg.get(l.to.id) - 1; indeg.set(l.to.id, k); if (!k) q.push(l.to); } }
  /* v9.10: a start milestone sits at the start of its day, which is the same moment as the end of the working day before: used for finish-type links */
  const sm = x => x.isMile && !x.isFinMile;
  const retained = !(M.so && (M.so.sched_retained_logic || M.so.retained_logic) === 'N');
  const eeMode = (o.expectFinish || 'auto'), useEE = eeMode === 'on' || (eeMode === 'auto' && !!(M.so && M.so.sched_use_expect_end_flag === 'Y'));
  for (const t of order) { const cal = calOf(t), rem = remOf(t), mile = t.isMile, act = t.status === 'TK_Active'; let s = t.isFinMile && M.ddNext && M.dataDate != null ? work(cal, M.dataDate) : work(cal, dd != null ? dd : (t.es || 0));
    if (/^CS_(MSO|MSOA|MANDSTART)$/i.test(t.cstrType || '') && t.cstrDate != null) s = Math.max(s, work(cal, t.cstrDate));
    /* in-progress work keeps its actual start; with retained logic its remaining work still waits for its predecessors */
    /* v9.10: with progress override P6 still holds the FINISH of in-progress work by its finish-type links (FF, SF); only the start-type links (FS, SS) are ignored */
    for (const l of t.pre) { /* v9.10: a completed predecessor still holds its successor through a lag counted from its actual dates */ const done0 = !ids.has(l.from.id); if (done0 && (l.from.status !== 'TK_Complete' || !(Math.round(l.lagWd || 0) > 0) || es.get(l.from.id) == null || ef.get(l.from.id) == null || (o.links && o.links.has(l)))) continue; const p = l.from, pcal = calOf(p), ps = es.get(p.id), pe = ef.get(p.id), arr = (o.links && o.links.get(l)) || [{ type: l.type, lagWd: l.lagWd }];
      for (const c of arr) {
        if (c.type === 'FS') { if (act && !retained) continue; const f = shift(pcal, pe, c.lagWd); /* a start milestone has no duration: its successor starts the same day; a finish milestone takes the finish day of its predecessor */ s = Math.max(s, work(cal, p.isMile && !p.isFinMile || t.isFinMile ? f : f + 1)); }
        else if (c.type === 'SS') { /* v9.10: a finish milestone happens at the end of its day, so what starts with it starts the next working day (unless it is itself a finish milestone) */ if (!act) s = Math.max(s, work(cal, shift(pcal, ps, c.lagWd) + (p.isFinMile && !t.isFinMile ? 1 : 0))); }
        else { /* a start (of a start milestone, or the start an SF link points at) is the start of its day = the end of the working day before */ const st0 = c.type !== 'FF' || sm(p), keep = t.isFinMile && !Math.round(c.lagWd || 0); const F = st0 && !keep && (rem > 0 || Math.round(c.lagWd || 0)) ? shift(pcal, workBack(pcal, (c.type === 'FF' ? pe : ps) - 1), c.lagWd) : shift(pcal, c.type === 'FF' ? pe : ps, c.lagWd); /* v9.10: a start milestone tied to a finish falls on the next working day */ s = Math.max(s, rem > 0 ? subW(cal, F, rem) : (mile && !t.isFinMile && c.type === 'FF' && !(p.isMile && !p.isFinMile) ? work(cal, F + 1) : F)); } } }
    es.set(t.id, act && t.es != null ? t.es : s); let fe = mile || rem <= 0 ? s : addWd(cal, s, rem);
    /* v7.9: Expected Finish (P6 option 'use expected finish dates') replaces the finish computed from remaining duration */
    if (useEE && t.ee != null && !mile) fe = Math.max(s, t.ee); ef.set(t.id, fe); }
  let fin = -Infinity; for (const v of ef.values()) if (v != null && v > fin) fin = v; return { es, ef, finish: fin, unscheduled: inc.length - order.length };
};

/* ===== v9.11: the what-if recalculation by the hour, as P6 schedules =====
   Times are minutes since 1970. Each calendar has its working hours per day (shifts). A start rolls forward to the next working moment; a finish stays where the work ends
   (17:00 on day 1, and the successor starts 07:00 on day 2; or 12:48 and the successor starts 12:48 the same day, exactly as P6 does when durations are part-days).
   Lags are counted in working hours on the calendar the file says (predecessor, successor, 24 hours). Start and finish constraints, expected finish, retained logic /
   progress override as before. Returns day numbers (es, ef, finish) for the rest of the tool, plus the exact minutes (esM, efM) and the link that drives each activity (drv). */
E.recalc = function (M, o) {
  o = o || {}; const cals = Object.values(M.cal), cal0 = cals[0], calOf = t => M.cal[t.clndr] || cal0, EPS = 1e-6;
  const wins = (cal, day) => { if (!cal) return [[480, 960]]; if (cal.exW && cal.exW.has(day)) { const w = cal.exW.get(day); if (w.length || !cal.ex.get(day)) return w; }
    const k = ((day % 7) + 11) % 7 + 1; /* 1 = Sunday; day 0 was a Thursday */ let w = cal.dowW && cal.dowW[k]; const on = cal.ex && cal.ex.has(day) ? cal.ex.get(day) : !!(cal.dow && cal.dow[k]);
    if (!on) return NOW; if (w && w.length) return w; const h = Math.round((cal.dayHr || 8) * 60); return cal._dw || (cal._dw = [[480, Math.min(1440, 480 + h)]]); }, NOW = [];
  /* next working moment at or after x (x at the end of a shift moves to the next shift) */
  const fwd = (cal, x) => { let d = Math.floor(x / 1440); for (let g = 0; g < 3000; g++, d++) for (const w of wins(cal, d)) { const e = d * 1440 + w[1]; if (x < e - EPS) return Math.max(x, d * 1440 + w[0]); } return x; };
  /* a finish moment: kept when it is inside or at the end of a shift, otherwise the start of the next shift */
  const fwdFin = (cal, x) => { let d = Math.floor((x - EPS) / 1440); for (let g = 0; g < 3000; g++, d++) for (const w of wins(cal, d)) { const e = d * 1440 + w[1]; if (x <= e + EPS) return Math.max(x, d * 1440 + w[0]); } return x; };
  const addW = (cal, s, min) => { if (!(min > EPS)) return s; let d = Math.floor(s / 1440), cur = s; for (let g = 0; g < 6000; g++, d++) for (const w of wins(cal, d)) { const a = d * 1440 + w[0], e = d * 1440 + w[1]; if (cur >= e - EPS) continue; if (cur < a) cur = a; if (min <= e - cur + EPS) return cur + min; min -= e - cur; cur = e; } return cur; };
  const subW = (cal, f, min) => { if (!(min > EPS)) return f; let d = Math.floor((f - EPS) / 1440), cur = f; for (let g = 0; g < 6000; g++, d--) { const ws = wins(cal, d); for (let i = ws.length - 1; i >= 0; i--) { const a = d * 1440 + ws[i][0], e = d * 1440 + ws[i][1]; if (cur <= a + EPS) continue; if (cur > e) cur = e; if (min <= cur - a + EPS) return cur - min; min -= cur - a; cur = a; } } return cur; };
  const lagMode = (M.so && M.so.sched_calendar_on_relationship_lag) || 'rcal_Predecessor', projCal = M.proj && M.cal[M.proj.clndr_id];
  const lag = (p, t, x, hrs) => { if (!hrs) return x; if (lagMode === 'rcal_24Hour') return x + hrs * 60; const c = lagMode === 'rcal_Successor' ? calOf(t) : lagMode === 'rcal_ProjDefault' && projCal ? projCal : calOf(p); return hrs > 0 ? addW(c, x, hrs * 60) : subW(c, x, -hrs * 60); };
  const dayS = (cal, day) => { for (let g = 0, d = day; g < 400; g++, d++) { const w = wins(cal, d); if (w.length) return d * 1440 + w[0]; } return day * 1440; }, dayE = (cal, day) => { for (let g = 0, d = day; g < 400; g++, d--) { const w = wins(cal, d); if (w.length) return d * 1440 + w[w.length - 1][1]; } return day * 1440 + 1440; };
  const remMin = t => { if (o.rem && o.rem.has(t.id)) return o.rem.get(t.id) * (calOf(t).dayHr || 8) * 60; const raw = o.raw && o.raw.get(t.code); if (raw) { const h = parseFloat(raw.remain_drtn_hr_cnt); if (!isNaN(h)) return h * 60; } if (t.remHr != null) return t.remHr * 60; return (t.remWd != null ? t.remWd : (t.durWd || 0)) * (calOf(t).dayHr || 8) * 60; };
  const lagHrOf = (l, c) => c === l ? (l.lagHr != null ? l.lagHr : (l.lagWd || 0) * (calOf(l.from).dayHr || 8)) : (c.lagWd || 0) * (calOf(l.from).dayHr || 8);
  const inc = M.tasks.filter(t => t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS'), S = new Map(), F = new Map(), RS = new Map(), drv = new Map(), drvAll = new Map();
  for (const t of M.tasks) if (t.status === 'TK_Complete') { const c = calOf(t); S.set(t.id, t.asM != null ? t.asM : t.es != null ? dayS(c, t.es) : null); F.set(t.id, t.afM != null ? t.afM : t.ef != null ? dayE(c, t.ef) : null); }
  const indeg = new Map(), ids = new Set(inc.map(t => t.id)); for (const t of inc) indeg.set(t.id, 0); for (const t of inc) for (const l of t.pre) if (ids.has(l.from.id)) indeg.set(t.id, indeg.get(t.id) + 1);
  const q = inc.filter(t => !indeg.get(t.id)), order = []; while (q.length) { const t = q.pop(); order.push(t); for (const l of t.succ) { if (!ids.has(l.to.id)) continue; const k = indeg.get(l.to.id) - 1; indeg.set(l.to.id, k); if (!k) q.push(l.to); } }
  const retained = !(M.so && (M.so.sched_retained_logic || M.so.retained_logic) === 'N');
  const eeMode = (o.expectFinish || 'auto'), useEE = eeMode === 'on' || (eeMode === 'auto' && !!(M.so && M.so.sched_use_expect_end_flag === 'Y'));
  const dd = M.ddM != null ? M.ddM : M.dataDate != null ? M.dataDate * 1440 + (M.ddNext ? 1439 : 0) : null;
  const cs = (t, k) => { const ty = String(k === 2 ? t.cstrType2 || '' : t.cstrType || ''), m = k === 2 ? (t.cstrM2 != null ? t.cstrM2 : t.cstrDate2 != null ? t.cstrDate2 * 1440 : null) : (t.cstrM != null ? t.cstrM : t.cstrDate != null ? t.cstrDate * 1440 : null); return m == null ? null : /^CS_(MSO|MSOA|MANDSTART)$/i.test(ty) ? ['s', m] : /^CS_(MEO|MEOA|MANDFIN)$/i.test(ty) ? ['f', m] : null; };
  for (const t of order) { const cal = calOf(t), rem = t.isMile ? 0 : remMin(t), act = t.status === 'TK_Active', sm = t.isMile && !t.isFinMile; let sc = dd != null ? dd : (t.es != null ? t.es * 1440 : 0), fc = -Infinity, ds = null, df = null;
    const all = o.all ? [] : null;
    for (const k of [1, 2]) { const c = cs(t, k); if (c && c[0] === 's') sc = Math.max(sc, c[1]); if (c && c[0] === 'f') fc = Math.max(fc, c[1]); }
    for (const l of t.pre) { const p = l.from, ps = S.get(p.id), pe = F.get(p.id); if (ps == null || pe == null) continue; const pdone = !ids.has(p.id); if (pdone && p.status !== 'TK_Complete') continue;
      for (const c of ((o.links && o.links.get(l)) || [l])) { const h = lagHrOf(l, c), ty = c.type;
        if (ty === 'FS') { if (act && !retained) continue; const x = lag(p, t, pe, h); if (all) all.push([x, l, 's']); if (x > sc) { sc = x; ds = l; } }
        else if (ty === 'SS') { /* v9.12: with retained logic the remaining work of an activity in progress still waits for its SS predecessor to start (checked against P6); with progress override it does not */ if (act && !retained) continue; /* a predecessor in progress releases its SS successor when its REMAINING work starts (retained logic only; checked against P6) */ const pr = RS.get(p.id), x = Math.max(lag(p, t, ps, h), pr != null && retained && p.status === 'TK_Active' ? pr : -Infinity); if (all) all.push([x, l, 's']); if (x > sc) { sc = x; ds = l; } }
        else { const x = lag(p, t, ty === 'FF' ? pe : ps, h); if (all) all.push([x, l, 'f']); if (x > fc) { fc = x; df = l; } } } }
    let s, f;
    if (t.isFinMile) { s = fwdFin(cal, Math.max(sc, fc)); f = s; if (fc > sc) ds = df; }
    else if (sm) { s = fwd(cal, Math.max(sc, fc)); f = s; if (fc > sc) ds = df; }
    else { s = fwd(cal, sc); f = addW(cal, s, rem); if (fc > f + EPS) { const s2 = subW(cal, fc, rem); if (s2 > s) { s = fwd(cal, s2); f = rem > EPS ? addW(cal, s, rem) : s; ds = df; } } }
    const RSv = s;
    if (useEE && t.eeM != null && !t.isMile) f = Math.max(s, t.eeM); else if (useEE && t.ee != null && t.eeM == null && !t.isMile) f = Math.max(s, dayE(cal, t.ee));
    /* o.all: every link that drives this activity (ties included), for the longest-path check */
    if (all) { const finGov = !t.isMile && df && ds === df; drvAll.set(t.id, all.filter(q => t.isFinMile ? Math.abs(fwdFin(cal, q[0]) - s) < 1 : t.isMile ? Math.abs(fwd(cal, q[0]) - s) < 1 : finGov ? q[2] === 'f' && Math.abs(q[0] - fc) < 1 : q[2] === 's' && Math.abs(fwd(cal, q[0]) - RSv) < 1).map(q => q[1])); }
    RS.set(t.id, s); S.set(t.id, act && t.asM != null ? t.asM : act && t.es != null ? dayS(cal, t.es) : s); F.set(t.id, f); drv.set(t.id, ds); }
  /* day numbers for the rest of the tool: a finish at midnight belongs to the day that just ended */
  const es = new Map(), ef = new Map(), dS = m => Math.floor(m / 1440), dF = m => Math.floor((m - EPS) / 1440); let fin = -Infinity, finM = -Infinity;
  for (const t of M.tasks) { if (t.status === 'TK_Complete') { es.set(t.id, t.es); ef.set(t.id, t.ef); continue; } const a = S.get(t.id), b = F.get(t.id); if (a == null || b == null || !ids.has(t.id) || !RS.has(t.id)) continue;
    es.set(t.id, t.status === 'TK_Active' && t.es != null ? t.es : dS(a)); const fd = b - a < EPS && !(t.status === 'TK_Active') ? dS(b) : dF(b); ef.set(t.id, Math.max(fd, dS(RS.get(t.id)) <= fd ? fd : dS(b))); if (ef.get(t.id) > fin) fin = ef.get(t.id); if (b > finM) finM = b; }
  return { es, ef, finish: fin, finishM: finM, esM: S, efM: F, rsM: RS, drv, drvAll, unscheduled: inc.length - order.length };
};
