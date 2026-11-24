/* ===== ENGINE PART 2: checks ===== */
E.defaultCfg = () => ({
  projectName: '', projectNo: '', contractValue: null, durationValue: null, durationUnit: 'months', ntp: '', ntpTol: 0, finishTol: 1,
  milestones: [], reviewDays: null, projectType: 'infrastructure', fileType: 'baseline',
  weights: { engineering: 7, procurement: 13, construction: 75, handover: 5 },
  weightGroup: { general: 'engineering', mobilization: 'engineering', engineering: 'engineering', procurement: 'procurement', delivery: 'procurement', construction: 'construction', closeout: 'handover' },
  floatLimit: 60, stdDayHr: 8, maxWeekHr: 60, fridayOff: true, cmpMinShared: 30, rpPaths: 3, rpLeftPct: 55, rpLabW: 170, rpZoom: 100, rpCard: 'A', rpDDMode: 'align', rpOpenPer: 12, rp6MonthW: 34, rpPrio: true, rpNowDays: 7, rpSoonDays: 30, rpShowLater: false, rpWheelZoom: 'no', rpFloatUnit: 'cd', rpShowLoc: 'yes', rpViewDefault: 'cards', rpMatchMin: 30, rpMatchWarn: 80, navTips: true, navTipDelay: 300, ramadanNormal: true, durLimit: 60, reportingPeriod: 30, maxFsLag: 0, nearCrit: 10, costTol: 0.1, weightTol: 0.5, curveTol: 10,
  approvalExclude: 'shop ?draw|material|submittal|sample|mock-?up|method statement|as-?built',
  calRules: { general: 6, mobilization: 6, engineering: 6, procurement: 6, delivery: 7, construction: 6, closeout: 6, approval: 5 },
  wbsMap: null, approvalIds: null, rsrc: { progress: null, cost: null }, projFinishId: null,
  noEquipRegex: 'survey|leakage', outputFactor: 3, idRegex: '^[^-]+-([A-Za-z]+)-(Z[A-Za-z0-9]+)-([A-Za-z&]+)(\\d+)', examples: 3,
  curveTimePct: 70, curveRemainMax: 40, curveCgMax: 55, curveMonthMult: 2, loadFrontPct: 30, loadFrontMax: 35, loadCgMin: 45,
  eid: [], holidayCalsExclude: [], ai: { on: false, key: '', models: {} },
  disciplineWords: {
    drainage: 'drain|catch ?basin|storm|\\bDR\\b', sewer: 'sewer|sewage|\\bSW\\b', irrigation: 'irrigat|\\bIRR\\b|\\bTSE\\b',
    potable: 'potable|\\bPW\\b|\\bDW\\b|water supply', fire: 'fire ?fight|\\bFF\\b|hydrant', electrical: 'electric|cable|\\bEL\\b|\\bMV\\b|\\bLV\\b|substation|13\\.8',
    ict: '\\bICT|telecom|fib(?:er|re)|duct bank', lighting: 'street ?light|lighting|\\bSL\\b', paving: 'pav(?:ing|ement)|kerb|asphalt|interlock|R&P|sidewalk|tile'
  },
  docs: {}, boq: null, mapping: null
});

E.EID_APPROX = { 'Eid al-Fitr': { 2026: '2026-03-20', 2027: '2027-03-09', 2028: '2028-02-26', 2029: '2029-02-14', 2030: '2030-02-04', 2031: '2031-01-24', 2032: '2032-01-14' }, 'Eid al-Adha': { 2026: '2026-05-27', 2027: '2027-05-16', 2028: '2028-05-05', 2029: '2029-04-24', 2030: '2030-04-13', 2031: '2031-04-02', 2032: '2032-03-22' } };
E.FIXED_HOLIDAYS = [{ m: 9, d: 23, name: 'Saudi National Day' }, { m: 2, d: 22, name: 'Founding Day' }];

