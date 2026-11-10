/* ===== ENGINE PART 15: update checks for the schedule comparison (v6.9) =====
   Missed activities and baseline execution index (BEI), critical path length index (CPLI),
   out-of-sequence progress, remaining duration against physical percent complete, actuals after the data date.
   Each looks at live work only (not level-of-effort or WBS-summary activities). */
E.UPD_DEFAULTS = { beiOk: 0.95, cpliOk: 0.95, pctTolPct: 25, pctTolWd: 2 };
E.updateChecks = function (R, c) {
  const { A, B, sec, blk, T, num, r1, dd, isCrit, both, rawB } = c, cfg = c.opt.cfg || {};
  const d = Object.assign({}, E.DELAY_DEFAULTS || {}, E.UPD_DEFAULTS, cfg.delay || {});
  if (B.dataDate == null) return;
  const live = t => t.type !== 'TT_LOE' && t.type !== 'TT_WBS', base = d.mode === 'base';
  const refE = a => base && a.te != null ? a.te : a.ef, ST = { TK_Complete: 'Completed', TK_Active: 'In progress', TK_NotStart: 'Not started' };
  const s = sec('upd', 'Update checks', 'Checks that judge the quality and progress of the update itself: missed activities, execution index, critical path length index, out-of-sequence progress, remaining duration against percent complete, and actuals after the data date. Indicators for the reviewer, not conclusions.');
  const DD = B.dataDate;
  /* 1. missed activities and BEI */
  const planned = both.filter(([a, b]) => live(a) && live(b) && refE(a) != null && refE(a) <= DD);
  const done = planned.filter(([a, b]) => b.status === 'TK_Complete'), missed = planned.filter(([a, b]) => b.status !== 'TK_Complete');
  const bei = planned.length ? done.length / planned.length : null;
  s.facts.push({ l: 'Baseline execution index (BEI)', v: T(bei == null ? 'n/a' : num(bei, 2) + '  (' + done.length + ' of ' + planned.length + ' planned to finish by the data date are complete)', bei == null ? '' : bei >= d.beiOk ? 'ok' : 'bad') });
  const fin = M => M.tasks.filter(live).filter(t => t.ef != null).sort((x, y) => y.ef - x.ef)[0];
  const cpli = (M, label) => { const f = fin(M); if (!f || M.dataDate == null) return null; const cpl = f.ef - M.dataDate, tf = f.tfCal; if (!(cpl > 0) || tf == null) return null; return { label, v: (cpl + tf) / cpl, cpl, tf, code: f.code }; };
  const cB = cpli(B), cA = cpli(A);
  s.facts.push({ l: 'Critical path length index (CPLI)', v: T(cB ? num(cB.v, 2) + '  (path length ' + num(cB.cpl, 0) + ' cal. d, total float ' + num(r1(cB.tf)) + ' cal. d at ' + cB.code + ')' + (cA ? '; previous ' + num(cA.v, 2) : '') : 'n/a', cB ? (cB.v >= d.cpliOk ? 'ok' : 'bad') : '') });
  const crit = x => isCrit(x) ? 'Yes' : '';
  blk(s, 'A. Missed activities: planned to finish by the data date and not complete', ['ID', 'Activity', 'WBS', 'Planned finish', 'Forecast finish', 'Status', 'Days late (cal.)', 'Critical'],
    missed.sort((x, y) => (y[1].ef || 0) - (x[1].ef || 0)).slice(0, 2000).map(([a, b]) => [b.code, b.name, b.wbsPath, dd(refE(a)), dd(b.ef), ST[b.status] || b.status, b.ef != null && refE(a) != null ? r1(b.ef - refE(a)) : '', crit(b)]), { num: [6] });
  /* 3. out-of-sequence progress (current update) */
  const oos = [];
  for (const t of B.tasks) { if (!live(t) || (t.status !== 'TK_Active' && t.status !== 'TK_Complete')) continue;
    for (const l of t.pre) { const p = l.from; if (!live(p)) continue; let bad = false;
      if (l.type === 'FS') bad = p.status !== 'TK_Complete'; else if (l.type === 'SS') bad = p.status === 'TK_NotStart'; else if (l.type === 'FF') bad = t.status === 'TK_Complete' && p.status !== 'TK_Complete';
      if (bad) oos.push([t.code, t.name, ST[t.status], p.code + ' · ' + p.name, ST[p.status] || p.status, l.type + (l.lagWd ? ' ' + (l.lagWd > 0 ? '+' : '') + r1(l.lagWd) + ' wd' : '')]); } }
  blk(s, 'B. Out-of-sequence progress: work started or finished before its predecessor allowed', ['ID', 'Activity', 'Status', 'Predecessor', 'Predecessor status', 'Link'], oos.slice(0, 2000),
    { note: 'How P6 treats these depends on the schedule option (retained logic or progress override). Ask the contractor to confirm the intended sequence.' });
  /* 4. physical percent complete against remaining duration */
  const pct = [];
  for (const t of B.tasks) { if (!live(t) || t.status !== 'TK_Active') continue; const r = rawB.get(t.code) || {}; const dayHr = (B.cal[t.clndr] || {}).dayHr || 8;
    const orig = parseFloat(r.target_drtn_hr_cnt) / dayHr, rem = parseFloat(r.remain_drtn_hr_cnt) / dayHr; if (!(orig > 0) || isNaN(rem)) continue;
    if (rem <= 0) { pct.push([t.code, t.name, r.phys_complete_pct === '' ? '' : r.phys_complete_pct + '%', r1(orig), r1(rem), '', 'In progress with no remaining duration']); continue; }
    if (r.complete_pct_type !== 'CP_Phys') continue; const p = parseFloat(r.phys_complete_pct); if (isNaN(p)) continue;
    const imp = orig * (1 - p / 100), tol = Math.max(d.pctTolWd, orig * d.pctTolPct / 100);
    if (Math.abs(rem - imp) > tol) pct.push([t.code, t.name, p + '%', r1(orig), r1(rem), r1(imp), rem > imp ? 'Remaining is longer than the percent complete implies' : 'Remaining is shorter than the percent complete implies']); }
  blk(s, 'C. Remaining duration against physical percent complete', ['ID', 'Activity', 'Physical % complete', 'Original (wd)', 'Remaining (wd)', 'Implied remaining (wd)', 'Finding'], pct.slice(0, 2000), { num: [3, 4, 5], note: 'Only activities that use physical percent complete are tested (with duration percent complete the two always agree), plus any in-progress activity with no remaining duration.' });
  /* 5. actuals after the data date */
  const fut = [];
  for (const t of B.tasks) { if (!live(t)) continue; if (t.as != null && t.as > DD) fut.push([t.code, t.name, 'Actual start', dd(t.as), dd(DD)]); if (t.af != null && t.af > DD) fut.push([t.code, t.name, 'Actual finish', dd(t.af), dd(DD)]); }
  blk(s, 'D. Actual dates after the data date', ['ID', 'Activity', 'Field', 'Date', 'Data date'], fut.slice(0, 2000), { note: 'Actual dates cannot be later than the data date. Ask the contractor to correct them.' });
  s.facts.push({ l: 'Missed activities', v: T(num(missed.length, 0), missed.length ? 'bad' : 'ok') }, { l: 'Out-of-sequence', v: T(num(oos.length, 0), oos.length ? 'bad' : 'ok') }, { l: 'Percent complete vs remaining', v: T(num(pct.length, 0), pct.length ? 'bad' : 'ok') }, { l: 'Actuals after the data date', v: T(num(fut.length, 0), fut.length ? 'bad' : 'ok') });
  R.upd = { bei, planned: planned.length, done: done.length, missed: missed.length, cpli: cB ? cB.v : null, oos: oos.length, pct: pct.length, fut: fut.length };
  return s;
};
