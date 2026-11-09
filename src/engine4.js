/* ===== ENGINE PART 4: progress curve, sequence logic, critical-path validation ===== */
E.EXTRA_DEFAULTS = { curveTimePct: 70, curveRemainMax: 40, curveCgMax: 55, curveMonthMult: 2, loadFrontPct: 30, loadFrontMax: 35, loadCgMin: 45 };

/* ---- helpers ---- */
E.dailyCurve = function (M, filter, valFn, start, end) {
  const n = end - start + 1, arr = new Float64Array(n);
  for (const a of M.asg) {
    if (!filter(a)) continue; const v = valFn(a); if (!v) continue;
    let s = a.start != null ? a.start : a.task.es, e = a.end != null ? a.end : a.task.ef; if (s == null) continue; if (e == null || e < s) e = s;
    const len = e - s + 1, per = v / len;
    for (let d = s; d <= e; d++) { const i = d - start; if (i >= 0 && i < n) arr[i] += per; }
  }
  return arr;
};
E.curveStats = function (arr, start, cfg) {
  const n = arr.length, total = arr.reduce((a, b) => a + b, 0); if (!total) return null;
  const tp = Math.min(n - 1, Math.max(0, Math.floor(cfg.curveTimePct / 100 * n) - 1)); let cum = 0, cumAtTp = 0, cg = 0;
  for (let i = 0; i < n; i++) { cum += arr[i]; if (i === tp) cumAtTp = cum; cg += arr[i] * (i + 0.5); }
  const mo = new Map(); for (let i = 0; i < n; i++) { const k = E.ym(start + i); mo.set(k, (mo.get(k) || 0) + arr[i]); }
  const avg = total / mo.size; const spikes = [...mo.entries()].filter(([k, v]) => v > cfg.curveMonthMult * avg);
  return { total, n, tpDay: start + tp, donePct: 100 * cumAtTp / total, remainPct: 100 - 100 * cumAtTp / total, cgPct: 100 * cg / total / n, months: mo, avg, spikes };
};