E.run = function (M, cfg) {
  const out = { results: [], needEid: [], notes: [] };
  const R = out.results;
  const add = (o) => { R.push(Object.assign({ status: 'pass', tier: 'normal', count: 0, items: [], evidence: [], single: false, action: '', why: '', source: '' }, o)); return R[R.length - 1]; };
  const row = (t, field, value, note) => ({ id: t.code, name: t.name, wbs: t.wbsPath, field: field || '', value: value == null ? '' : String(value), note: note || '' });
  const fx = (r, l, kind) => { r.fix = E.fixLink(l, kind); return r; };
  const lrow = (l, field, value, note) => ({ id: l.from.code + ' → ' + l.to.code, name: l.from.name + ' → ' + l.to.name, wbs: l.from.wbsPath, field: field || '', value: value == null ? '' : String(value), note: note || '', link: true, pred: l.from.code, predName: l.from.name, predWbs: l.from.wbsPath, succ: l.to.code, succName: l.to.name, succWbs: l.to.wbsPath, type: l.type, lag: Math.round((l.lagWd || 0) * 10) / 10 });
  const r1 = x => Math.round(x * 10) / 10;
  const num = x => (x == null || isNaN(x)) ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const T = M.tasks, nonMile = T.filter(t => !t.isMile);
  /* v6.8: logic, zero-duration, float and duration checks look at live work only: not level-of-effort, WBS-summary or completed activities */
  const liveT = T.filter(t => t.type !== 'TT_LOE' && t.type !== 'TT_WBS' && t.status !== 'TK_Complete'), liveNM = liveT.filter(t => !t.isMile);
  const ntp = cfg.ntp ? E.strToDay(cfg.ntp) : null;
  const approvalSet = new Set(cfg.approvalIds || []);
  const finish = cfg.projFinishId ? M.byId[cfg.projFinishId] : (T.filter(t => t.isFinMile).sort((a, b) => (b.ef || 0) - (a.ef || 0) || (/complet|finish/i.test(b.name) ? 1 : 0) - (/complet|finish/i.test(a.name) ? 1 : 0))[0] || T.slice().sort((a, b) => (b.ef || 0) - (a.ef || 0))[0]);
  out.finish = finish;
  const startMiles = T.filter(t => t.type === 'TT_Mile');
  const idRx = (() => { try { return new RegExp(cfg.idRegex); } catch (e) { return null; } })();
  const parseId = t => { const m = idRx && idRx.exec(t.code); return m ? { phase: m[1], zone: (m[2] || '').replace(/^Z/i, '').toUpperCase(), disc: m[3] } : null; };
  M.parseId = parseId;
  const zoneFromText = s => {
    const set = new Set(); let m;
    const r = /zone\s*-?\s*([A-Z][0-9]?(?:\s*,\s*[A-Z][0-9]?)*)/gi; while ((m = r.exec(s))) m[1].split(',').forEach(x => set.add(x.trim()[0].toUpperCase()));
    const r2 = /(?:^|\/\s*)Z\s+([A-Z])\b/g; while ((m = r2.exec(s))) set.add(m[1].toUpperCase());
    return set;
  };
  const roadsFromText = s => { const set = new Set(); let m; const r = /\broad\s*-?\s*(\d{1,3}[A-Z]?)\b/gi; while ((m = r.exec(s))) set.add(m[1].toUpperCase()); const r2 = /\bR-?(\d{1,3})\b/g; while ((m = r2.exec(s))) set.add(m[1]); return set; };
  const zoneOf = t => { const p = parseId(t); if (p && p.zone) return 'Zone ' + p.zone[0]; const z = zoneFromText(t.wbsPath); return z.size ? 'Zone ' + [...z][0] : 'General'; };
  M.zoneOf = zoneOf;
  const dwords = {}; for (const k in cfg.disciplineWords) dwords[k] = new RegExp(cfg.disciplineWords[k], 'i');
  const famOf = s => { const f = new Set(); for (const k in dwords) if (dwords[k].test(s)) f.add(k); return f; };
  const inter = (a, b) => [...a].some(x => b.has(x));

  /* ================= CONTRACT & TIME ================= */
  { // C1 start date
    const c = add({ id: 'T1', group: 'Contract & time', title: 'Project start date matches the Notice to Proceed', rule: 'The earliest activity start must equal the commencement date given in the contract / NTP.', source: 'Contract Agreement – commencement date' });
    if (!ntp) { c.status = 'notrun'; c.summary = 'NTP / commencement date not entered in project setup.'; }
    else {
      const diff = M.minES - ntp; c.single = true;
      c.evidence = ['Earliest activity start in schedule: ' + E.fmtDate(M.minES), 'NTP / commencement date (entered): ' + E.fmtDate(ntp), 'Difference: ' + diff + ' day(s) (tolerance ' + cfg.ntpTol + ')'];
      if (Math.abs(diff) > cfg.ntpTol) { c.status = 'fail'; c.count = 1; c.summary = 'Schedule starts ' + Math.abs(diff) + ' day(s) ' + (diff > 0 ? 'after' : 'before') + ' the NTP date.'; c.action = 'Start the programme on the NTP date and re-issue.'; }
      else c.summary = 'Start date agrees with NTP.';
    }
  }
  let completion = null;
  { // C2 completion
    const c = add({ id: 'T2', group: 'Contract & time', title: 'Project finish matches the contract duration', rule: 'Scheduled project finish must equal NTP plus the contract duration' + (cfg.floatClause ? ' (' + cfg.floatClause + ')' : '') + '.', source: 'Contract Agreement – time for completion' });
    if (!ntp || !cfg.durationValue) { c.status = 'notrun'; c.summary = 'Contract duration or NTP not entered.'; }
    else {
      completion = cfg.durationUnit === 'months' ? E.addMonths(ntp, +cfg.durationValue) - 1 : ntp + (+cfg.durationValue) - 1;
      const fin = finish ? finish.ef : M.maxEF; const diff = fin - completion; c.single = true;
      c.evidence = ['Scheduled project finish: ' + E.fmtDate(fin) + (finish ? ' (' + finish.code + ')' : ''), 'Contract completion (' + cfg.durationValue + ' ' + cfg.durationUnit + ' from NTP, last day inclusive): ' + E.fmtDate(completion), 'Difference: ' + diff + ' day(s) (tolerance ' + cfg.finishTol + ')'];
      if (Math.abs(diff) > cfg.finishTol) { c.status = 'fail'; c.count = 1; c.summary = 'Programme finishes ' + Math.abs(diff) + ' day(s) ' + (diff < 0 ? 'before' : 'after') + ' the contract completion date.'; c.action = diff < 0 ? 'The contractor may not hold programme float; extend to the contract date or confirm the planned early completion in writing.' : 'The programme overruns the contract completion date; recover or justify.'; }
      else c.summary = 'Finish date agrees with the contract duration.';
    }
  }
  { // C3 milestones
    const c = add({ id: 'T3', group: 'Contract & time', title: 'Contractual milestones are scheduled on their contract dates', rule: 'Each contractual milestone must exist in the schedule and fall on its contractual date.', source: (cfg.srcPC || 'Particular Conditions') + ' – milestones' });
    const ms = cfg.milestones || [];
    if (!ms.length) { c.status = 'notrun'; c.summary = 'No contractual milestones entered.'; }
    else {
      for (const m of ms) {
        const t = m.actId ? M.byId[m.actId] : null;
        const date = m.date ? E.strToDay(m.date) : (m.days != null && m.days !== '' && ntp ? ntp + (+m.days) : null);
        if (!t) { c.items.push({ id: '—', name: m.name, wbs: '', field: 'Milestone not mapped to an activity', value: '', note: 'Select the matching activity in Confirmations' }); continue; }
        if (date == null) continue;
        const d = t.ef - date;
        if (Math.abs(d) > cfg.finishTol) c.items.push({ id: t.code, name: m.name + ' → ' + t.name, wbs: t.wbsPath, field: 'Scheduled vs contract date', value: E.fmtDate(t.ef) + ' vs ' + E.fmtDate(date), note: d + ' day(s)' });
      }
      c.count = c.items.length; c.total = ms.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' of ' + ms.length + ' milestones do not agree.' : 'All milestones agree.';
      c.action = 'Schedule each milestone on its contractual date, with a date constraint where applicable.';
    }
  }
  { // C4 review periods
    const c = add({ id: 'T4', group: 'Contract & time', title: 'Approval durations match the contract review period', rule: 'Submittal/approval activities selected as ' + (cfg.approverLabel || 'KEC/authority') + ' approvals must carry the contractual review period.', source: (cfg.srcPC || 'Particular Conditions') + ' – review periods' });
    const ap = [...approvalSet].map(i => M.byId[i]).filter(Boolean);
    if (!cfg.reviewDays) { c.status = 'notrun'; c.summary = 'Contract review period not entered.'; }
    else if (!ap.length) { c.status = 'notrun'; c.summary = 'No approval activities selected.'; }
    else {
      for (const t of ap) if (t.durCal != null && Math.round(t.durCal) !== +cfg.reviewDays) c.items.push(row(t, 'Duration (calendar days)', r1(t.durCal), 'Contract period: ' + cfg.reviewDays));
      c.count = c.items.length; c.total = ap.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' approval activities differ from the ' + cfg.reviewDays + '-day review period.' : 'All approvals carry the contract review period.';
      c.action = 'Set approval durations to the contractual review period or justify the difference.';
    }
  }

  /* ================= LOGIC ================= */
  { // L1 open ends
    const c = add({ id: 'L1', group: 'Schedule logic', title: 'Open ends (no predecessor / no successor)', rule: 'Every activity must have a predecessor and a successor, except the project start and the project finish. An activity whose only successors are Start-to-Start, or only predecessors are Finish-to-Finish, is also open.' });
    for (const t of liveT) {
      if (!t.pre.length && !startMiles.includes(t)) c.items.push(row(t, 'Missing predecessor'));
      else if (t.pre.length && t.pre.every(l => l.type === 'FF') && !t.isMile) c.items.push(row(t, 'Open start', 'Only FF predecessors'));
      if (!t.succ.length && t !== finish) c.items.push(row(t, 'Missing successor'));
      else if (t.succ.length && t.succ.every(l => l.type === 'SS')) c.items.push(row(t, 'Open finish', 'Only SS successors'));
    }
    c.count = new Set(c.items.map(i => i.id)).size; c.total = liveT.length; c.status = c.items.length ? 'fail' : 'pass';
    c.summary = c.items.length ? c.count + ' activities have an open start or finish.' : 'No open ends.'; c.action = 'Link each listed activity to a real predecessor and successor.';
  }
  { // L2 relationship types
    const c = add({ id: 'L2', group: 'Schedule logic', title: 'Relationship types and overlap limits', rule: 'Start-to-Finish is not allowed. Start-to-Start lag must not exceed the predecessor duration; Finish-to-Finish lag must not exceed the successor duration.' });
    for (const l of M.links) {
      if (l.type === 'SF') c.items.push(fx(lrow(l, 'Start-to-Finish link', 'SF'), l, 'SF'));
      else if (l.type === 'SS' && l.lagWd > (l.from.durWd || 0) + 1e-6) c.items.push(fx(lrow(l, 'SS lag exceeds predecessor duration', r1(l.lagWd) + ' d > ' + r1(l.from.durWd) + ' d'), l, 'SSX'));
      else if (l.type === 'FF' && l.lagWd > (l.to.durWd || 0) + 1e-6) c.items.push(fx(lrow(l, 'FF lag exceeds successor duration', r1(l.lagWd) + ' d > ' + r1(l.to.durWd) + ' d'), l, 'FFX'));
    }
    c.count = c.items.length; c.total = M.links.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' links break the relationship rules.' : 'All relationship types acceptable.'; c.action = 'Remove SF links and reduce overlap lags to within the activity durations.';
  }
  { // L3 negative lags
    const c = add({ id: 'L3', group: 'Schedule logic', title: 'Negative lags (leads)', rule: 'Negative lags are not allowed.' });
    for (const l of M.links) if (l.lagWd < -1e-6) c.items.push(fx(lrow(l, l.type + ' lag', r1(l.lagWd) + ' d'), l, 'NEG'));
    c.count = c.items.length; c.total = M.links.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' links carry negative lags.' : 'No negative lags.'; c.action = 'Remove the lead and re-sequence the logic.';
  }
  { // L4 lags
    const c = add({ id: 'L4', group: 'Schedule logic', title: 'Positive lags on Finish-to-Start links', rule: 'Finish-to-Start lags above ' + cfg.maxFsLag + ' day(s) are not allowed; waiting time must be an explicit activity.' });
    for (const l of M.links) if (l.type === 'FS' && l.lagWd > cfg.maxFsLag + 1e-6) c.items.push(fx(lrow(l, 'FS lag', r1(l.lagWd) + ' d', 'Predecessor calendar'), l, 'FSLAG'));
    c.items.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    c.count = c.items.length; c.total = M.links.filter(l => l.type === 'FS').length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' FS links carry lags.' : 'No FS lags.'; c.action = 'Replace each lag with a named activity (e.g. curing, notice period) or remove it.';
  }
  { // L5 constraints
    const c = add({ id: 'L5', group: 'Schedule logic', title: 'Date constraints', rule: 'Constraints are acceptable only on the project start, project finish and contractual milestones, and their dates must match the contract.' });
    const okIds = new Set([...(cfg.milestones || []).map(m => m.actId).filter(Boolean), finish && finish.id, ...startMiles.map(t => t.id)]);
    const cs = T.filter(t => t.cstrType || t.cstrType2);
    for (const t of cs) if (!okIds.has(t.id)) { const ct = (t.cstrType || t.cstrType2).replace('CS_', ''); const hard = /MAND|^MSO$|^MEO$/.test(ct); c.items.push(Object.assign(row(t, 'Constraint', ct + ' ' + E.fmtDate(t.cstrDate || t.cstrDate2)), { fix: 'Remove the ' + ct + ' constraint and let the logic drive the date' + (hard ? ' (a mandatory date also overrides float and hides delay)' : '') + '. ' + (t.pre.length ? 'It already has predecessors, so link it properly instead.' : 'Add the predecessor it really waits for (approval, delivery, previous work).') + ' If the date is a contract milestone, keep the constraint only on a milestone that is on the contract milestone list and add the contract reference in its notes.' })); }
    c.count = c.items.length; c.total = cs.length; c.status = c.count ? 'fail' : 'pass';
    c.summary = cs.length === 0 ? 'No constraints used in the schedule.' : (c.count ? c.count + ' unauthorised constraints.' : 'Constraints only on allowed activities.'); c.action = 'Remove the constraints; drive dates by logic.';
    c.evidence = ['Constraints found: ' + cs.length];
  }
  { // L6 invalid links / loops
    const c = add({ id: 'L6', group: 'Schedule logic', title: 'Invalid links and circular logic', rule: 'Links must refer to existing activities, must not link an activity to itself, and the network must contain no loops.' });
    for (const p of M.badLinks) c.items.push({ id: p.task_id + ' ← ' + p.pred_task_id, name: 'Link refers to an activity that is not in the file', wbs: '', field: 'Invalid reference', value: p.pred_type, note: '', fix: 'Delete this relationship and re-link the activity to the correct predecessor (an activity from another project in the export is usually the cause: either include that project or replace the link with a milestone).' });
    for (const l of M.links) if (l.from === l.to) c.items.push(Object.assign(lrow(l, 'Self-link'), { fix: 'Delete the link; an activity cannot be its own predecessor.' }));
    // Tarjan iterative
    const idx = new Map(), low = new Map(), onS = new Set(), S = []; let n = 0; const sccs = [];
    for (const s of T) {
      if (idx.has(s)) continue;
      const stack = [[s, 0]]; idx.set(s, n); low.set(s, n); n++; S.push(s); onS.add(s);
      while (stack.length) {
        const top = stack[stack.length - 1], v = top[0];
        if (top[1] < v.succ.length) {
          const w = v.succ[top[1]++].to;
          if (!idx.has(w)) { idx.set(w, n); low.set(w, n); n++; S.push(w); onS.add(w); stack.push([w, 0]); }
          else if (onS.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        } else {
          stack.pop();
          if (stack.length) { const u = stack[stack.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
          if (low.get(v) === idx.get(v)) { const comp = []; let w; do { w = S.pop(); onS.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) sccs.push(comp); }
        }
      }
    }
    sccs.forEach((comp, i) => comp.forEach(t => c.items.push(row(t, 'In loop', 'Loop ' + (i + 1) + ' (' + comp.length + ' activities)'))));
    c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' invalid link / loop entries.' : 'No invalid links or loops.'; c.action = 'Correct the references and break the loops.';
  }
  { // L7 durations 0
    const c = add({ id: 'L7', group: 'Schedule logic', title: 'Zero-duration tasks and milestones with duration', rule: 'Tasks must have a duration above zero; milestones must have zero duration.' });
    for (const t of liveT) { if (!t.isMile && (t.durWd === 0)) c.items.push(row(t, 'Zero-duration task', '0 d')); if (t.isMile && t.durWd > 0) c.items.push(row(t, 'Milestone with duration', r1(t.durWd) + ' d')); }
    c.count = c.items.length; c.total = liveT.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities.' : 'None.'; c.action = 'Correct the activity type or duration.';
  }
  { // L8 float
    const c = add({ id: 'L8', group: 'Schedule logic', title: 'Excessive or negative float', rule: 'Total float (calendar days) must not exceed ' + cfg.floatLimit + ' days and must not be negative. Float definition in file: ' + (M.so.sched_float_type || 'n/a') + '.' });
    for (const t of liveNM) if (t.tfCal != null) { if (t.tfCal > cfg.floatLimit) c.items.push(row(t, 'Total float (cal. days)', r1(t.tfCal))); else if (t.tfCal < -1e-6) c.items.push(row(t, 'Negative float (cal. days)', r1(t.tfCal))); }
    c.items.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    c.count = c.items.length; c.total = liveNM.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities (' + r1(100 * c.count / liveNM.length) + '%) exceed the float limit or are negative.' : 'Float within limits.'; c.action = 'Tie the activities into logic so that float falls within the limit.';
  }
  { // L9 duration
    const c = add({ id: 'L9', group: 'Schedule logic', title: 'Long activity durations', rule: 'Activity duration must not exceed ' + cfg.durLimit + ' calendar days.' });
    for (const t of liveNM) if (t.durCal > cfg.durLimit) c.items.push(row(t, 'Duration (cal. days)', r1(t.durCal)));
    c.items.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    c.count = c.items.length; c.total = liveNM.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities exceed the duration limit.' : 'All durations within limit.'; c.action = 'Break the activities into shorter ones.';
  }

  /* ---- L10 calendars ---- */
  const calName = id => (M.cal[id] || {}).name || id;
  { // assignment
    const c = add({ id: 'L10a', group: 'Calendars', title: 'Activities use the calendar of their category', rule: 'Construction, engineering/submittals, mobilization and close-out: ' + cfg.calRules.construction + '-day week; selected ' + (cfg.approverLabel || 'KEC/authority') + ' approvals: ' + cfg.calRules.approval + '-day week (Fri & Sat off); material delivery: ' + cfg.calRules.delivery + '-day week. Category is taken from the WBS.', source: cfg.calClause || 'Particular Conditions A8.2' });
    for (const t of nonMile) {
      const key = approvalSet.has(t.id) ? 'approval' : t.cat; const want = cfg.calRules[key]; const cal = M.cal[t.clndr]; if (!cal || !want) continue;
      let ok = cal.wdw === want; if (ok && want === 5) ok = !cal.dow[6] && !cal.dow[7];
      if (!ok) c.items.push(row(t, 'Calendar (' + key + ')', calName(t.clndr) + ' = ' + cal.wdw + '-day', 'Expected ' + want + '-day' + (want === 5 ? ' (Fri & Sat off)' : '')));
    }
    c.count = c.items.length; c.total = nonMile.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities are on the wrong calendar.' : 'Calendars agree with categories.'; c.action = 'Assign the correct calendar to each activity.';
    const grp = {}; c.items.forEach(i => { const k = i.field + ' – found ' + i.value + ' (' + i.note + ')'; grp[k] = (grp[k] || 0) + 1; });
    c.evidence = Object.entries(grp).sort((a, b) => b[1] - a[1]).map(([k, n]) => n + ' × ' + k);
  }
  { // definitions
    const c = add({ id: 'L10b', group: 'Calendars', title: 'Calendar definitions', rule: 'Each calendar used must have a sensible working week.' });
    const used = new Set(T.map(t => t.clndr));
    for (const id of used) { const cal = M.cal[id]; if (!cal) { c.items.push({ id, name: 'Calendar missing from file', wbs: '', field: 'Calendar', value: id, note: '' }); continue; }
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((d, i) => cal.dow[i + 1]).join(' ');
      const n = T.filter(t => t.clndr === id).length;
      c.evidence.push(cal.name + ': ' + cal.wdw + '-day week (' + days + '), ' + n + ' activities, ' + cal.ex.size + ' exceptions');
      if (cal.wdw < 5 || cal.wdw > 7) c.items.push({ id: cal.name, name: 'Unusual working week', wbs: '', field: 'Working days', value: String(cal.wdw), note: days });
    }
    c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' unusual calendars.' : used.size + ' calendars in use, all acceptable.'; c.action = 'Correct the calendar definition.';
  }
  { // holidays
    const c = add({ id: 'L10c', group: 'Calendars', title: 'Public holidays are non-working days', rule: 'Every calendar must show National Day (23 Sep), Founding Day (22 Feb) and the Eid al-Fitr / Eid al-Adha ranges as non-working days within the project window.', source: cfg.calClause || 'Particular Conditions A8.2' });
    const y0 = new Date(M.minES * MS).getUTCFullYear(), y1 = new Date(M.maxEF * MS).getUTCFullYear();
    const hol = [];
    for (let y = y0; y <= y1; y++) for (const f of E.FIXED_HOLIDAYS) hol.push({ day: Math.floor(Date.UTC(y, f.m - 1, f.d) / MS), name: f.name });
    for (let y = y0; y <= y1; y++) {
      for (const type of ['Eid al-Fitr', 'Eid al-Adha']) {
        const es = (cfg.eid || []).filter(e => +e.year === y && e.type === type);
        if (!es.length) { const ap = E.EID_APPROX[type][y]; const ad = ap ? E.strToDay(ap) : null; if (ad == null || (ad + 4 >= M.minES - 10 && ad <= M.maxEF + 10)) out.needEid.push({ year: y, type, approx: ap || '' }); }
        for (const e of es) { if (e.none || !e.from) continue; const a = E.strToDay(e.from), b = E.strToDay(e.to || e.from); for (let d = a; d <= b; d++) hol.push({ day: d, name: e.type }); }
      }
    }
    const win = hol.filter(h => h.day >= M.minES && h.day <= M.maxEF).sort((a, b) => a.day - b.day);
    const used = [...new Set(T.map(t => t.clndr))].filter(i => M.cal[i] && !(cfg.holidayCalsExclude || []).includes(i));
    for (const id of used) { const cal = M.cal[id];
      const miss = win.filter(h => E.isWorking(cal, h.day));
      for (const h of miss) c.items.push({ id: cal.name, name: h.name, wbs: '', field: 'Holiday shown as working day', value: E.fmtDate(h.day), note: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(h.day * MS).getUTCDay()] });
    }
    c.count = c.items.length; c.total = win.length * used.length;
    c.evidence = ['Holidays checked in window ' + E.fmtDate(M.minES) + ' – ' + E.fmtDate(M.maxEF) + ': ' + win.length, 'Calendars checked: ' + used.map(i => M.cal[i].name).join(', ')];
    if (out.needEid.length) { c.evidence.push('Eid ranges not yet entered for: ' + out.needEid.map(n => n.type + ' ' + n.year).join(', ')); }
    c.status = c.count ? 'fail' : (out.needEid.length ? 'notrun' : 'pass');
    c.summary = c.count ? c.count + ' holiday(s) missing across calendars.' : (out.needEid.length ? 'Eid dates needed for ' + out.needEid.map(n => n.type + ' ' + n.year).join(', ') + '.' : 'All holidays defined.');
    if (c.count && out.needEid.length) c.summary += ' Eid dates still needed for ' + out.needEid.map(n => n.type + ' ' + n.year).join(', ') + '.';
    c.action = 'Add each holiday as a non-working exception to the calendar.';
  }

  { // L10d v7.9: calendar working hours (daily hours, weekly total, definition vs the days actually worked)
    const c = add({ id: 'L10d', group: 'Calendars', title: 'Calendar working hours', rule: 'Each calendar in use should work ' + (cfg.stdDayHr || 8) + ' h per day, no more than ' + (cfg.maxWeekHr || 60) + ' h per week, and its stored weekly hours must equal the hours its days actually give. Friday is the rest day' + (cfg.fridayOff !== false ? ' (checked)' : ' (not checked)') + '; Ramadan is treated as normal working days, so reduced Ramadan hours are not flagged.' });
    const used = [...new Set(T.map(t => t.clndr))].filter(i => M.cal[i]);
    for (const id of used) { const cal = M.cal[id], n = T.filter(t => t.clndr === id).length;
      const dh = cal.dayHr, wk = cal.weekHr != null ? cal.weekHr : null, days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((d, i) => cal.dow[i + 1]).join(' ');
      const sd = cfg.stdDayHr || 8, mw = cfg.maxWeekHr || 60;
      if (Math.abs(dh - sd) > 0.01) c.items.push({ id: cal.name, name: 'Working day is ' + dh + ' h, not ' + sd + ' h', wbs: '', field: 'Hours per day', value: String(dh), note: n + ' activities · ' + days });
      if (cfg.fridayOff !== false && cal.dow[6]) c.items.push({ id: cal.name, name: 'Friday is a working day', wbs: '', field: 'Friday', value: 'Working', note: n + ' activities · ' + days + ' · Friday is the weekly rest day in this review' });
      const calc = dh * cal.wdw; if (calc > mw) c.items.push({ id: cal.name, name: 'Weekly hours above ' + mw + ' h', wbs: '', field: 'Hours per week', value: String(calc), note: cal.wdw + ' days × ' + dh + ' h' + (cal.wdw === 7 ? ' · no weekly rest day' : '') });
      if (wk != null && Math.abs(wk - cal.wdwHr) > 0.01 && cal.wdwHr != null) c.items.push({ id: cal.name, name: 'Stored weekly hours differ from the days actually worked', wbs: '', field: 'Hours per week', value: wk + ' stored vs ' + cal.wdwHr + ' worked', note: days });
      c.evidence.push(cal.name + ': ' + dh + ' h × ' + cal.wdw + ' days (' + days + '), ' + n + ' activities');
    }
    c.count = c.items.length; c.total = used.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' calendar issue(s). Durations and float are counted in each calendar\'s own working days.' : 'Calendar hours are consistent.'; c.action = 'Confirm with the contractor which working week is contractual, or correct the calendar.';
  }
  { // L10e v7.9: how P6 was set to calculate (read from the file)
    const c = add({ id: 'L10e', group: 'Schedule logic', title: 'Schedule calculation settings', rule: 'The settings P6 used to calculate dates and float should be known and acceptable: logic mode, open-ended activities, critical-path definition, expected finish, and the baseline source.' });
    const so = M.so || {}, P = M.proj || {}, add1 = (name, value, note) => c.items.push({ id: P.proj_short_name || '', name, wbs: '', field: 'Setting', value, note: note || '' });
    if (so.sched_progress_override === 'Y' || so.sched_retained_logic === 'N') add1('Progress override is on (not retained logic)', 'Progress override', 'Out-of-sequence progress lets later work ignore unfinished predecessors. Ask whether this is the agreed method.');
    if (so.sched_open_critical_flag === 'N') add1('Open-ended activities are not treated as critical', 'Off', 'An activity with no successor can show float even though nothing follows it.');
    if (so.sched_use_expect_end_flag === 'Y') add1('Expected finish dates are used', 'On', 'Any activity with an expected finish takes that date regardless of its remaining duration.');
    if (P.critical_path_type === 'CT_TotFloat') add1('Critical = total float, not longest path', 'Total float', 'With several calendars, "critical" can differ from the longest path.');
    const pids = new Set(((T.PROJECT && T.PROJECT.r) || []).map(r => r.proj_id));
    if (P.sum_base_proj_id && !pids.has(P.sum_base_proj_id)) add1('Schedule is compared with a baseline project that is not in this file', 'Baseline ' + P.sum_base_proj_id, 'Variance fields come from the target dates stored on each activity; the baseline project itself cannot be checked here.');
    c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' setting(s) to confirm with the contractor.' : 'Calculation settings are standard.'; c.action = 'Confirm these settings are the agreed method; they change dates and float.';
    c.evidence = ['Logic: ' + (so.sched_retained_logic === 'N' ? 'progress override' : 'retained logic'), 'Open-ended critical: ' + (so.sched_open_critical_flag || 'n/a'), 'Critical path type: ' + (P.critical_path_type || 'n/a'), 'Float type: ' + (so.sched_float_type || 'n/a')];
  }

  /* ---- L11 ID / WBS / name ---- */
  const threeWay = (a, b, n) => { // a=code, b=wbs, n=name sets/values; returns odd one
    const eq = (x, y) => x && y && (x instanceof Set ? inter(x, y) : x === y);
    if (eq(a, b)) return null;
    if (n && n.size !== 0 && eq(n, b)) return 'code'; if (n && n.size !== 0 && eq(n, a)) return 'WBS';
    return n && n.size !== 0 ? 'unresolved' : 'name not usable';
  };
  { // L11a WBS vs name
    const c = add({ id: 'L11a', group: 'Consistency', tier: 'major', title: 'WBS does not match the activity name', rule: 'The WBS branch an activity sits in must agree with the zone, road and discipline stated in its name. (Major: it distorts progress roll-up and reporting.)' });
    for (const t of nonMile) {
      const w = M.wbs[t.wbs]; if (!w) continue;
      const wz = zoneFromText(t.wbsPath), nz = zoneFromText(t.name);
      if (wz.size && nz.size && !inter(wz, nz)) c.items.push(row(t, 'Zone', 'WBS: ' + [...wz].join(',') + ' | Name: ' + [...nz].join(','), t.wbsPath));
      const wr = roadsFromText(t.wbsPath), nr = roadsFromText(t.name);
      if (wr.size && nr.size && !inter(wr, nr)) c.items.push(row(t, 'Road', 'WBS: ' + [...wr].join(',') + ' | Name: ' + [...nr].join(','), t.wbsPath));
      const wf = famOf(t.wbsPath), nf = famOf(t.name);
      if (wf.size && nf.size && !inter(wf, nf)) c.items.push(row(t, 'Discipline', 'WBS: ' + [...wf].join(',') + ' | Name: ' + [...nf].join(','), t.wbsPath));
    }
    c.count = new Set(c.items.map(i => i.id)).size; c.total = nonMile.length; c.status = c.items.length ? 'fail' : 'pass'; c.summary = c.items.length ? c.count + ' activities (' + c.items.length + ' mismatches).' : 'WBS and names agree.'; c.action = 'Move the activity to the correct WBS branch or correct its name.';
  }
  { // L11b codes
    const c = add({ id: 'L11b', group: 'Consistency', tier: 'minor', title: 'Activity ID / codes do not match the WBS', rule: 'The zone and discipline carried in the activity ID and activity codes must agree with the WBS; the activity name is used to say which side is likely wrong.' });
    const phaseOf = s => { s = (s || ''); if (/mobil|initial|MB/i.test(s)) return 'mobilization'; if (/^gen/i.test(s)) return 'general'; if (/eng/i.test(s)) return 'engineering'; if (/^pro|procure/i.test(s)) return 'procurement'; if (/^con|construct/i.test(s)) return 'construction'; if (/test|T&C|commission|handover|close|HO/i.test(s)) return 'closeout'; return null; };
    const dcodeType = Object.values(M.codeTypes).find(n => /discipline/i.test(n));
    for (const t of nonMile) {
      const p = parseId(t); const wz = zoneFromText(t.wbsPath), nz = zoneFromText(t.name);
      if (p && p.zone && wz.size && !wz.has(p.zone[0])) { const odd = threeWay(new Set([p.zone[0]]), wz, nz); c.items.push(row(t, 'Zone in ID vs WBS', 'ID: ' + p.zone + ' | WBS: ' + [...wz].join(','), odd ? 'Likely wrong: ' + (odd === 'code' ? 'ID' : odd) : '')); }
      if (p && p.disc) { const wf = famOf(t.wbsPath), idf = famOf(p.disc), nf = famOf(t.name); if (wf.size && idf.size && !inter(wf, idf)) { const odd = threeWay(idf, wf, nf); c.items.push(row(t, 'Discipline in ID vs WBS', 'ID: ' + p.disc + ' | WBS: ' + [...wf].join(','), odd ? 'Likely wrong: ' + (odd === 'code' ? 'ID' : odd) : '')); } }
      if (dcodeType && t.codes[dcodeType]) { const cp = phaseOf(t.codes[dcodeType].short) || phaseOf(t.codes[dcodeType].name); if (cp && t.wbsCat && cp !== t.wbsCat && !(cp === 'delivery' && t.wbsCat === 'procurement') && !(t.wbsCat === 'delivery' && cp === 'procurement')) c.items.push(row(t, 'Discipline code vs WBS phase', 'Code: ' + t.codes[dcodeType].name + ' | WBS: ' + t.wbsCat, '')); }
    }
    c.count = new Set(c.items.map(i => i.id)).size; c.total = nonMile.length; c.status = c.items.length ? 'fail' : 'pass'; c.summary = c.items.length ? c.count + ' activities (' + c.items.length + ' mismatches).' : 'IDs and codes agree with the WBS.'; c.action = 'Correct the ID or code (or the WBS, where the note says the WBS is likely wrong).';
  }

  /* ---- L12 resources ---- */
  const rs = M.rsrc; const progId = cfg.rsrc.progress, costId = cfg.rsrc.cost;
  const isLabor = id => rs[id] && rs[id].type === 'RT_Labor' && id !== progId && id !== costId && !(rs[id].name === rs[id].short && false);
  const isEquip = id => rs[id] && rs[id].type === 'RT_Equip';
  {
    const c = add({ id: 'R1', group: 'Cost & resources', title: 'Progress resource: weights and total', rule: 'The progress resource (price 1) carries the contract value spread by the phase weights ' + Object.entries(cfg.weights).map(([k, v]) => k + ' ' + v + '%').join(', ') + '.', single: true });
    if (!progId || !cfg.contractValue) { c.status = 'notrun'; c.summary = !progId ? 'Progress resource not identified.' : 'Contract value not entered.'; }
    else {
      const asg = M.asg.filter(a => a.rsrc === progId); const cost = a => a.qty * a.price;
      if (!asg.length) { c.status = 'fail'; c.count = 1; c.summary = 'No activity carries the progress resource.'; c.evidence = ['Progress resource "' + rs[progId].name + '" is not assigned to any activity.']; c.action = 'Assign the progress resource to every activity with units equal to its weighted budget.'; }
      else {
        const tot = asg.reduce((s, a) => s + cost(a), 0); const by = {};
        for (const a of asg) { const g = cfg.weightGroup[a.task.cat] || 'other'; by[g] = (by[g] || 0) + cost(a); }
        c.evidence = ['Progress resource total: ' + num(tot) + ' vs contract value ' + num(cfg.contractValue)];
        let bad = false;
        if (Math.abs(tot - cfg.contractValue) / cfg.contractValue * 100 > cfg.costTol) bad = true;
        for (const [g, w] of Object.entries(cfg.weights)) { const sh = 100 * (by[g] || 0) / (tot || 1); c.evidence.push(g + ': ' + r1(sh) + '% (required ' + w + '%)'); if (Math.abs(sh - w) > cfg.weightTol) bad = true; }
        const wsum = Object.values(cfg.weights).reduce((a, b) => a + (+b), 0); if (Math.abs(wsum - 100) > 1e-6) { bad = true; c.evidence.push('Weights add up to ' + wsum + '%, not 100%'); }
        c.status = bad ? 'fail' : 'pass'; c.count = bad ? 1 : 0; c.summary = bad ? 'Progress weights or total do not agree.' : 'Progress resource agrees with weights and contract value.'; c.action = 'Re-load the progress resource so the total equals the contract value and the phases follow the agreed weights.';
      }
    }
  }
  {
    const c = add({ id: 'R2', group: 'Cost & resources', title: 'Cost resource: BOQ units and zero price', rule: 'The cost resource units hold the BOQ amounts (total = contract value) and its price must be zero so the budget is not counted twice.' });
    if (!costId) { c.status = 'notrun'; c.summary = 'Cost resource not identified.'; }
    else {
      const asg = M.asg.filter(a => a.rsrc === costId); const tot = asg.reduce((s, a) => s + a.qty, 0);
      const priced = asg.filter(a => Math.abs(a.price) > 1e-9);
      c.evidence = ['Cost resource "' + rs[costId].name + '" assigned to ' + asg.length + ' activities', 'Total units: ' + num(tot), 'Priced assignments: ' + priced.length];
      if (cfg.contractValue) c.evidence.push('Contract value: ' + num(cfg.contractValue) + ' (difference ' + num(tot - cfg.contractValue) + ')');
      if (cfg.boq) c.evidence.push('BOQ total: ' + num(cfg.boq.total) + ' (difference ' + num(tot - cfg.boq.total) + ')');
      priced.slice(0, 5000).forEach(a => c.items.push(row(a.task, 'Cost resource price', a.price, 'Must be 0')));
      let bad = priced.length > 0; const ref = cfg.boq ? cfg.boq.total : cfg.contractValue;
      if (ref && Math.abs(tot - ref) / ref * 100 > cfg.costTol) bad = true;
      c.count = c.items.length || (bad ? 1 : 0); c.total = asg.length; c.status = bad ? 'fail' : 'pass'; c.summary = bad ? (priced.length ? priced.length + ' assignments carry a price above zero. ' : '') + (ref && Math.abs(tot - ref) / ref * 100 > cfg.costTol ? 'Units total differs from ' + (cfg.boq ? 'BOQ' : 'contract value') + '.' : '') : 'Cost resource agrees.';
      c.action = 'Set the cost resource price to zero and make its units equal the BOQ amount of each activity.';
      out.costReliable = !bad;
    }
  }
  {
    const c = add({ id: 'R3', group: 'Cost & resources', title: 'Progress resource on every activity', rule: 'Every non-milestone activity must carry the progress resource with units above zero.' });
    if (!progId) { c.status = 'notrun'; c.summary = 'Progress resource not identified.'; }
    else {
      for (const t of nonMile) { const a = t.asg.filter(x => x.rsrc === progId); const u = a.reduce((s, x) => s + x.qty, 0); if (!a.length) c.items.push(row(t, 'No progress resource')); else if (u <= 0) c.items.push(row(t, 'Progress units', '0')); }
      c.count = c.items.length; c.total = nonMile.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities have no progress weight and would show no progress.' : 'All activities carry progress weight.'; if (c.count) { const use = Object.values(rs).map(r => [r, E.rsrcUse(M, r.id)]).filter(x => x[1] > 0 && x[0].id !== progId).sort((x, y) => y[1] - x[1]).slice(0, 3); c.evidence = ['Resource checked as the progress resource: "' + rs[progId].short + ' ' + rs[progId].name + '" (assigned to ' + E.rsrcUse(M, progId) + ' activities).'].concat(use.length ? ['If that is the wrong resource, pick the right one in Settings. Resources with the most assignments: ' + use.map(x => x[0].short + ' ' + x[0].name + ' (' + x[1] + ')').join('; ')] : []); } c.action = 'Assign the progress resource with its weighted units.';
    }
  }
  {
    const c = add({ id: 'R4', group: 'Cost & resources', title: 'Cost resource on every activity', rule: 'Every non-milestone activity that carries BOQ value must have the cost resource assigned.' });
    if (!costId) { c.status = 'notrun'; c.summary = 'Cost resource not identified.'; }
    else {
      for (const t of nonMile) { const a = t.asg.filter(x => x.rsrc === costId); if (!a.length || a.reduce((s, x) => s + x.qty, 0) <= 0) c.items.push(row(t, 'No cost resource units', '', t.cat)); }
      c.count = c.items.length; c.total = nonMile.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities have no BOQ amount.' : 'All activities carry BOQ units.'; c.action = 'Assign the cost resource with the BOQ amount, or confirm the activity carries no BOQ value.';
    }
  }
  {
    const infra = cfg.projectType === 'infrastructure';
    const c = add({ id: 'R5', group: 'Cost & resources', title: 'Labour' + (infra ? ' and equipment' : '') + ' on construction activities', rule: 'Every construction activity must carry labour' + (infra ? ' and equipment (infrastructure project: the work depends on equipment)' : ' (buildings: equipment is not tested)') + '.', tier: infra ? 'major' : 'normal' });
    const con = nonMile.filter(t => t.cat === 'construction'); const noEq = (() => { try { return cfg.noEquipRegex ? new RegExp(cfg.noEquipRegex, 'i') : null; } catch (e) { return null; } })(); let exempt = 0;
    for (const t of con) { const skipE = noEq && noEq.test(t.name); if (skipE) exempt++; const hasL = t.asg.some(a => isLabor(a.rsrc) && a.qty > 0), hasE = t.asg.some(a => isEquip(a.rsrc) && a.qty > 0); if (!hasL) c.items.push(row(t, 'No labour assigned')); if (infra && !hasE && !skipE) c.items.push(row(t, 'No equipment assigned')); }
    c.count = new Set(c.items.map(i => i.id)).size; c.total = con.length; c.status = c.items.length ? 'fail' : 'pass'; c.summary = c.items.length ? c.count + ' construction activities lack labour' + (infra ? ' or equipment' : '') + '.' : 'Resources assigned.'; c.action = 'Load labour' + (infra ? ' and equipment' : '') + ' on every construction activity.'; if (infra && exempt) { c.evidence.push(exempt + ' activities whose name matches "' + cfg.noEquipRegex + '" (e.g. surveying, leakage tests) are not required to carry equipment; they still need labour.'); c.rule += ' Activities that need no major equipment (name matches "' + cfg.noEquipRegex + '", editable in Setup) are tested for labour only.'; }
  }
  {
    const c = add({ id: 'R6', group: 'Cost & resources', title: 'Labour and equipment priced at zero', rule: 'Labour and equipment must have a price of zero; money is carried only by the progress resource.' });
    for (const a of M.asg) if ((isLabor(a.rsrc) || isEquip(a.rsrc)) && Math.abs(a.price) > 1e-9) c.items.push(row(a.task, rs[a.rsrc].name + ' price', a.price));
    c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' labour/equipment assignments carry a price.' : 'All priced at zero.'; c.action = 'Set the price of labour and equipment to zero.';
  }
  {
    const fac = cfg.outputFactor || 3;
    const c = add({ id: 'R7', group: 'Cost & resources', title: 'Output plausibility against similar activities (information)', rule: 'Each activity carries its own share of the BOQ cost, so its cost value per resource-hour (labour + equipment) is compared with the median of activities of the same type (same step name, e.g. "Install Pipes"). Activities more than ' + fac + ' times above or below that median are listed for the reviewer to judge. No pass/fail.', status: 'info' });
    const rows = []; const by = new Map();
    for (const t of nonMile.filter(t => t.cat === 'construction')) {
      const q = t.asg.filter(a => a.rsrc === costId).reduce((s, a) => s + a.qty, 0);
      const hl = t.asg.filter(a => isLabor(a.rsrc)).reduce((s, a) => s + a.qty, 0), he = t.asg.filter(a => isEquip(a.rsrc)).reduce((s, a) => s + a.qty, 0);
      if (hl + he > 0 && q > 0) { const r = { t, q, hl, he, rate: q / (hl + he), type: E.stepKey(t.name).toLowerCase() }; rows.push(r); (by.get(r.type) || by.set(r.type, []).get(r.type)).push(r); }
    }
    const med = a => { const x = a.map(r => r.rate).sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
    const out = []; let types = 0;
    for (const [k, g] of by) { if (g.length < 5) continue; types++; const m = med(g); g.forEach(r => { r.med = m; r.ratio = r.rate / m; r.n = g.length; if (r.ratio > fac || r.ratio < 1 / fac) out.push(r); }); }
    out.sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)));
    out.slice(0, 300).forEach(r => c.items.push(row(r.t, r.ratio > 1 ? 'Far more cost per hour than similar activities' : 'Far less cost per hour than similar activities', num(r.rate) + ' per resource-hour (' + (r.ratio >= 1 ? '×' + num(r.ratio) : '÷' + num(1 / r.ratio)) + ' of median)', 'Median of ' + r.n + ' "' + E.stepKey(r.t.name) + '" activities: ' + num(r.med) + ' | Labour h ' + num(r.hl) + ' | Equipment h ' + num(r.he) + ' | BOQ cost units ' + num(r.q))));
    c.evidence.push('Cost value is the BOQ cost resource loaded on each activity (its own share of the item, in cost units, not metres). ' + rows.length + ' activities with hours and cost; ' + types + ' activity types with at least 5 members compared.');
    c.count = out.length; c.total = rows.length; c.summary = out.length ? out.length + ' activities differ from the median of their activity type by more than ' + fac + '× (most extreme first' + (out.length > 300 ? ', first 300 shown' : '') + '). Judge whether the quantity share or the hours are wrong.' : 'No activity differs from its type median by more than ' + fac + '×.';
  }

  /* ---- L13 data date ---- */
  {
    const base = cfg.fileType === 'baseline';
    const c = add({ id: 'L13', group: 'Schedule logic', title: base ? 'Baseline contains no progress and no start before data date' : 'Actual dates agree with the data date', rule: base ? 'In a baseline no activity may have an actual date, and none may start before the data date.' : 'In an update, no activity may be unstarted before the data date and no actual date may fall after it.' });
    const dd = M.dataDate;
    c.evidence = ['Data date: ' + E.fmtDate(dd)];
    for (const t of T) {
      if (base) { if (t.as != null || t.af != null) c.items.push(row(t, 'Actual date present', E.fmtDate(t.as || t.af))); if (t.es != null && t.es < dd) c.items.push(row(t, 'Starts before data date', E.fmtDate(t.es))); }
      else { if (t.as == null && t.es != null && t.es < dd) c.items.push(row(t, 'Unstarted before data date', E.fmtDate(t.es))); if ((t.as != null && t.as > dd) || (t.af != null && t.af > dd)) c.items.push(row(t, 'Actual date after data date', E.fmtDate(t.af || t.as))); }
    }
    c.count = c.items.length; c.total = T.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' activities.' : 'Dates consistent with the data date.'; c.action = 'Correct the dates or the data date.';
  }

  /* ---- L14 phase logic ---- */
  const reach = (starts, back) => { const seen = new Set(starts); const q = [...starts]; while (q.length) { const t = q.pop(); for (const l of (back ? t.pre : t.succ)) { const n = back ? l.from : l.to; if (!seen.has(n)) { seen.add(n); q.push(n); } } } return seen; };
  const conTasks = nonMile.filter(t => t.cat === 'construction');
  const toCon = reach(conTasks, true);
  {
    const c = add({ id: 'L14', group: 'Schedule logic', tier: 'major', title: 'Engineering, approvals, procurement and mobilization are not linked to construction', rule: 'Every engineering, approval, procurement, delivery and mobilization activity must have a path of logic to a construction activity. A path that ends in a milestone does not count.' });
    for (const t of nonMile) {
      if (!['engineering', 'procurement', 'delivery', 'mobilization'].includes(t.cat)) continue;
      if (!toCon.has(t)) { const sf = t.succ.map(l => l.to.tfCal).filter(x => x != null); c.items.push(row(t, 'No path to construction', t.cat, sf.length ? 'Float of successors (min): ' + r1(Math.min(...sf)) + ' d' : 'No successors')); }
    }
    const pre = nonMile.filter(t => ['engineering', 'procurement', 'delivery', 'mobilization'].includes(t.cat));
    c.count = c.items.length; c.total = pre.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' of ' + pre.length + ' pre-construction activities do not drive construction.' : 'All pre-construction activities lead to construction.'; c.action = 'Link each activity to the construction activity that depends on it.';
  }
  /* ---- L15 milestones ---- */
  {
    const c = add({ id: 'L15', group: 'Schedule logic', title: 'Milestone logic', rule: 'Every milestone except the project finish must have a successor, and every zone-completion milestone must lead to testing / handover.' });
    const close = T.filter(t => t.cat === 'closeout' && !t.isMile); const toClose = reach(close, true);
    for (const t of T.filter(t => t.isMile)) {
      if (!t.succ.length && t !== finish) c.items.push(row(t, 'Milestone without successor'));
      else if (/^\s*(?:completion of )?zone[\s-]*[A-Z0-9,]+\s*(?:completion)?\s*$/i.test(t.name) && !toClose.has(t) && t !== finish) c.items.push(row(t, 'Zone completion not linked to testing/handover'));
    }
    c.count = c.items.length; c.total = T.filter(t => t.isMile).length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' milestone issues.' : 'Milestones linked.'; c.action = 'Add successors so each milestone drives the next stage.';
  }
  /* ---- L16 critical path ---- */
  {
    const c = add({ id: 'L16', group: 'Schedule logic', title: 'Critical path shape (information)', rule: 'Shape of the critical path: length, share of schedule, zones crossed, continuity, near-critical activities.', status: 'info', single: true });
    const crit = new Set(nonMile.filter(t => t.tfWd != null && t.tfWd <= 1e-6)); const critAll = new Set(T.filter(t => t.tfWd != null && t.tfWd <= 1e-6));
    const near = nonMile.filter(t => t.tfCal != null && t.tfCal > 1e-6 && t.tfCal <= cfg.nearCrit);
    const zones = {}; crit.forEach(t => { const z = zoneOf(t); zones[z] = (zones[z] || 0) + 1; });
    const clinks = M.links.filter(l => critAll.has(l.from) && critAll.has(l.to));
    const cross = clinks.filter(l => zoneOf(l.from) !== zoneOf(l.to) && zoneOf(l.from) !== 'General' && zoneOf(l.to) !== 'General');
    // components
    const par = new Map(); const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    critAll.forEach(t => par.set(t, t)); clinks.forEach(l => par.set(find(l.from), find(l.to)));
    const comps = new Set([...critAll].map(find)).size;
    const share = 100 * crit.size / (nonMile.length || 1);
    c.count = crit.size; c.total = nonMile.length;
    c.evidence = ['Critical activities (total float ≤ 0): ' + crit.size + ' (' + r1(share) + '% of ' + nonMile.length + ')', 'Zones crossed: ' + Object.entries(zones).map(([z, n]) => z + ' (' + n + ')').join(', '), 'Links between critical activities: ' + clinks.length + '; links that cross zones: ' + cross.length, 'Continuity: ' + (comps <= 1 ? 'one continuous chain' : comps + ' separate pieces (the chain is broken)'), 'Near-critical (float ≤ ' + cfg.nearCrit + ' days): ' + near.length];
    c.summary = crit.size + ' critical activities (' + r1(share) + '%)' + (share < 5 ? ' — unusually thin' : '') + (comps > 1 ? ' — not continuous' : '') + '.';
    c.flag = share < 5 || comps > 1;
    crit.forEach(t => c.items.push(row(t, 'Critical', 'TF ' + r1(t.tfCal) + ' d', zoneOf(t))));
    out.critical = critAll; out.critLinks = clinks;
  }
  /* ---- L17 duplicates ---- */
  {
    const c = add({ id: 'L17', group: 'Schedule logic', title: 'Duplicate and contradictory links', rule: 'Two activities must not be joined twice by the same type, or by an FS link alongside an overlap (SS/FF) link. An SS + FF pair is acceptable if the lag caps hold.' });
    const m = new Map(); for (const l of M.links) { const k = l.from.id + '>' + l.to.id; (m.get(k) || m.set(k, []).get(k)).push(l); }
    for (const ls of m.values()) if (ls.length > 1) { const types = ls.map(l => l.type); const dupType = new Set(types).size < types.length; const fsMix = types.includes('FS') && types.some(t => t !== 'FS'); if (dupType || fsMix) c.items.push(Object.assign(lrow(ls[0], dupType ? 'Same link type repeated' : 'FS together with overlap link', ls.map(l => l.type + (l.lagWd ? ' ' + r1(l.lagWd) + 'd' : '')).join(' + ')), { fix: dupType ? 'Delete the repeated link and keep one ' + types.find((t, i) => types.indexOf(t) !== i) + ' link (keep the one with the correct lag).' : 'Keep one relationship. If ' + ls[0].to.code + ' really can overlap ' + ls[0].from.code + ', delete the FS link and keep the Start-to-Start (with a lag shorter than the predecessor) plus a Finish-to-Finish link. If it must wait for the predecessor to finish, delete the overlap links and keep the FS.' })); }
    c.count = c.items.length; c.total = [...m.values()].filter(x => x.length > 1).length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' duplicate / contradictory pairs.' : 'No duplicates.'; c.action = 'Delete the redundant link.';
  }
  return out;
};
