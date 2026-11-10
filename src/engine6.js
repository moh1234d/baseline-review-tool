/* ===== ENGINE PART 6: compare two schedules (previous vs current) ===== */
E.STATUS = { TK_NotStart: 'Not started', TK_Active: 'In progress', TK_Complete: 'Completed' };
E.compare = function (A, B, opt) {
  opt = opt || {}; const nearCrit = opt.nearCrit == null ? 10 : opt.nearCrit;
  const dd = d => d == null ? '' : E.fmtDate(d), r1 = x => x == null ? null : Math.round(x * 10) / 10;
  const num = (x, d) => x == null ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });
  const T = (v, t) => ({ v, t: t || '' });
  const dayDelta = (a, b) => (a == null || b == null) ? '' : (b === a ? T('0', '') : T((b > a ? '+' : '') + (b - a) + ' d', b > a ? 'bad' : 'ok'));
  const numDelta = (a, b, d, badUp) => { if (a == null || b == null) return ''; const x = Math.round((b - a) * 100) / 100; if (!x) return T('0', ''); return T((x > 0 ? '+' : '') + num(x, d == null ? 1 : d), badUp ? (x > 0 ? 'bad' : 'ok') : 'info'); };
  const R = { sections: [], nearCrit };
  const bA = new Map(A.tasks.map(t => [t.code, t])), bB = new Map(B.tasks.map(t => [t.code, t]));
  const rawA = new Map(A.T.TASK.r.map(r => [r.task_code, r])), rawB = new Map(B.T.TASK.r.map(r => [r.task_code, r]));
  const both = []; for (const [k, a] of bA) { const b = bB.get(k); if (b) both.push([a, b]); }
  const nm = M => t => t; const lab = (t, M) => ({ id: t.code, name: t.name, wbs: t.wbsPath });
  const sec = (key, title, desc) => { const s = { key, title, desc, facts: [], blocks: [], count: 0 }; R.sections.push(s); return s; };
  const blk = (s, title, cols, rows, o) => { o = o || {}; const b = { title, cols, rows, num: o.num || [], note: o.note || '', counts: o.counts !== false }; s.blocks.push(b); if (b.counts) s.count += rows.length; return b; };
  const hrsOf = (M, rows, type) => { let h = 0; for (const a of M.asg) if ((M.rsrc[a.rsrc] || {}).type === type) h += a.qty; return h; };
  const budgetMap = M => { let tot = 0; M.asg.forEach(a => tot += a.cost); const byCode = new Map(); let mode = 'cost';
    if (!(tot > 0)) { mode = 'units'; const cr = new Set(Object.values(M.rsrc).filter(r => /boq|cost/i.test(r.name) && !/progress/i.test(r.name)).map(r => r.id)); for (const a of M.asg) if (cr.has(a.rsrc)) byCode.set(a.task.code, (byCode.get(a.task.code) || 0) + a.qty); }
    else for (const a of M.asg) byCode.set(a.task.code, (byCode.get(a.task.code) || 0) + a.cost);
    let total = 0; byCode.forEach(v => total += v); return { byCode, total, mode }; };
  const bgA = budgetMap(A), bgB = budgetMap(B);
  const nonMile = M => M.tasks.filter(t => !t.isMile);
  const isCrit = t => t.tfWd != null && t.tfWd <= 0 && t.status !== 'TK_Complete';
  const stat = (M, k) => M.tasks.filter(t => !t.isMile && t.status === k).length;

  /* 1 overview */
  { const s = sec('over', 'Overview', 'Headline figures of both schedules side by side.');
    const rows = []; const add = (m, a, b, d) => rows.push([m, a, b, d == null ? '' : d]);
    add('Project', A.proj.proj_short_name || '', B.proj.proj_short_name || '', '');
    add('Data date', dd(A.dataDate), dd(B.dataDate), dayDelta(A.dataDate, B.dataDate));
    add('Project start', dd(A.minES), dd(B.minES), dayDelta(A.minES, B.minES));
    add('Project finish', dd(A.maxEF), dd(B.maxEF), dayDelta(A.maxEF, B.maxEF));
    add('Duration (calendar days)', num(A.maxEF - A.minES, 0), num(B.maxEF - B.minES, 0), numDelta(A.maxEF - A.minES, B.maxEF - B.minES, 0, true));
    add('Activities (excluding milestones)', num(nonMile(A).length, 0), num(nonMile(B).length, 0), numDelta(nonMile(A).length, nonMile(B).length, 0));
    add('Milestones', num(A.tasks.length - nonMile(A).length, 0), num(B.tasks.length - nonMile(B).length, 0), numDelta(A.tasks.length - nonMile(A).length, B.tasks.length - nonMile(B).length, 0));
    add('Relationships', num(A.links.length, 0), num(B.links.length, 0), numDelta(A.links.length, B.links.length, 0));
    add('WBS elements', num(Object.keys(A.wbs).length, 0), num(Object.keys(B.wbs).length, 0), numDelta(Object.keys(A.wbs).length, Object.keys(B.wbs).length, 0));
    add('Calendars', num(Object.keys(A.cal).length, 0), num(Object.keys(B.cal).length, 0), numDelta(Object.keys(A.cal).length, Object.keys(B.cal).length, 0));
    add('Resources', num(Object.keys(A.rsrc).length, 0), num(Object.keys(B.rsrc).length, 0), numDelta(Object.keys(A.rsrc).length, Object.keys(B.rsrc).length, 0));
    add('Resource assignments', num(A.asg.length, 0), num(B.asg.length, 0), numDelta(A.asg.length, B.asg.length, 0));
    add('Budgeted cost (SAR)', num(bgA.total, 0), num(bgB.total, 0), numDelta(bgA.total, bgB.total, 0));
    add('Labour hours', num(hrsOf(A, 0, 'RT_Labor'), 0), num(hrsOf(B, 0, 'RT_Labor'), 0), numDelta(hrsOf(A, 0, 'RT_Labor'), hrsOf(B, 0, 'RT_Labor'), 0));
    add('Equipment hours', num(hrsOf(A, 0, 'RT_Equip'), 0), num(hrsOf(B, 0, 'RT_Equip'), 0), numDelta(hrsOf(A, 0, 'RT_Equip'), hrsOf(B, 0, 'RT_Equip'), 0));
    add('Completed activities', num(stat(A, 'TK_Complete'), 0), num(stat(B, 'TK_Complete'), 0), numDelta(stat(A, 'TK_Complete'), stat(B, 'TK_Complete'), 0));
    add('In progress', num(stat(A, 'TK_Active'), 0), num(stat(B, 'TK_Active'), 0), numDelta(stat(A, 'TK_Active'), stat(B, 'TK_Active'), 0));
    add('Not started', num(stat(A, 'TK_NotStart'), 0), num(stat(B, 'TK_NotStart'), 0), numDelta(stat(A, 'TK_NotStart'), stat(B, 'TK_NotStart'), 0));
    add('Critical activities (total float ≤ 0)', num(A.tasks.filter(isCrit).length, 0), num(B.tasks.filter(isCrit).length, 0), numDelta(A.tasks.filter(isCrit).length, B.tasks.filter(isCrit).length, 0, true));
    blk(s, '', ['Item', 'Previous', 'Current', 'Change'], rows, { counts: false, num: [1, 2] });
    s.different = (A.proj.proj_short_name || '') !== (B.proj.proj_short_name || '');
    R.overview = { startDelta: B.minES - A.minES, finishDelta: B.maxEF - A.maxEF, dataDelta: (B.dataDate != null && A.dataDate != null) ? B.dataDate - A.dataDate : null };
  }

  /* 2 dates and milestones */
  { const s = sec('dates', 'Project dates and milestones', 'Start, finish and every milestone, with the movement between the two files.');
    const rows = []; const row = (n, a, b) => rows.push([n, dd(a), dd(b), dayDelta(a, b)]);
    row('Data date', A.dataDate, B.dataDate); row('Project start', A.minES, B.minES); row('Project finish', A.maxEF, B.maxEF);
    s.facts.push({ l: 'Finish moved by', v: dayDelta(A.maxEF, B.maxEF) || T('–') });
    blk(s, 'Project dates', ['Item', 'Previous', 'Current', 'Change'], rows, { counts: false });
    const ms = []; let moved = 0;
    for (const [a, b] of both) { if (!a.isMile && !b.isMile) continue; const fa = a.isFinMile || a.type === 'TT_FinMile' ? a.ef : a.es, fb = b.isFinMile || b.type === 'TT_FinMile' ? b.ef : b.es; const d = (fa != null && fb != null) ? fb - fa : null; if (d) moved++; ms.push([a.code, a.name, dd(fa), dd(fb), dayDelta(fa, fb), d || 0]); }
    ms.sort((x, y) => Math.abs(y[5]) - Math.abs(x[5]) || (x[0] < y[0] ? -1 : 1)); ms.forEach(r => r.pop());
    s.facts.push({ l: 'Milestones that moved', v: T(moved + ' of ' + ms.length, moved ? 'bad' : 'ok') });
    const b2 = blk(s, 'Milestones (largest movement first)', ['ID', 'Milestone', 'Previous', 'Current', 'Change'], ms, { counts: false }); s.count += moved; b2.note = moved ? '' : 'No milestone moved.';
    s.count += (A.maxEF !== B.maxEF) + (A.minES !== B.minES) + (A.dataDate !== B.dataDate);
  }

  /* 3 activities added / deleted / renamed */
  { const s = sec('acts', 'Activities added, deleted and renamed', 'Activities are matched by Activity ID.');
    const add = [], del = [], ren = [], typ = [];
    for (const t of B.tasks) if (!bA.has(t.code)) add.push([t.code, t.name, t.wbsPath, num(t.durWd), dd(t.es), dd(t.ef)]);
    for (const t of A.tasks) if (!bB.has(t.code)) del.push([t.code, t.name, t.wbsPath, num(t.durWd), dd(t.es), dd(t.ef)]);
    for (const [a, b] of both) { if (a.name !== b.name) ren.push([a.code, a.name, b.name]); if (a.type !== b.type) typ.push([a.code, a.name, a.type.replace('TT_', ''), b.type.replace('TT_', '')]); }
    s.facts.push({ l: 'Added', v: T(num(add.length, 0), add.length ? 'info' : '') }, { l: 'Deleted', v: T(num(del.length, 0), del.length ? 'bad' : '') }, { l: 'Renamed', v: T(num(ren.length, 0)) });
    blk(s, 'Added activities', ['ID', 'Activity', 'WBS', 'Duration (wd)', 'Start', 'Finish'], add, { num: [3] });
    blk(s, 'Deleted activities', ['ID', 'Activity', 'WBS', 'Duration (wd)', 'Start', 'Finish'], del, { num: [3] });
    blk(s, 'Renamed activities', ['ID', 'Previous name', 'Current name'], ren);
    blk(s, 'Activity type changed', ['ID', 'Activity', 'Previous type', 'Current type'], typ);
  }

  /* 4 dates and durations */
  { const s = sec('time', 'Dates and durations', 'Forecast (early) start and finish dates, and original durations, of activities present in both files.');
    const dt = [], du = []; let later = 0, earlier = 0, big = 0, silly = 0, place = 0, rnd = 0;
    for (const [a, b] of both) {
      if (a.es !== b.es || a.ef !== b.ef) { const df = (a.ef != null && b.ef != null) ? b.ef - a.ef : 0; if (df > 0) later++; else if (df < 0) earlier++; if (Math.abs(df) >= 30) big++; dt.push([[a.code, a.name, a.wbsPath, dd(a.es), dd(b.es), dayDelta(a.es, b.es), dd(a.ef), dd(b.ef), dayDelta(a.ef, b.ef)], df]); }
      const da = a.durWd == null ? null : r1(a.durWd), db = b.durWd == null ? null : r1(b.durWd);
      if (da !== db) { const ra = rawA.get(a.code) || {}, rb = rawB.get(b.code) || {}, ha = parseFloat(ra.target_drtn_hr_cnt), hb = parseFloat(rb.target_drtn_hr_cnt), ca = (A.cal[a.clndr] || {}).dayHr, cb = (B.cal[b.clndr] || {}).dayHr; const spanA = (A.maxEF - A.minES) * 6 / 7, spanB = (B.maxEF - B.minES) * 6 / 7; const odd = (da > spanA) || (db > spanB); if (odd) silly++;
        const tfa = String(ra.target_end_date || '').slice(0, 10), tfb = String(rb.target_end_date || '').slice(0, 10), ph = x => /^(2030|2099|2100)-/.test(x) || /^(1999|1900)/.test(x); const why = ph(tfa) ? 'Previous planned finish is a placeholder (' + tfa + ')' : ph(tfb) ? 'Current planned finish is a placeholder (' + tfb + ')' : (ca != null && cb != null && ca !== cb) ? 'Calendar hours/day differ' : (Math.abs((ha || 0) - (hb || 0)) <= 10 ? 'Rounding only' : 'Planned duration re-set'); if (ph(tfa) || ph(tfb)) place++; if (why === 'Rounding only') rnd++;
        du.push([[a.code, a.name, a.wbsPath, odd && da > spanA ? T(num(da), 'bad') : num(da), odd && db > spanB ? T(num(db), 'bad') : num(db), numDelta(da, db, 1, true), num(ha, 1) + ' → ' + num(hb, 1), (ca == null ? '?' : ca) + ' → ' + (cb == null ? '?' : cb), tfa + ' → ' + tfb, ph(tfa) || ph(tfb) ? T(why, 'bad') : why], (db || 0) - (da || 0)]); }
    }
    dt.sort((x, y) => y[1] - x[1]); du.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    s.facts.push({ l: 'Finish later', v: T(num(later, 0), later ? 'bad' : '') }, { l: 'Finish earlier', v: T(num(earlier, 0), earlier ? 'ok' : '') }, { l: 'Moved by 30 days or more', v: T(num(big, 0), big ? 'bad' : '') }, { l: 'Duration changed', v: T(num(du.length, 0)) });
    blk(s, 'Start / finish date changes (largest slip first)', ['ID', 'Activity', 'WBS', 'Start – previous', 'Start – current', 'Δ start', 'Finish – previous', 'Finish – current', 'Δ finish'], dt.map(x => x[0]));
    if (silly) s.facts.push({ l: 'Durations longer than the whole project', v: T(num(silly, 0), 'bad') });
    if (place) s.facts.push({ l: 'Planned finish is a placeholder date (e.g. 2030)', v: T(num(place, 0), 'bad') });
    if (rnd) s.facts.push({ l: 'Rounding-only differences', v: T(num(rnd, 0)) });
    const bd = blk(s, 'Original duration changes (working days)', ['ID', 'Activity', 'WBS', 'Previous (wd)', 'Current (wd)', 'Change', 'Hours in XER', 'Calendar hours/day', 'Planned finish (target)', 'Likely cause'], du.map(x => x[0]), { num: [3, 4] });
    bd.note = 'Working days = duration hours ÷ the activity calendar\'s hours per day.' + (silly ? ' Values in red are longer than the whole project – they usually mean the planned (target) finish in that XER is a placeholder date far in the future, so the stored duration is stretched to reach it (see the last two columns). This is a data issue in the file, not a real change of scope.' : '') + ' Duration here is the planned (target) duration, not the remaining duration.';
  }

  /* 5 baseline (target) dates and constraints */
  { const s = sec('base', 'Planned dates and constraints', 'Target (baseline) dates should not move in an update; constraints should be rare and justified.');
    const tg = [], cs = []; const ctext = (ty, d) => ty ? ty.replace('CS_', '') + (d != null ? ' ' + dd(d) : '') : 'None';
    for (const [a, b] of both) {
      if (a.ts !== b.ts || a.te !== b.te) tg.push([a.code, a.name, dd(a.ts), dd(b.ts), dayDelta(a.ts, b.ts), dd(a.te), dd(b.te), dayDelta(a.te, b.te)]);
      const ca = ctext(a.cstrType, a.cstrDate) + (a.cstrType2 ? ' + ' + ctext(a.cstrType2, a.cstrDate2) : ''), cb = ctext(b.cstrType, b.cstrDate) + (b.cstrType2 ? ' + ' + ctext(b.cstrType2, b.cstrDate2) : ''); if (ca !== cb) cs.push([a.code, a.name, ca, cb]);
    }
    s.facts.push({ l: 'Target dates changed', v: T(num(tg.length, 0), tg.length ? 'bad' : 'ok') }, { l: 'Constraints changed', v: T(num(cs.length, 0), cs.length ? 'bad' : 'ok') });
    blk(s, 'Target (baseline) start / finish changed', ['ID', 'Activity', 'Start – previous', 'Start – current', 'Δ start', 'Finish – previous', 'Finish – current', 'Δ finish'], tg);
    blk(s, 'Constraints added, removed or changed', ['ID', 'Activity', 'Previous', 'Current'], cs);
  }

  /* 6 progress */
  { const s = sec('prog', 'Progress and status', 'Status, actual dates and percent complete of activities present in both files.');
    const st = [], ac = []; let started = 0, done = 0, back = 0, pctUp = 0;
    for (const [a, b] of both) {
      const ra = rawA.get(a.code) || {}, rb = rawB.get(a.code) || {}; const pa = parseFloat(ra.phys_complete_pct || '0') || 0, pb = parseFloat(rb.phys_complete_pct || '0') || 0; if (pb > pa) pctUp++;
      if (a.status !== b.status) { const rk = { TK_NotStart: 0, TK_Active: 1, TK_Complete: 2 }; const bk = rk[b.status] < rk[a.status]; if (bk) back++; else if (b.status === 'TK_Active') started++; else if (b.status === 'TK_Complete') done++;
        st.push([a.code, a.name, E.STATUS[a.status] || a.status, T(E.STATUS[b.status] || b.status, bk ? 'bad' : (b.status === 'TK_Complete' ? 'ok' : 'info')), dd(b.as), dd(b.af), num(pb, 0) + '%']); }
      else if ((a.as != null && a.as !== b.as) || (a.af != null && a.af !== b.af)) ac.push([a.code, a.name, dd(a.as), dd(b.as), dayDelta(a.as, b.as), dd(a.af), dd(b.af), dayDelta(a.af, b.af)]);
    }
    s.facts.push({ l: 'Data date moved by', v: R.overview.dataDelta == null ? T('–') : T('+' + R.overview.dataDelta + ' d', 'info') }, { l: 'Newly started', v: T(num(started, 0), started ? 'info' : '') }, { l: 'Newly completed', v: T(num(done, 0), done ? 'ok' : '') }, { l: 'Status went backwards', v: T(num(back, 0), back ? 'bad' : 'ok') }, { l: 'Percent complete increased', v: T(num(pctUp, 0)) });
    blk(s, 'Status changes', ['ID', 'Activity', 'Previous status', 'Current status', 'Actual start', 'Actual finish', '% complete'], st, { num: [6] });
    blk(s, 'Actual dates altered after being recorded', ['ID', 'Activity', 'Actual start – previous', 'Actual start – current', 'Δ', 'Actual finish – previous', 'Actual finish – current', 'Δ'], ac);
  }

  /* 7 relationships */
  { const s = sec('logic', 'Relationships (logic)', 'Links are matched by predecessor and successor Activity IDs.');
    const grp = M => { const g = new Map(); for (const l of M.links) { const k = l.from.code + '\u0001' + l.to.code; (g.get(k) || g.set(k, []).get(k)).push(l); } return g; };
    const gA = grp(A), gB = grp(B); const add = [], del = [], chg = []; const sig = l => l.type + '|' + r1(l.lagWd); const lt = l => l.type + (l.lagWd ? ' ' + (l.lagWd > 0 ? '+' : '') + r1(l.lagWd) + 'd' : '');
    const note = (a, b) => [(!bB.has(a) ? 'predecessor deleted' : !bA.has(a) ? 'new predecessor' : ''), (!bB.has(b) ? 'successor deleted' : !bA.has(b) ? 'new successor' : '')].filter(Boolean).join(', ');
    for (const [k, ls] of gB) { const [f, t] = k.split('\u0001'); const o = gA.get(k); if (!o) { ls.forEach(l => add.push([f, l.from.name, t, l.to.name, lt(l), note(f, t)])); continue; }
      const sa = o.map(sig).sort().join(), sb = ls.map(sig).sort().join(); if (sa === sb) continue;
      if (o.length === 1 && ls.length === 1) chg.push([f, o[0].from.name, t, o[0].to.name, lt(o[0]), lt(ls[0]), o[0].type !== ls[0].type ? 'type changed' : 'lag changed']);
      else { const A2 = new Set(o.map(sig)), B2 = new Set(ls.map(sig)); ls.forEach(l => { if (!A2.has(sig(l))) add.push([f, l.from.name, t, l.to.name, lt(l), 'additional link between the same two activities']); }); o.forEach(l => { if (!B2.has(sig(l))) del.push([f, l.from.name, t, l.to.name, lt(l), 'link removed between the same two activities']); }); } }
    for (const [k, ls] of gA) { if (gB.has(k)) continue; const [f, t] = k.split('\u0001'); ls.forEach(l => del.push([f, l.from.name, t, l.to.name, lt(l), note(f, t)])); }
    const pick = rows => rows.filter(r => !r[5] || r[5].indexOf('new ') !== 0 && r[5].indexOf('deleted') < 0).length;
    s.facts.push({ l: 'Links added', v: T(num(add.length, 0), add.length ? 'info' : '') }, { l: 'Links deleted', v: T(num(del.length, 0), del.length ? 'bad' : '') }, { l: 'Type or lag changed', v: T(num(chg.length, 0), chg.length ? 'info' : '') }, { l: 'Net change in links', v: numDelta(A.links.length, B.links.length, 0) });
    blk(s, 'Links added', ['Predecessor', 'Predecessor name', 'Successor', 'Successor name', 'Type / lag', 'Note'], add);
    blk(s, 'Links deleted', ['Predecessor', 'Predecessor name', 'Successor', 'Successor name', 'Type / lag', 'Note'], del);
    blk(s, 'Type or lag changed', ['Predecessor', 'Predecessor name', 'Successor', 'Successor name', 'Previous', 'Current', 'What changed'], chg);
  }

  /* 8 critical path and float */
  { const s = sec('crit', 'Critical path and float', 'Critical = total float of zero or less on an activity not yet completed. Float changes of ' + nearCrit + ' calendar days or more are listed.');
    const rows = []; let became = 0, left = 0, ca = A.tasks.filter(isCrit).length, cb = B.tasks.filter(isCrit).length;
    for (const [a, b] of both) { const x = isCrit(a), y = isCrit(b); const fa = a.tfCal == null ? null : r1(a.tfCal), fb = b.tfCal == null ? null : r1(b.tfCal); const d = (fa != null && fb != null) ? r1(fb - fa) : null;
      if (!x && y) { became++; rows.push([[a.code, a.name, a.wbsPath, T('Became critical', 'bad'), num(fa), num(fb), numDelta(fa, fb, 1)], 3, Math.abs(d || 0)]); }
      else if (x && !y) { left++; rows.push([[a.code, a.name, a.wbsPath, T('No longer critical', 'ok'), num(fa), num(fb), numDelta(fa, fb, 1)], 2, Math.abs(d || 0)]); }
      else if (d != null && Math.abs(d) >= nearCrit) rows.push([[a.code, a.name, a.wbsPath, T('Float changed', 'info'), num(fa), num(fb), numDelta(fa, fb, 1)], 1, Math.abs(d)]); }
    rows.sort((p, q) => q[1] - p[1] || q[2] - p[2]);
    s.facts.push({ l: 'Critical activities', v: T(num(ca, 0) + ' → ' + num(cb, 0), cb > ca ? 'bad' : cb < ca ? 'ok' : '') }, { l: 'Became critical', v: T(num(became, 0), became ? 'bad' : '') }, { l: 'No longer critical', v: T(num(left, 0), left ? 'ok' : '') });
    blk(s, 'Critical path and float movement (calendar days)', ['ID', 'Activity', 'WBS', 'Change', 'Float – previous', 'Float – current', 'Δ float'], rows.map(x => x[0]), { num: [4, 5] });
  }

  /* 9 calendars */
  { const s = sec('cal', 'Calendars', 'Calendars are matched by name.');
    const nmA = new Map(Object.values(A.cal).map(c => [c.name, c])), nmB = new Map(Object.values(B.cal).map(c => [c.name, c])); const rows = []; let n = 0;
    const exDiff = (x, y) => { let ad = 0, rm = 0; y.ex.forEach((v, k) => { if (!x.ex.has(k) || x.ex.get(k) !== v) ad++; }); x.ex.forEach((v, k) => { if (!y.ex.has(k) || y.ex.get(k) !== v) rm++; }); return { ad, rm }; };
    for (const [name, b] of nmB) { const a = nmA.get(name); if (!a) { rows.push([name, T('Added', 'info'), '', E.weekText(b), b.dayHr, b.ex.size]); n++; continue; }
      const d = exDiff(a, b); const ch = E.weekText(a) !== E.weekText(b) || a.dayHr !== b.dayHr || d.ad || d.rm; if (ch) { n++; rows.push([name, T('Changed', 'bad'), E.weekText(a), E.weekText(b), a.dayHr + ' → ' + b.dayHr, a.ex.size + ' → ' + b.ex.size + (d.ad || d.rm ? '  (+' + d.ad + ' / −' + d.rm + ' days)' : '')]); } }
    for (const [name, a] of nmA) if (!nmB.has(name)) { n++; rows.push([name, T('Removed', 'bad'), E.weekText(a), '', a.dayHr, a.ex.size]); }
    const ch2 = []; for (const [a, b] of both) { const ca = (A.cal[a.clndr] || {}).name, cb = (B.cal[b.clndr] || {}).name; if (ca !== cb) ch2.push([a.code, a.name, ca || '', cb || '']); }
    s.facts.push({ l: 'Calendars changed / added / removed', v: T(num(n, 0), n ? 'info' : '') }, { l: 'Activities on a different calendar', v: T(num(ch2.length, 0), ch2.length ? 'bad' : 'ok') });
    blk(s, 'Calendar definitions', ['Calendar', 'Status', 'Working week – previous', 'Working week – current', 'Hours per day', 'Exception days'], rows);
    blk(s, 'Activities assigned to a different calendar', ['ID', 'Activity', 'Previous calendar', 'Current calendar'], ch2);
  }

  /* 10 resources and cost */
  { const s = sec('res', 'Resources and cost', 'Resources are matched by name; budget by activity uses the cost carried on the assignments (or the units of the BOQ cost resource when cost is zero).');
    const tot = M => { const m = new Map(); for (const a of M.asg) { const r = M.rsrc[a.rsrc] || { name: String(a.rsrc), type: '' }; const o = m.get(r.name) || { type: r.type, n: 0, q: 0, c: 0 }; o.n++; o.q += a.qty; o.c += a.cost; m.set(r.name, o); } return m; };
    const tA = tot(A), tB = tot(B), names = [...new Set([...tA.keys(), ...tB.keys()])]; const rows = []; let n = 0;
    for (const k of names) { const a = tA.get(k) || { n: 0, q: 0, c: 0 }, b = tB.get(k) || { n: 0, q: 0, c: 0 }; const st = !tA.has(k) ? T('Added', 'info') : !tB.has(k) ? T('Removed', 'bad') : (Math.abs(a.q - b.q) > 0.5 || Math.abs(a.c - b.c) > 0.5 || a.n !== b.n ? T('Changed', 'info') : ''); if (st) n++;
      rows.push([k, E.RT[(tB.get(k) || tA.get(k)).type] || '', st, num(a.q, 0), num(b.q, 0), numDelta(a.q, b.q, 0), num(a.c, 0), num(b.c, 0), numDelta(a.c, b.c, 0), num(a.n, 0) + ' → ' + num(b.n, 0)]); }
    rows.sort((x, y) => (y[2] ? 1 : 0) - (x[2] ? 1 : 0));
    const bud = []; for (const [a, b] of both) { const x = bgA.byCode.get(a.code) || 0, y = bgB.byCode.get(b.code) || 0; if (Math.abs(x - y) > 0.5) bud.push([[a.code, a.name, a.wbsPath, num(x, 0), num(y, 0), numDelta(x, y, 0)], Math.abs(y - x)]); }
    bud.sort((p, q) => q[1] - p[1]);
    s.facts.push({ l: 'Budget', v: T(num(bgA.total, 0) + ' → ' + num(bgB.total, 0), Math.abs(bgB.total - bgA.total) > 0.5 ? 'bad' : 'ok') }, { l: 'Resources changed / added / removed', v: T(num(n, 0), n ? 'info' : '') }, { l: 'Activities with a different budget', v: T(num(bud.length, 0), bud.length ? 'bad' : 'ok') });
    if (bgA.mode !== bgB.mode) s.facts.push({ l: 'Note', v: T('The budget is carried differently in the two files (cost vs units).', 'bad') });
    blk(s, 'Resource totals', ['Resource', 'Type', 'Status', 'Units – previous', 'Units – current', 'Δ units', 'Cost – previous', 'Cost – current', 'Δ cost', 'Assignments'], rows, { num: [3, 4, 5, 6, 7, 8], counts: false }); s.count += n;
    blk(s, 'Activities whose budget changed (largest first)', ['ID', 'Activity', 'WBS', 'Previous', 'Current', 'Change'], bud.map(x => x[0]), { num: [3, 4, 5] });
  }

  /* 11 WBS */
  { const s = sec('wbs', 'WBS structure', 'WBS elements are matched by their full path.');
    const pth = M => { const m = new Map(); for (const w of Object.values(M.wbs)) { if (!w.parent) continue; m.set(w.path.join(' / '), 0); } for (const t of M.tasks) { const w = M.wbs[t.wbs]; if (w) { const k = w.path.join(' / '); m.set(k, (m.get(k) || 0) + 1); } } return m; };
    const pA = pth(A), pB = pth(B); const add = [], del = [], mv = [];
    for (const [k, n] of pB) if (!pA.has(k)) add.push([k.replace(/^[^/]*\/ ?/, ''), n]); for (const [k, n] of pA) if (!pB.has(k)) del.push([k.replace(/^[^/]*\/ ?/, ''), n]);
    for (const [a, b] of both) if (a.wbsPath !== b.wbsPath) mv.push([a.code, a.name, a.wbsPath, b.wbsPath]);
    s.facts.push({ l: 'WBS elements added', v: T(num(add.length, 0), add.length ? 'info' : '') }, { l: 'WBS elements removed', v: T(num(del.length, 0), del.length ? 'bad' : '') }, { l: 'Activities moved to another WBS', v: T(num(mv.length, 0), mv.length ? 'bad' : 'ok') });
    blk(s, 'WBS elements added', ['WBS path', 'Activities'], add, { num: [1] }); blk(s, 'WBS elements removed', ['WBS path', 'Activities'], del, { num: [1] });
    blk(s, 'Activities moved to a different WBS', ['ID', 'Activity', 'Previous WBS', 'Current WBS'], mv);
  }

  /* 12 activity codes */
  { const s = sec('codes', 'Activity codes', 'Code values on each activity present in both files.');
    const tyA = new Set(Object.values(A.codeTypes || {})), tyB = new Set(Object.values(B.codeTypes || {})); const rows = [];
    for (const [a, b] of both) { const ks = new Set([...Object.keys(a.codes), ...Object.keys(b.codes)]); for (const k of ks) { const x = a.codes[k], y = b.codes[k]; const vx = x ? (x.short || x.name) : '', vy = y ? (y.short || y.name) : ''; if (vx !== vy) rows.push([a.code, a.name, k, vx || '(none)', vy || '(none)']); } }
    const addT = [...tyB].filter(x => !tyA.has(x)), delT = [...tyA].filter(x => !tyB.has(x));
    s.facts.push({ l: 'Code values changed', v: T(num(rows.length, 0), rows.length ? 'info' : 'ok') }, { l: 'Code types added', v: T(addT.length ? addT.join(', ') : '0', addT.length ? 'info' : '') }, { l: 'Code types removed', v: T(delT.length ? delT.join(', ') : '0', delT.length ? 'bad' : '') });
    blk(s, 'Code assignments changed', ['ID', 'Activity', 'Code type', 'Previous', 'Current'], rows);
  }
  /* key changes: relationships, added / deleted activities, original durations – flagged by what they could do to the schedule */
  { const s = sec('key', 'Changes to look at first', 'Changes to relationships, added or deleted activities and original durations, flagged by what they could do to the schedule. Critical and near-critical (float of ' + nearCrit + ' calendar days or less) work comes first. The full lists are in the sections below. A flag means "check with the contractor", not that the change is wrong.');
    const nearC = t => t && t.tfCal != null && t.tfCal <= nearCrit && t.status !== 'TK_Complete', cr = t => !t ? '' : isCrit(t) ? 'Critical' : nearC(t) ? 'Near-critical' : '', tone = x => x === 'Critical' ? 'bad' : x === 'Near-critical' ? 'info' : '', rank = x => x === 'Critical' ? 0 : x === 'Near-critical' ? 1 : 2;
    const lt = l => l.type + (l.lagWd ? ' ' + (l.lagWd > 0 ? '+' : '') + r1(l.lagWd) + 'd' : '');
    const pairs = M => { const g = new Map(); for (const l of M.links) { const k = l.from.code + '\u0001' + l.to.code; (g.get(k) || g.set(k, []).get(k)).push(l); } return g; };
    const pA = pairs(A), pB = pairs(B), done = t => t && t.status === 'TK_Complete';
    const dels = [], rel = [], adds = [], fl = t => (t.tfCal == null ? '' : num(t.tfCal));
    for (const [k, ls] of pA) { const [f, t] = k.split('\u0001'); if (pB.has(k)) { const nb = pB.get(k), a0 = ls[0], b0 = nb[0], tb = bB.get(t); if (done(tb)) continue; const relaxed = (a0.type === 'FS' && (b0.type === 'SS' || b0.type === 'FF')) || (a0.type === b0.type && b0.lagWd < a0.lagWd - 0.01);
        if (relaxed) { const c = cr(tb); rel.push([[f, a0.from.name, t, a0.to.name, lt(a0), lt(b0), T(c || 'Not critical', tone(c)), fl(tb)], rank(c), a0.lagWd - b0.lagWd]); } continue; }
      const ta = bA.get(t), tb = bB.get(t); if (!tb || done(tb) || !bB.has(f)) continue; const c = cr(tb); dels.push([[f, ls[0].from.name, t, ls[0].to.name, ls.map(lt).join(', '), T(c || 'Not critical', tone(c)), fl(ta) + ' → ' + fl(tb)], rank(c)]); }
    for (const [k, ls] of pB) { if (pA.has(k)) continue; const [f, t] = k.split('\u0001'); if (!bA.has(f) || !bA.has(t)) continue; const tb = bB.get(t); if (done(tb)) continue; const c = cr(tb); if (!c) continue; adds.push([[f, ls[0].from.name, t, ls[0].to.name, ls.map(lt).join(', '), T(c, tone(c)), fl(tb)], rank(c)]); }
    const sortR = a => a.sort((x, y) => x[1] - y[1]).map(x => x[0]);
    rel.sort((x, y) => x[1] - y[1] || y[2] - x[2]); dels.sort((x, y) => x[1] - y[1]);
    const newA = B.tasks.filter(t => !bA.has(t.code)).map(t => { const c = cr(t); return [[t.code, t.name, t.wbsPath, num(t.durWd), dd(t.es), dd(t.ef), c ? T(c, tone(c)) : '', bgB.byCode.get(t.code) ? num(bgB.byCode.get(t.code), 0) : ''], rank(c), t.durWd || 0]; }).sort((x, y) => x[1] - y[1] || y[2] - x[2]);
    const delA = A.tasks.filter(t => !bB.has(t.code)).map(t => { const c = t.status === 'TK_Complete' ? '' : cr(t); const st = t.status === 'TK_Complete' ? 'Completed' : t.status === 'TK_Active' ? 'In progress' : 'Not started'; return [[t.code, t.name, t.wbsPath, st, num(t.durWd), bgA.byCode.get(t.code) ? num(bgA.byCode.get(t.code), 0) : '', t.status === 'TK_Complete' ? '' : T(c || 'Scope removed', c ? tone(c) : 'bad')], t.status === 'TK_Complete' ? 2 : rank(c), bgA.byCode.get(t.code) || 0]; }).sort((x, y) => x[1] - y[1] || y[2] - x[2]);
    const dShort = [], dLong = [];
    for (const [a, b] of both) { if (a.durWd == null || b.durWd == null) continue; const d = r1(b.durWd - a.durWd); if (Math.abs(d) < 0.5 || a.isMile || b.isMile) continue; const c = cr(b), sa = a.status;
      if (d < 0 && sa === 'TK_NotStart') dShort.push([[a.code, a.name, a.wbsPath, num(r1(a.durWd)), num(r1(b.durWd)), T(num(d), 'ok'), c ? T(c, tone(c)) : ''], rank(c), d]);
      else if (d > 0 && c) dLong.push([[a.code, a.name, a.wbsPath, num(r1(a.durWd)), num(r1(b.durWd)), T('+' + num(d), 'bad'), T(c, tone(c))], rank(c), -d]); }
    dShort.sort((x, y) => x[1] - y[1] || x[2] - y[2]); dLong.sort((x, y) => x[1] - y[1] || x[2] - y[2]);
    const nCritDel = dels.filter(x => x[1] < 2).length, nCritRel = rel.filter(x => x[1] < 2).length, delOpen = delA.filter(x => x[1] < 2 || x[0][3] !== 'Completed').length;
    s.facts.push({ l: 'Links removed on work not complete', v: T(num(dels.length, 0) + (nCritDel ? ' (' + nCritDel + ' critical or near-critical)' : ''), nCritDel ? 'bad' : dels.length ? 'info' : '') }, { l: 'Logic relaxed (type or lag)', v: T(num(rel.length, 0) + (nCritRel ? ' (' + nCritRel + ' critical or near-critical)' : ''), nCritRel ? 'bad' : rel.length ? 'info' : '') }, { l: 'Links added on critical work', v: T(num(adds.length, 0), adds.length ? 'info' : '') }, { l: 'Activities added', v: T(num(newA.length, 0), newA.length ? 'info' : '') }, { l: 'Activities deleted (not complete)', v: T(num(delOpen, 0), delOpen ? 'bad' : '') }, { l: 'Durations shortened (not started)', v: T(num(dShort.length, 0), dShort.length ? 'info' : '') }, { l: 'Durations lengthened (critical)', v: T(num(dLong.length, 0), dLong.length ? 'bad' : '') });
    const LC = ['Predecessor', 'Predecessor name', 'Successor', 'Successor name'];
    blk(s, 'Links removed on work that is not complete', [...LC, 'Type / lag removed', 'Successor is', 'Float of successor (cal. days)'], dels.map(x => x[0]), { counts: false, note: 'The link between these two activities no longer exists. Removing a predecessor lets the successor start earlier and can shorten the programme without any real change on site.' });
    blk(s, 'Logic relaxed: finish-to-start changed to start-to-start or finish-to-finish, or lag reduced', [...LC, 'Previous', 'Current', 'Successor is', 'Float (cal. days)'], rel.map(x => x[0]), { counts: false });
    blk(s, 'Links added to critical or near-critical activities', [...LC, 'Type / lag', 'Successor is', 'Float (cal. days)'], sortR(adds), { counts: false, note: 'New logic on the critical path can add delay or can correct missing logic; check which.' });
    blk(s, 'Activities added (critical first)', ['ID', 'Activity', 'WBS', 'Duration (wd)', 'Start', 'Finish', 'Flag', 'Budget (SAR)'], newA.map(x => x[0]), { counts: false, num: [3, 7] });
    blk(s, 'Activities deleted (not complete first)', ['ID', 'Activity', 'WBS', 'Status (previous)', 'Duration (wd)', 'Budget (SAR)', 'Flag'], delA.map(x => x[0]), { counts: false, num: [4, 5], note: 'A deleted activity that was not complete means scope or logic left the programme. Compare with the budget column.' });
    blk(s, 'Original duration shortened on activities not started', ['ID', 'Activity', 'WBS', 'Previous (wd)', 'Current (wd)', 'Change', 'Flag'], dShort.map(x => x[0]), { counts: false, num: [3, 4], note: 'A shorter duration on work that has not started makes the finish earlier on paper. Check whether the production rate or the crews support it.' });
    blk(s, 'Original duration lengthened on critical or near-critical activities', ['ID', 'Activity', 'WBS', 'Previous (wd)', 'Current (wd)', 'Change', 'Flag'], dLong.map(x => x[0]), { counts: false, num: [3, 4] });
    s.count = dels.length + rel.length + adds.length + delOpen + dShort.length + dLong.length;
    R.keyCounts = { dels: dels.length, delsCrit: nCritDel, rel: rel.length, relCrit: nCritRel, adds: adds.length, actsAdded: newA.length, actsDel: delOpen, dShort: dShort.length, dLong: dLong.length };
    const ix = R.sections.indexOf(s); R.sections.splice(ix, 1); R.sections.splice(1, 0, s); }
  if (E.delayAnalysis) { try { E.delayAnalysis(R, { A, B, sec, blk, T, num, r1, dd, isCrit, bA, bB, both, rawB, opt }); const ks = R.sections.filter(s => ['delay', 'recov', 'request'].includes(s.key)); ks.forEach(s => R.sections.splice(R.sections.indexOf(s), 1)); R.sections.splice(2, 0, ...ks); } catch (e) { console.error(e); R.delayError = e.message; } }
  if (E.updateChecks) { try { const us = E.updateChecks(R, { A, B, sec, blk, T, num, r1, dd, isCrit, both, rawB, opt }); if (us) { R.sections.splice(R.sections.indexOf(us), 1); const at = R.sections.findIndex(x => x.key === 'request'); R.sections.splice(at >= 0 ? at + 1 : 2, 0, us); } } catch (e) { console.error(e); R.updError = e.message; } }
  R.total = R.sections.filter(s => !['over', 'key', 'delay', 'recov', 'request', 'upd'].includes(s.key)).reduce((n, s) => n + s.count, 0);
  return R;
};