/* ---- R8 progress curve ---- */
E.curveCheck = function (M, cfg, out) {
  const fmt = x => Number(x).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const c = { id: 'R8', group: 'Cost & resources', title: 'Progress curve: back-loading and consistency', tier: 'normal', status: 'notrun', count: 0, items: [], evidence: [], single: true, action: '', why: '', source: '', rule: `After ${cfg.curveTimePct}% of the duration, the remaining progress must not exceed ${cfg.curveRemainMax}%; the centre of gravity of progress must not be later than ${cfg.curveCgMax}% of the duration; no month may carry more than ${cfg.curveMonthMult}× the average monthly progress; engineering must come early and handover late.` };
  const pid = cfg.rsrc.progress; const R = out.results; R.push(c);
  if (!pid) { c.summary = 'Progress resource not identified.'; return; }
  const ntp = cfg.ntp ? E.strToDay(cfg.ntp) : null; let start = M.minES, end = M.maxEF; let basis = 'schedule duration';
  if (ntp && cfg.durationValue) { start = ntp; end = cfg.durationUnit === 'months' ? E.addMonths(ntp, +cfg.durationValue) - 1 : ntp + (+cfg.durationValue) - 1; basis = 'contract duration'; }
  end = Math.max(end, M.maxEF);
  const arr = E.dailyCurve(M, a => a.rsrc === pid, a => a.qty * a.price, start, end);
  const st = E.curveStats(arr, start, cfg);
  if (!st) { c.summary = 'Not run – the progress resource has no assigned quantities in this XER, so no progress curve can be built. (This is itself a finding for the resource-loading checks.)'; return; }
  // contract window for the time point
  const cwin = (basis === 'contract duration') ? (() => { const dur = (cfg.durationUnit === 'months' ? E.addMonths(ntp, +cfg.durationValue) - 1 : ntp + (+cfg.durationValue) - 1) - ntp + 1; return dur; })() : st.n;
  const tpDay = start + Math.floor(cfg.curveTimePct / 100 * cwin) - 1; let cum = 0; for (let i = 0; i < arr.length && start + i <= tpDay; i++) cum += arr[i];
  const done = 100 * cum / st.total, remain = 100 - done; const cgDays = (() => { let g = 0; for (let i = 0; i < arr.length; i++) g += arr[i] * (i + 0.5); return g / st.total; })(); const cgPct = 100 * cgDays / cwin;
  c.evidence.push(`Curve built from the progress resource over the ${basis} (${E.fmtDate(start)} – ${E.fmtDate(start + cwin - 1)}).`, `At ${cfg.curveTimePct}% of the duration (${E.fmtDate(tpDay)}): ${fmt(done)}% done, ${fmt(remain)}% remaining (limit ${cfg.curveRemainMax}%).`, `Centre of gravity of progress: ${fmt(cgPct)}% of the duration (limit ${cfg.curveCgMax}%).`);
  const fails = [];
  if (remain > cfg.curveRemainMax) { fails.push('remaining'); c.items.push({ id: E.fmtDate(tpDay), name: `${cfg.curveTimePct}% of duration`, wbs: '', field: 'Progress remaining after the time point', value: fmt(remain) + '%', note: `Limit ${cfg.curveRemainMax}%` }); }
  if (cgPct > cfg.curveCgMax) { fails.push('cg'); c.items.push({ id: 'Centre of gravity', name: 'Average time at which progress is earned', wbs: '', field: 'Share of duration', value: fmt(cgPct) + '%', note: `Limit ${cfg.curveCgMax}%` }); }
  const sp = [...st.months.entries()].filter(([k, v]) => v > cfg.curveMonthMult * st.avg); sp.forEach(([k, v]) => { fails.push('spike'); c.items.push({ id: k, name: 'Monthly progress', wbs: '', field: 'Month above ceiling', value: fmt(100 * v / st.total) + '% of total', note: `Average month ${fmt(100 * st.avg / st.total)}%, ceiling ${cfg.curveMonthMult}×` }); });
  if (arr.some(v => v < -1e-9)) { fails.push('neg'); c.items.push({ id: 'Curve', name: 'Negative progress in some period', wbs: '', field: 'Curve falls', value: '', note: '' }); }
  // phase timing
  const grp = {}; for (const a of M.asg) { if (a.rsrc !== pid) continue; const g = cfg.weightGroup[a.task.cat] || 'other'; const s = a.start != null ? a.start : a.task.es, e = a.end != null ? a.end : a.task.ef; if (s == null) continue; const v = a.qty * a.price, mid = ((s + (e == null ? s : e)) / 2 - start) / cwin * 100; const x = grp[g] || (grp[g] = { v: 0, w: 0 }); x.v += v; x.w += v * mid; }
  const cen = {}; for (const k in grp) if (grp[k].v) cen[k] = grp[k].w / grp[k].v; c.evidence.push('Average timing of each phase (% of duration): ' + Object.entries(cen).map(([k, v]) => k + ' ' + fmt(v)).join(', '));
  if (cen.engineering != null && cen.construction != null && cen.engineering > cen.construction) { fails.push('phase'); c.items.push({ id: 'Phase timing', name: 'Engineering weight is later than construction weight', wbs: '', field: 'Phase order', value: `Engineering ${fmt(cen.engineering)}% vs construction ${fmt(cen.construction)}%`, note: '' }); }
  if (cen.handover != null && cen.construction != null && cen.handover < cen.construction) { fails.push('phase'); c.items.push({ id: 'Phase timing', name: 'Handover weight is earlier than construction weight', wbs: '', field: 'Phase order', value: `Handover ${fmt(cen.handover)}% vs construction ${fmt(cen.construction)}%`, note: '' }); }
  // cash flow (cost resource) for information
  if (cfg.rsrc.cost) { const a2 = E.dailyCurve(M, a => a.rsrc === cfg.rsrc.cost, a => a.qty, start, end); const s2 = E.curveStats(a2, start, cfg); if (s2) { let cm = 0; for (let i = 0; i < a2.length && start + i <= tpDay; i++) cm += a2[i]; let g2 = 0; for (let i = 0; i < a2.length; i++) g2 += a2[i] * (i + 0.5); c.evidence.push(`For comparison, the cash flow built from the cost resource: ${fmt(100 - 100 * cm / s2.total)}% remaining after the time point; centre of gravity ${fmt(100 * g2 / s2.total / cwin)}%.`); } }
  c.curve = { start, daily: Array.from(arr), cwin };
  c.status = fails.length ? 'fail' : 'pass'; c.count = c.items.length;
  c.summary = fails.length ? (fails.includes('remaining') ? `${fmt(remain)}% of progress remains after ${cfg.curveTimePct}% of the duration (limit ${cfg.curveRemainMax}%). ` : '') + (fails.includes('cg') ? `Centre of gravity at ${fmt(cgPct)}% of the duration. ` : '') + (fails.includes('spike') ? 'Monthly spike(s). ' : '') + (fails.includes('phase') ? 'Phase timing is illogical.' : '') : `Curve is not back-loaded (${fmt(remain)}% remaining at ${cfg.curveTimePct}%).`;
  c.action = 'Re-plan the programme and progress weights so progress is earned earlier and more evenly, and explain any late peaks.';
  c.why = 'A back-loaded curve pushes risk to the end of the contract, hides delay in early months and makes progress reporting unreliable.';
};

