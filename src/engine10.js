/* ===== ENGINE PART 10: P6 roundtrip comparison (tool-generated XER vs the same project exported back from P6) ===== */
E.rtCompare = function (G, P) {
  const d10 = v => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : ''; }, num = v => { const x = parseFloat(v); return isFinite(x) ? x : null; }, rows = (T, n) => (T[n] && T[n].r) || [];
  const secs = [], add = (name, total, diffs, note) => secs.push({ name, total, diffs, note: note || '', ok: !diffs.length });
  const df = (key, field, g, p) => ({ key, field, gen: g == null ? '' : String(g), p6: p == null ? '' : String(p) });
  // project
  { const g = rows(G, 'PROJECT')[0] || {}, p = rows(P, 'PROJECT')[0] || {}, d = []; for (const f of ['plan_start_date', 'scd_end_date']) if (g[f] !== undefined || p[f] !== undefined) { if (d10(g[f]) !== d10(p[f])) d.push(df('Project', f, d10(g[f]), d10(p[f]))); } add('Project dates', 2, d, 'Finish in P6 is the scheduled project finish after F9.'); }
  // calendar
  { const cal = T => { const r = rows(T, 'CALENDAR'); const used = {}; rows(T, 'TASK').forEach(t => used[t.clndr_id] = (used[t.clndr_id] || 0) + 1); const id = Object.keys(used).sort((a, b) => used[b] - used[a])[0]; return r.find(c => c.clndr_id === id) || r[0] || null; };
    const g = cal(G), p = cal(P), d = []; if (!g || !p) d.push(df('Calendar', 'present', g ? 'yes' : 'no', p ? 'yes' : 'no')); else {
      for (const f of ['day_hr_cnt', 'week_hr_cnt']) if (num(g[f]) !== num(p[f])) d.push(df(g.clndr_name, f, g[f], p[f]));
      const dw = c => { try { const o = E.parseCalendar(c.clndr_data); return [1, 2, 3, 4, 5, 6, 7].filter(x => o.dow[x]).join(); } catch (e) { return '?'; } }, ex = c => ((c.clndr_data || '').match(/\(d\|\d+\)/g) || []).length;
      if (dw(g) !== dw(p)) d.push(df(g.clndr_name, 'working weekdays (1=Sun)', dw(g), dw(p))); if (ex(g) !== ex(p)) d.push(df(g.clndr_name, 'holiday exceptions', ex(g), ex(p))); }
    add('Calendar (the one most tasks use)', 4, d); }
  // tasks
  const gt = new Map(rows(G, 'TASK').map(t => [t.task_code, t])), pt = new Map(rows(P, 'TASK').map(t => [t.task_code, t]));
  const miss = [], extra = []; gt.forEach((v, k) => { if (!pt.has(k)) miss.push(df(k, 'activity', 'in tool file', 'missing in P6')); }); pt.forEach((v, k) => { if (!gt.has(k)) extra.push(df(k, 'activity', 'not in tool file', 'in P6')); });
  add('Activities present', gt.size, miss.concat(extra));
  const F = [['early_start_date', 'date'], ['early_end_date', 'date'], ['target_drtn_hr_cnt', 'num'], ['remain_drtn_hr_cnt', 'num'], ['total_float_hr_cnt', 'num'], ['task_type', 's'], ['duration_type', 's'], ['complete_pct_type', 's']], tfd = {}; let m = 0, same = 0;
  F.forEach(([f]) => tfd[f] = []);
  gt.forEach((g, k) => { const p = pt.get(k); if (!p) return; m++; let all = true; for (const [f, ty] of F) { let a = g[f], b = p[f], neq; if (ty === 'date') { a = d10(a); b = d10(b); neq = a !== b; } else if (ty === 'num') { a = num(a); b = num(b); neq = a == null || b == null ? a !== b : Math.abs(a - b) > 0.01; } else neq = (a || '') !== (b || ''); if (neq) { tfd[f].push(df(k, f, a, b)); if (f === 'early_start_date' || f === 'early_end_date') all = false; } } if (all) same++; });
  F.forEach(([f]) => add('Activities: ' + f, m, tfd[f], f.startsWith('early') ? 'Preview dates against P6 early dates after F9. Differences point to constraints, calendars or holidays the preview does not model.' : ''));
  // relationships
  { const code = T => { const c = new Map(rows(T, 'TASK').map(t => [t.task_id, t.task_code])); return rows(T, 'TASKPRED').map(r => ({ k: (c.get(r.pred_task_id) || r.pred_task_id) + ' > ' + (c.get(r.task_id) || r.task_id) + ' ' + r.pred_type, lag: num(r.lag_hr_cnt) || 0 })); };
    const g = code(G), p = code(P), pm = new Map(p.map(x => [x.k, x])), gm = new Map(g.map(x => [x.k, x])), d = []; g.forEach(x => { const y = pm.get(x.k); if (!y) d.push(df(x.k, 'relationship', 'in tool file', 'missing in P6')); else if (Math.abs(x.lag - y.lag) > 0.01) d.push(df(x.k, 'lag (hours)', x.lag, y.lag)); }); p.forEach(x => { if (!gm.has(x.k)) d.push(df(x.k, 'relationship', 'not in tool file', 'in P6')); }); add('Relationships', g.length, d); }
  // resources and costs
  { const rg = new Map(rows(G, 'RSRC').map(r => [r.rsrc_short_name || r.rsrc_name, r])), rp = new Map(rows(P, 'RSRC').map(r => [r.rsrc_short_name || r.rsrc_name, r])), d = []; rg.forEach((r, k) => { const q = rp.get(k); if (!q) d.push(df(k, 'resource', 'in tool file', 'missing in P6')); else if ((r.rsrc_type || '') !== (q.rsrc_type || '')) d.push(df(k, 'resource type', r.rsrc_type, q.rsrc_type)); }); add('Resources (ID and type)', rg.size, d, 'P6 matches resources by ID: an existing resource with the same ID keeps its own type.');
    const asg = (T, ids) => { const rn = new Map(rows(T, 'RSRC').map(r => [r.rsrc_id, r.rsrc_short_name || r.rsrc_name])), tn = new Map(rows(T, 'TASK').map(t => [t.task_id, t.task_code])), o = new Map(); rows(T, 'TASKRSRC').forEach(r => o.set((tn.get(r.task_id) || r.task_id) + ' | ' + (rn.get(r.rsrc_id) || r.rsrc_id), { q: num(r.target_qty), c: num(r.target_cost) })); return o; };
    const ag = asg(G), ap = asg(P), da = []; let tg = 0, tp = 0; ag.forEach((x, k) => { tg += x.c || 0; const y = ap.get(k); if (!y) da.push(df(k, 'assignment', 'in tool file', 'missing in P6')); else { if (Math.abs((x.q || 0) - (y.q || 0)) > 0.01) da.push(df(k, 'budgeted units', x.q, y.q)); if (Math.abs((x.c || 0) - (y.c || 0)) > 0.5) da.push(df(k, 'budgeted cost', x.c, y.c)); } }); ap.forEach((y, k) => { tp += y.c || 0; if (!ag.has(k)) da.push(df(k, 'assignment', 'not in tool file', 'in P6')); });
    add('Resource assignments (units and cost)', ag.size, da, 'Total budgeted cost: tool file ' + Math.round(tg).toLocaleString('en-US') + ', P6 ' + Math.round(tp).toLocaleString('en-US') + '.'); }
  const bad = secs.filter(s => !s.ok).length, pct = n => m ? Math.round((m - n) / m * 1000) / 10 : null;
  return { sections: secs, matched: m, trust: { datesEqual: m ? Math.round(same / m * 1000) / 10 : null, floatEqual: pct(tfd.total_float_hr_cnt.length), durEqual: pct(tfd.target_drtn_hr_cnt.length) }, sectionsWithDiffs: bad, nTasks: { gen: gt.size, p6: pt.size } };
};
