/* ===== ENGINE PART 14: what-if recalculation of the remaining schedule (v5.15). Day-level forward pass on the activity calendars; constraints other than start-no-earlier-than are ignored; results are used as a difference against the same calculation without the change. ===== */
E.recalc = function (M, o) {
  o = o || {}; const dd = M.dataDate, cals = Object.values(M.cal), calOf = t => M.cal[t.clndr] || cals[0];
  const work = (cal, d) => { let n = 0; while (!E.isWorking(cal, d) && n++ < 400) d++; return d; }, workBack = (cal, d) => { let n = 0; while (!E.isWorking(cal, d) && n++ < 400) d--; return d; };
  const shift = (cal, d, lag) => { const n = Math.round(lag || 0), st = n >= 0 ? 1 : -1; for (let i = 0; i < Math.abs(n); i++) { d += st; let g = 0; while (!E.isWorking(cal, d) && g++ < 400) d += st; } return d; };
  const addWd = (cal, s, n) => { let d = work(cal, s), c = 1; while (c < n) { d++; if (E.isWorking(cal, d)) c++; } return d; };
  const subW = (cal, e, n) => { let d = workBack(cal, e), c = 1; while (c < n) { d--; if (E.isWorking(cal, d)) c++; } return d; };
  const remOf = t => { if (o.rem && o.rem.has(t.id)) return o.rem.get(t.id); const raw = o.raw && o.raw.get(t.code); if (raw) { const h = parseFloat(raw.remain_drtn_hr_cnt); if (!isNaN(h)) return h / (calOf(t).dayHr || 8); } return t.durWd || 0; };
  const inc = M.tasks.filter(t => t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS'), es = new Map(), ef = new Map(); for (const t of M.tasks) if (t.status === 'TK_Complete') { es.set(t.id, t.es); ef.set(t.id, t.ef); }
  const indeg = new Map(), ids = new Set(inc.map(t => t.id)); for (const t of inc) indeg.set(t.id, 0); for (const t of inc) for (const l of t.pre) if (ids.has(l.from.id)) indeg.set(t.id, indeg.get(t.id) + 1);
  const q = inc.filter(t => !indeg.get(t.id)), order = []; while (q.length) { const t = q.pop(); order.push(t); for (const l of t.succ) { if (!ids.has(l.to.id)) continue; const k = indeg.get(l.to.id) - 1; indeg.set(l.to.id, k); if (!k) q.push(l.to); } }
  for (const t of order) { const cal = calOf(t), rem = remOf(t), mile = t.isMile; let s = t.status === 'TK_Active' && t.es != null ? t.es : work(cal, dd != null ? dd : (t.es || 0));
    if (/^CS_(MSO|MSOA|MANDSTART)$/i.test(t.cstrType || '') && t.cstrDate != null) s = Math.max(s, work(cal, t.cstrDate));
    if (t.status !== 'TK_Active') for (const l of t.pre) { if (!ids.has(l.from.id)) continue; const p = l.from, pcal = calOf(p), ps = es.get(p.id), pe = ef.get(p.id), arr = (o.links && o.links.get(l)) || [{ type: l.type, lagWd: l.lagWd }];
      for (const c of arr) { if (c.type === 'FS') s = Math.max(s, work(cal, shift(pcal, pe, c.lagWd) + 1)); else if (c.type === 'SS') s = Math.max(s, work(cal, shift(pcal, ps, c.lagWd))); else { const F = shift(pcal, c.type === 'FF' ? pe : ps, c.lagWd); s = Math.max(s, rem > 0 ? subW(cal, F, rem) : F); } } }
    es.set(t.id, s); ef.set(t.id, mile || rem <= 0 ? s : t.status === 'TK_Active' ? addWd(cal, Math.max(s, dd != null ? dd : s), rem) : addWd(cal, s, rem)); }
  let fin = -Infinity; for (const v of ef.values()) if (v != null && v > fin) fin = v; return { es, ef, finish: fin, unscheduled: inc.length - order.length };
};