/* ---- work packages & sequence logic ---- */
E.stepKey = name => String(name || '').split(/\s+(?:for|of|from|to|at|in|on|between)\s+|\s+[-–]\s+|\s*\(|:/i)[0].trim().replace(/\s+/g, ' ');
E.buildPackages = function (M, cfg) {
  const dw = {}; for (const k in cfg.disciplineWords) dw[k] = new RegExp(cfg.disciplineWords[k], 'i');
  const fam = w => { const segs = w.path.slice(-3).join(' / '); for (const k in dw) if (dw[k].test(segs)) return k; for (const k in dw) if (dw[k].test(w.pathStr)) return k; return 'other'; };
  const by = new Map(); for (const t of M.tasks) { if (t.isMile || t.cat !== 'construction') continue; (by.get(t.wbs) || by.set(t.wbs, []).get(t.wbs)).push(t); }
  const packages = [], trades = {};
  for (const [wid, ts] of by) { if (ts.length < 3) continue; const w = M.wbs[wid]; const trade = fam(w); ts.sort((a, b) => (a.es - b.es) || (a.code < b.code ? -1 : 1)); const p = { wbs: wid, wbsPath: w.pathStr, trade, tasks: ts }; packages.push(p);
    const tr = trades[trade] || (trades[trade] = { packages: 0, steps: new Map(), example: null }); tr.packages++; ts.forEach(t => { const k = E.stepKey(t.name); tr.steps.set(k, (tr.steps.get(k) || 0) + 1); }); if (!tr.example || ts.length > tr.example.tasks.length && ts.length <= 40) tr.example = p; }
  return { packages, trades };
};
E.sequencePayload = function (pk) {
  const lines = [];
  for (const [trade, tr] of Object.entries(pk.trades)) {
    lines.push(`TRADE: ${trade} (${tr.packages} work packages)`);
    lines.push('Step names found (name × number of times):'); [...tr.steps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 45).forEach(([k, n]) => lines.push(`  - ${k} × ${n}`));
    lines.push('Example package, activities in scheduled order:'); tr.example.tasks.slice(0, 40).forEach((t, i) => lines.push(`  ${i + 1}. ${E.stepKey(t.name)}`)); lines.push('');
  }
  return lines.join('\n');
};
E.stepElem = name => { const n = String(name || ''); const k = E.stepKey(n); return n.slice(k.length).replace(/^\s*(?:for|of|from|to|at|in|on|between)\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase(); };
E.testSequences = function (M, pk, approved) {
  const c = { id: 'SQ', group: 'Sequence & critical path', title: 'Work sequence follows best practice for each trade', tier: 'major', status: 'pass', count: 0, items: [], evidence: [], single: false, action: 'Re-link the activities in the order the work is built, using Finish-to-Start, or Start-to-Start plus Finish-to-Finish with lags for parallel work.', why: 'If the logic does not follow the way the work is built, the dates are not achievable and delay to one step will not move the next.', source: '', rule: 'Within each work package (one pipe run, road section, etc.) the steps must be linked in the best-practice order approved for the trade. Finish-to-Start is standard; Start-to-Start with lag is accepted only together with Finish-to-Finish with lag.' };
  let tested = 0, missing = 0; const seen = new Set();
  const key = (a, b) => a.id + '>' + b.id;
  for (const p of pk.packages) {
    const rules = approved[p.trade]; if (!rules || !rules.length) continue; const set = new Set(p.tasks);
    const reach = (a, b) => { const st = [a], vis = new Set([a]); while (st.length) { const x = st.pop(); for (const l of x.succ) { const y = l.to; if (!set.has(y) || vis.has(y)) continue; if (y === b) return true; vis.add(y); st.push(y); } } return false; };
    const byStep = new Map(); p.tasks.forEach(t => { const k = E.stepKey(t.name).toLowerCase(); (byStep.get(k) || byStep.set(k, []).get(k)).push(t); });
    for (const r of rules) {
      const AsAll = byStep.get(String(r.from).toLowerCase()), Bs = byStep.get(String(r.to).toLowerCase()); if (!AsAll || !Bs) { if (Bs && !AsAll) missing++; continue; }
      for (const b of Bs) {
        const el = E.stepElem(b.name), same = AsAll.filter(a => E.stepElem(a.name) === el), As = same.length ? same : AsAll;
        tested++; const label = `${r.from} → ${r.to}`; const k0 = r.from + '>' + b.id;
        const wrong = As.find(a => a !== b && reach(b, a)); if (wrong) { if (!seen.has('w' + k0)) { seen.add('w' + k0); c.items.push({ id: b.code + ' / ' + wrong.code, name: `${b.name}  ←→  ${wrong.name}`, wbs: p.wbsPath, field: 'Wrong order: ' + label, value: `Schedule has "${r.to}" before "${r.from}"; approved order is "${r.from}" then "${r.to}"`, note: r.reason || '' }); } continue; }
        if (!As.some(a => reach(a, b))) { if (!seen.has('n' + k0)) { seen.add('n' + k0); c.items.push({ id: b.code, name: b.name, wbs: p.wbsPath, field: 'Not linked after: ' + r.from, value: 'No logic path from "' + r.from + '"', note: r.reason || '' }); } continue; }
        for (const a of As) { const direct = a.succ.filter(l => l.to === b); if (!direct.length) continue; const types = direct.map(l => l.type); const hasFS = types.includes('FS'), hasSS = types.includes('SS'), hasFF = types.includes('FF');
          if (!hasFS && hasSS && !hasFF) { const kk = 'ss' + key(a, b); if (!seen.has(kk)) { seen.add(kk); c.items.push({ id: a.code + ' → ' + b.code, name: `${a.name} → ${b.name}`, wbs: p.wbsPath, field: 'Start-to-Start without Finish-to-Finish', value: types.join('+'), note: 'The finish of the successor is not held by the predecessor' }); } }
          if (r.rel === 'FS' && !hasFS && (hasSS || hasFF)) { const kk = 'ov' + key(a, b); if (!seen.has(kk)) { seen.add(kk); c.items.push({ id: a.code + ' → ' + b.code, name: `${a.name} → ${b.name}`, wbs: p.wbsPath, field: 'Overlap used where Finish-to-Start is expected', value: types.join('+'), note: r.reason || '' }); } } }
      }
    }
  }
  c.count = c.items.length; c.total = tested; c.status = c.count ? 'fail' : 'pass'; c.evidence = [`${pk.packages.length} work packages in ${Object.keys(pk.trades).length} trades; ${tested} step pairs tested; ${missing} pairs skipped because the earlier step is absent from the package.`, 'Approved sequences: ' + Object.entries(approved).map(([t, r]) => t + ' (' + r.length + ' pairs)').join(', ')];
  c.summary = c.count ? `${c.count} sequence problems across the work packages.` : 'All tested packages follow the approved sequence.';
  c.items.sort((a, b) => (a.field < b.field ? -1 : 1)); return c;
};

/* ---- critical / near-critical chains ---- */
E.chains = function (M, cfg) {
  const T = M.tasks; const crit = new Set(T.filter(t => t.tfWd != null && t.tfWd <= 1e-6)); const near = new Set(T.filter(t => t.tfCal != null && t.tfCal > 1e-6 && t.tfCal <= cfg.nearCrit));
  const comps = (set) => { const par = new Map(); set.forEach(t => par.set(t, t)); const f = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; }; for (const l of M.links) if (set.has(l.from) && set.has(l.to)) par.set(f(l.from), f(l.to)); const g = new Map(); set.forEach(t => { const r = f(t); (g.get(r) || g.set(r, []).get(r)).push(t); }); return [...g.values()].map(ts => ts.sort((a, b) => (a.es - b.es) || (a.ef - b.ef))).sort((a, b) => b.length - a.length); };
  const cc = comps(crit), nc = comps(near);
  return { crit, near, critChains: cc, nearChains: nc };
};
E.chainLines = function (M, chain, set) {
  const lines = []; chain.forEach((t, i) => { const nxt = chain[i + 1]; let lk = ''; if (nxt) { const l = t.succ.find(x => x.to === nxt); if (l) lk = `  [${l.type}${l.lagWd ? ' ' + (Math.round(l.lagWd * 10) / 10) + 'd' : ''}]`; } lines.push(`${i + 1}. ${t.code} | ${t.name} | ${t.isMile ? 'milestone' : t.cat} | ${M.zoneOf ? M.zoneOf(t) : ''} | ${t.durCal != null ? Math.round(t.durCal) : '?'}d | TF ${t.tfCal != null ? Math.round(t.tfCal) : '?'}d${lk}`); }); return lines;
};
E.cpPlain = function (M, cfg, ch) {
  const c = { id: 'CP1', group: 'Sequence & critical path', title: 'Critical path structure', tier: 'normal', status: 'pass', count: 0, items: [], evidence: [], single: false, action: 'Rebuild the logic so the longest path runs continuously through real work from start to finish.', why: 'The critical path is what the Employer uses to judge delay; it must be continuous and run through the main work.', source: '', rule: 'The critical path must be continuous, run through real work (not only milestones), pass through each phase in order without skipping construction, and not rely mainly on overlap links.' };
  const all = [...ch.crit]; const work = all.filter(t => !t.isMile);
  c.evidence.push(`Critical activities: ${all.length} (${work.length} are real work); critical chains: ${ch.critChains.length}.`);
  if (ch.critChains.length > 1) c.items.push({ id: 'Continuity', name: 'Critical path is broken into ' + ch.critChains.length + ' separate chains', wbs: '', field: 'Not continuous', value: ch.critChains.slice(0, 4).map(x => x.length).join(' / ') + ' activities', note: 'A continuous path from start to finish is expected' });
  if (all.length && work.length / all.length < 0.6) c.items.push({ id: 'Real work', name: 'Most of the critical path is milestones', wbs: '', field: 'Path runs through milestones', value: Math.round(100 * (1 - work.length / all.length)) + '% milestones', note: '' });
  const main = ch.critChains[0] || []; const phases = []; main.forEach(t => { const p = t.isMile ? null : t.cat; if (p && phases[phases.length - 1] !== p) phases.push(p); });
  c.evidence.push('Phases along the longest chain: ' + (phases.join(' → ') || 'none'));
  const hasCon = phases.includes('construction'); const hasPre = phases.some(p => ['engineering', 'procurement', 'delivery', 'mobilization'].includes(p)); const hasClose = phases.includes('closeout');
  if (hasPre && hasClose && !hasCon) c.items.push({ id: 'Phases', name: 'Path jumps from pre-construction to close-out without construction', wbs: '', field: 'Skips construction', value: phases.join(' → '), note: '' });
  if (main.length && !hasCon) c.items.push({ id: 'Phases', name: 'Longest chain contains no construction activity', wbs: '', field: 'No construction on critical path', value: phases.join(' → '), note: '' });
  const ls = M.links.filter(l => ch.crit.has(l.from) && ch.crit.has(l.to)); const ov = ls.filter(l => l.type !== 'FS'); if (ls.length && ov.length / ls.length > 0.5) c.items.push({ id: 'Links', name: 'More than half of the critical links are Start-to-Start / Finish-to-Finish', wbs: '', field: 'Overlap-driven path', value: ov.length + ' of ' + ls.length, note: '' });
  const lag = ls.filter(l => l.lagWd > 0); if (lag.length) c.evidence.push(`Critical links with positive lag: ${lag.length} (total ${Math.round(lag.reduce((s, l) => s + l.lagWd, 0))} working days).`);
  c.count = c.items.length; c.status = c.count ? 'fail' : 'pass'; c.summary = c.count ? c.count + ' structural problems on the critical path.' : 'The critical path is structurally sound.'; return c;
};
E.cpHash = (ch) => { let h = 0; const s = ch.critChains.map(x => x.map(t => t.code).join(',')).join('|') + '#' + ch.nearChains.slice(0, 6).map(x => x.length).join(','); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
E.cpPayload = function (M, ch) {
  const out = []; const mainLines = E.chainLines(M, ch.critChains[0] || []); out.push('LONGEST (CRITICAL) PATH – ' + (ch.critChains[0] || []).length + ' activities, code | name | phase | zone | duration | total float | link to next'); out.push(...mainLines.slice(0, 400));
  ch.critChains.slice(1, 4).forEach((x, i) => { out.push(''); out.push(`OTHER CRITICAL CHAIN ${i + 2} (${x.length} activities)`); out.push(...E.chainLines(M, x).slice(0, 80)); });
  ch.nearChains.slice(0, 5).forEach((x, i) => { out.push(''); out.push(`NEAR-CRITICAL CHAIN ${i + 1} (${x.length} activities)`); out.push(...E.chainLines(M, x).slice(0, 150)); });
  return out.join('\n');
};
E.cpResult = function (M, cfg, ch, ai) {
  const c = { id: 'CP', group: 'Sequence & critical path', title: 'Critical and near-critical paths are logical (AI review)', tier: 'major', status: 'notrun', count: 0, items: [], evidence: [], single: false, action: 'Review the logic of the paths identified and correct anything that does not follow the real sequence of the works.', why: 'The critical path decides the finish date; if it runs through the wrong work or hides behind overlap links, delay to the real drivers is not visible.', source: '', ai: true, rule: 'The longest path and every near-critical chain (within ' + cfg.nearCrit + ' days) are read by Claude from first to last activity and judged for whether they make sense for this project. Claude gives reasons; a person decides.' };
  if (!ai) { c.summary = 'Not run – needs AI. Open the AI reviews tab, check what will be sent, and run it.'; return c; }
  const r = ai.result; const byCode = {}; M.tasks.forEach(t => byCode[t.code] = t);
  const issues = [...((r.critical || {}).issues || []).map(i => ({ ...i, where: 'Longest path' })), ...((r.near || []).flatMap(n => (n.issues || []).map(i => ({ ...i, where: 'Near-critical chain ' + n.chain }))))];
  issues.forEach(i => { const t = byCode[i.activity]; c.items.push({ id: i.activity || '—', name: t ? t.name : (i.name || ''), wbs: t ? t.wbsPath : '', field: i.where, value: '', note: i.reason || '' }); });
  c.evidence = ['Longest path verdict: ' + ((r.critical || {}).verdict || 'n/a') + ' – ' + ((r.critical || {}).summary || ''), ...(r.near || []).map(n => `Near-critical chain ${n.chain}: ${n.verdict} – ${n.summary || ''}`), r.alternatives_view ? 'Alternative paths: ' + r.alternatives_view : ''].filter(Boolean);
  const bad = ((r.critical || {}).verdict === 'questionable') || (r.near || []).some(n => n.verdict === 'questionable') || issues.length;
  c.status = bad ? 'fail' : 'pass'; c.count = c.items.length || (bad ? 1 : 0); c.summary = bad ? 'Claude found problems with the critical / near-critical logic (see reasons).' : 'Claude judged the paths logical.'; c.aiNote = 'Reviewed by ' + ai.model + ' on ' + ai.date; return c;
};

/* ---- runner ---- */
E.runExtra = function (M, cfg, out, ctx) {
  ctx = ctx || {};
  E.curveCheck(M, cfg, out);
  const pk = E.buildPackages(M, cfg); out.pk = pk;
  const sq = { id: 'SQ', group: 'Sequence & critical path', title: 'Work sequence follows best practice for each trade', tier: 'major', status: 'notrun', count: 0, items: [], evidence: [], single: false, ai: true, rule: 'Within each work package the steps must follow the best-practice order approved for the trade (AI proposes, you approve).', action: '', why: '', source: '' };
  if (ctx.sequences && ctx.sequences.approved) out.results.push(E.testSequences(M, pk, ctx.sequences.approved));
  else { sq.summary = 'Not run – needs AI. Open the AI reviews tab to have Claude propose the sequence for each trade, then approve it.'; out.results.push(sq); }
  const ch = E.chains(M, cfg); out.chains = ch; out.results.push(E.cpPlain(M, cfg, ch));
  const hash = E.cpHash(ch); out.cpHash = hash; const ai = ctx.cpAi && ctx.cpAi.hash === hash ? ctx.cpAi : null; out.cpStale = !!(ctx.cpAi && !ai);
  out.results.push(E.cpResult(M, cfg, ch, ai));
  return out;
};
