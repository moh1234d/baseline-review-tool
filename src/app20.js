/* ===== APP PART 20: Claude-assisted review of the schedule comparison and suggested corrective / mitigation actions (v5.20) ===== */
function cmpAiSig() { const r = S.cmp.res; if (!r || !r.dly) return ''; return [S.cmp.A.name, S.cmp.B.name, r.dly.mode, r.dly.nDelayed, Math.round(r.dly.finSlip)].join('|'); }
function cmpAiResult() { const a = S.cmp && S.cmp.ai; return S.cfg.ai.cmp === true && a && a.sig === cmpAiSig() && S.cmp.aiInc !== false && (a.review || a.actions) ? a : null; }
/* compact facts sent to Claude: figures, activity codes and names, dates; no cost, no resource prices */
function cmpAiPack() {
  const r = S.cmp.res, d = r.dly, dd = v => v == null || !isFinite(v) ? null : E.fmtDate(Math.round(v)), n0 = v => v == null || !isFinite(v) ? null : Math.round(v), cap = (a, k) => a.slice(0, k);
  const pack = {
    comparison: d.base ? 'baseline against current update' : 'previous update against current update', previous_file: S.cmp.A.name, current_file: S.cmp.B.name, data_dates: [dd(d.dataA), dd(d.dataB)],
    finish: { reference: dd(d.refFinish), current: dd(d.curFinish), movement_calendar_days: n0(d.finSlip) },
    counts: { late_activities: d.nDelayed, critical_late: d.nCrit, late_with_float_or_complete: d.nOther, completed_late: d.nCompletedLate, driving_path_activities: d.path.length, activities_new_on_path: d.pathNew, points_where_delay_entered_path: d.entered },
    programme_changes: r.keyCounts || {},
    critical_late_top: cap(d.crit, 25).map(x => ({ code: x.code, name: x.name, status: x.status, ref_finish: dd(x.refFin), cur_finish: dd(x.curFin), slip_days: n0(x.slip), float_days: n0(x.tf), likely_cause: x.cause })),
    late_with_float_top: cap(d.oth, 10).map(x => ({ code: x.code, name: x.name, slip_days: n0(x.slip), float_days: n0(x.tf), likely_cause: x.cause })),
    driving_path: cap(d.path, 40).map(x => ({ code: x.code, name: x.name, status: x.status, start: dd(x.start), finish: dd(x.finish), slip_days: n0(x.slip), delay_added_days: n0(x.add), link_to_next: x.link || null, float_days: n0(x.tf) })),
    delay_by_trade: d.agg ? cap(d.agg.tr, 8) : [], delay_by_location: d.agg ? cap(d.agg.lc, 8) : [], delay_by_floor: d.agg ? cap(d.agg.fr, 10) : [],
    recovery_scenarios_recalculated: (d.scen || []).map(x => ({ scenario: x.name, days_recovered: n0(x.gain), projected_finish: dd(x.pf), days_remaining: n0(x.remain) })),
    tool_recovery_candidates_on_driving_path: cap(d.cand || [], 12).map(x => ({ code: x.code, name: x.name, remaining_working_days: n0(x.rem), best_lever: x.bt, days_saved: n0(x.best), note: x.note })),
    technical_holds_not_accelerated: d.held, settings: { late_when_more_than_days: d.tol, crew_increase_pct: d.crewPct, overlap_pct: d.overlapPct }
  };
  return JSON.stringify(pack);
}
const CMP_AI_SYS = 'You are a senior planning engineer working for the Employer\'s project management consultant (PMC) on a Gulf construction project. You are given facts computed from two Primavera P6 schedules. Use ONLY these facts: never invent activities, codes, dates, quantities or resources. Quote activity codes when you refer to an activity. One working day is 8 hours, no shifts. The recovery days in the facts are a recalculation that ignores constraints and resource limits, so treat them as indications. Do not conclude on entitlement or extension of time. Technical holds (approvals, procurement, curing, testing, authority inspections) must not be accelerated. State assumptions and anything you cannot tell from the facts. Be specific, short and plain: managers will read it. Return JSON only, with no text outside it.';
const CMP_AI_REVIEW = 'Review these schedule comparison facts. Return JSON: {"headline": "one sentence", "findings": [{"title": "", "detail": "1-2 sentences", "activities": ["codes"]}], "root_causes": [{"cause": "", "evidence": ""}], "watch_points": ["things that look wrong, hidden delay, or risky logic or duration changes"], "questions_for_contractor": [""]}. Give 4 to 6 findings, 2 to 4 root causes, up to 4 watch points and up to 5 questions.';
const CMP_AI_ACTIONS = 'Suggest corrective and mitigation actions to recover the delay. Use the tool\'s recovery candidates and scenarios as the starting point, then add your own judgement: more crews or shifts-free options, overlapping or resequencing, splitting by zone or floor, logic fixes, early procurement or approvals, access and material delivery, and management actions. Return JSON: {"actions": [{"priority": 1, "title": "", "what": "what to do in 1-2 sentences", "activities": ["codes"], "owner": "Contractor | Employer/PMC | Both", "expected_effect": "days or effect, say if it is an estimate", "needs": "what must be in place", "risk": "main risk or trade-off"}], "sequencing_note": "how the actions combine, 1-2 sentences", "not_recommended": [{"item": "", "reason": ""}]}. Give 5 to 8 actions, ordered by priority (1 is first), and at most 3 items under not_recommended.';
async function cmpAiRun(kind) {
  if (S.cfg.ai.cmp !== true) { toast('Claude AI is switched off for the comparison (toggle on the AI card).', 'warn'); return; }
  if (!S.cmp.res || !S.cmp.res.dly) { toast('Load both schedules first', 'warn'); return; }
  if (!aiReady()) return;
  const sig = cmpAiSig(); if (!S.cmp.ai || S.cmp.ai.sig !== sig) S.cmp.ai = { sig };
  const pack = cmpAiPack(), ctx = kind === 'actions' && S.cmp.ai.review ? '\n\nA first review by you found:\n' + JSON.stringify({ headline: S.cmp.ai.review.headline, root_causes: S.cmp.ai.review.root_causes }) : '';
  S.cmp.aiBusy = kind; viewCompare();
  try {
    const txt = await callClaude(kind === 'actions' ? 'cmp_actions' : 'cmp_review', CMP_AI_SYS, (kind === 'actions' ? CMP_AI_ACTIONS : CMP_AI_REVIEW) + '\n\nFACTS (JSON):\n' + pack + ctx, 4000);
    S.cmp.ai[kind === 'actions' ? 'actions' : 'review'] = parseJson(txt); S.cmp.ai.model = modelFor(kind === 'actions' ? 'cmp_actions' : 'cmp_review'); S.cmp.ai.at = new Date().toLocaleString('en-GB');
    S.cmp.aiErr = null;
  } catch (e) { console.error(e); S.cmp.aiErr = e.message; toast(e.message, 'bad'); }
  S.cmp.aiBusy = null; viewCompare();
}
function cmpAiCard() {
  const r = S.cmp.res; if (!r || !r.dly) return '';
  const a = S.cmp.ai && S.cmp.ai.sig === cmpAiSig() ? S.cmp.ai : null, busy = S.cmp.aiBusy, rv = a && a.review, ac = a && a.actions, chars = cmpAiPack().length;
  const ready = S.cfg.ai.on && S.cfg.ai.key && S.cfg.ai.consent;
  const list = (t, arr, f) => arr && arr.length ? `<h4>${t}</h4><ul>${arr.map(f).join('')}</ul>` : '';
  const codes = c => c && c.length ? ` <span class="hint">[${c.map(esc).join(', ')}]</span>` : '';
  const use = S.cfg.ai.cmp === true, tog = '';
  if (!use) return '';
  let h = `<section class="card" id="cmp-ai"><h2>Claude-assisted review <small>optional · suggestions to be checked by you</small></h2>
  <p class="hint">Claude reads the figures this tool has already worked out (finish movement, late activities, the driving path, recovery scenarios – activity codes, names, dates and days; no costs) and gives its own view of what is happening and what to do. It adds judgement on top of the tool\'s calculation; it does not replace your review. Settings, key and models are in Setup → AI.</p>
  ${ready ? '' : '<div class="warnbox">AI is off, or has no key or consent. Switch it on in Setup → AI to use these steps.</div>'}
  <div class="actions" style="flex-wrap:wrap"><button class="btn primary" data-cai="review" ${busy ? 'disabled' : ''}>${busy === 'review' ? 'Claude is reading…' : rv ? 'Re-run the review' : 'Ask Claude to review the comparison'}</button><button class="btn primary" data-cai="actions" ${busy ? 'disabled' : ''}>${busy === 'actions' ? 'Claude is thinking…' : ac ? 'Re-run the suggestions' : 'Ask Claude for corrective and mitigation actions'}</button>${a && (rv || ac) ? '<button class="btn" data-cai="clear">Clear</button>' : ''}<span class="hint">About ${fmtN(Math.round(chars / 1000))}k characters are sent per step · estimated cost per step ≈ USD ${estimateCost('cmp_review', chars, 1500).toFixed(2)}</span></div>
  ${S.cmp.aiErr ? `<div class="warnbox">${esc(S.cmp.aiErr)}</div>` : ''}`;
  if (rv) h += `<div style="margin-top:12px"><b>${esc(rv.headline || '')}</b>${list('Findings', rv.findings, x => `<li><b>${esc(x.title)}</b> – ${esc(x.detail)}${codes(x.activities)}</li>`)}${list('Likely root causes', rv.root_causes, x => `<li><b>${esc(x.cause)}</b> – ${esc(x.evidence)}</li>`)}${list('Watch points', rv.watch_points, x => `<li>${esc(x)}</li>`)}${list('Questions for the contractor', rv.questions_for_contractor, x => `<li>${esc(x)}</li>`)}</div>`;
  if (ac) h += `<div style="margin-top:12px"><h4>Suggested corrective and mitigation actions</h4><table class="tbl compact"><thead><tr><th>#</th><th>Action</th><th>Owner</th><th>Expected effect</th><th>Needs</th><th>Risk / trade-off</th><th></th></tr></thead><tbody>${(ac.actions || []).map((x, i) => `<tr><td>${esc(x.priority != null ? x.priority : i + 1)}</td><td><b>${esc(x.title)}</b><br>${esc(x.what)}${codes(x.activities)}</td><td>${esc(x.owner)}</td><td>${esc(x.expected_effect)}</td><td>${esc(x.needs)}</td><td>${esc(x.risk)}</td><td><button class="btn" data-cai-del="${i}" title="Remove this suggestion">✕</button></td></tr>`).join('')}</tbody></table>${ac.sequencing_note ? `<p><b>How they combine:</b> ${esc(ac.sequencing_note)}</p>` : ''}${list('Not recommended', ac.not_recommended, x => `<li><b>${esc(x.item)}</b> – ${esc(x.reason)}</li>`)}</div>`;
  if (rv || ac) h += `<label class="sw" style="margin-top:10px"><input type="checkbox" data-cai-inc="1" ${S.cmp.aiInc !== false ? 'checked' : ''}><span>Include Claude's review and suggestions in the Word report and the Excel appendix (marked as AI-assisted)</span></label><p class="hint">Made ${esc(a.at || '')} by ${esc(a.model || '')}. Check every suggestion against the site and the contract before you use it.</p>`;
  return h + '</section>';
}
document.addEventListener('click', e => { const t = e.target; let el;
  if ((el = t.closest('[data-cai]'))) { const k = el.dataset.cai; if (k === 'clear') { S.cmp.ai = null; S.cmp.aiErr = null; viewCompare(); } else cmpAiRun(k); return; }
  if ((el = t.closest('[data-cai-del]'))) { const a = S.cmp.ai; if (a && a.actions) { a.actions.actions.splice(+el.dataset.caiDel, 1); viewCompare(); } return; } });
document.addEventListener('change', e => { const t = e.target; if (!t.matches) return; if (t.matches('[data-cai-inc]')) S.cmp.aiInc = t.checked; if (t.matches('[data-cai-use]')) { S.cfg.ai.cmp = t.checked; saveAiSettings(); renderNav(); viewCompare(); } });
/* AI content for the Word report and the Excel appendix */
function rpAiWord(ctx) { const a = cmpAiResult(); if (!a) return false; const { ch, P, bullet, H1, H2, grid, run, GREY } = ctx; const rv = a.review, ac = a.actions, cd = c => c && c.length ? ' [' + c.join(', ') + ']' : '';
  ch.push(H1('7. Claude-assisted review'));
  ch.push(P('Prepared with Claude (' + (a.model || 'AI') + ') from the figures in this report. It is an AI-assisted opinion to be verified by the project team, and it does not assess entitlement or an extension of time.', { run: { italics: true, color: GREY } }));
  if (rv) { if (rv.headline) ch.push(P(rv.headline, { run: { bold: true, size: 23 } })); if (rv.findings && rv.findings.length) { ch.push(H2('Findings')); rv.findings.forEach(x => ch.push(bullet([run(x.title + ' – ', { bold: true }), run(x.detail + cd(x.activities))]))); }
    if (rv.root_causes && rv.root_causes.length) { ch.push(H2('Likely root causes')); rv.root_causes.forEach(x => ch.push(bullet([run(x.cause + ' – ', { bold: true }), run(x.evidence)]))); }
    if (rv.watch_points && rv.watch_points.length) { ch.push(H2('Watch points')); rv.watch_points.forEach(x => ch.push(bullet(x))); }
    if (rv.questions_for_contractor && rv.questions_for_contractor.length) { ch.push(H2('Questions for the contractor')); rv.questions_for_contractor.forEach(x => ch.push(bullet(x))); } }
  if (ac && ac.actions && ac.actions.length) { ch.push(H2('Suggested corrective and mitigation actions')); ch.push(grid(['#', 'Action', 'Owner', 'Expected effect', 'Risk / trade-off'], ac.actions.map((x, i) => [String(x.priority != null ? x.priority : i + 1), x.title + ' – ' + x.what + cd(x.activities) + (x.needs ? ' Needs: ' + x.needs : ''), x.owner || '', x.expected_effect || '', x.risk || '']), [500, 4100, 1200, 2000, 2106]));
    if (ac.sequencing_note) ch.push(P('How they combine: ' + ac.sequencing_note, { run: { italics: true } })); if (ac.not_recommended && ac.not_recommended.length) { ch.push(H2('Not recommended')); ac.not_recommended.forEach(x => ch.push(bullet([run(x.item + ' – ', { bold: true }), run(x.reason)]))); } }
  return true; }
function rpAiSheets(sheet) { const a = cmpAiResult(); if (!a) return; const rv = a.review, ac = a.actions, cd = c => c && c.length ? c.join(', ') : '';
  if (rv) { const rows = []; (rv.findings || []).forEach(x => rows.push(['Finding', x.title, x.detail, cd(x.activities)])); (rv.root_causes || []).forEach(x => rows.push(['Root cause', x.cause, x.evidence, ''])); (rv.watch_points || []).forEach(x => rows.push(['Watch point', x, '', ''])); (rv.questions_for_contractor || []).forEach(x => rows.push(['Question', x, '', ''])); sheet('AI review', 'Claude-assisted review (AI opinion, to be verified)' + (rv.headline ? ' – ' + rv.headline : ''), ['Type', 'Title', 'Detail', 'Activities'], rows, [18, 50, 90, 30], 'FF7C3AED'); }
  if (ac && ac.actions) { const rows = ac.actions.map((x, i) => [x.priority != null ? x.priority : i + 1, x.title, x.what, cd(x.activities), x.owner, x.expected_effect, x.needs, x.risk]); (ac.not_recommended || []).forEach(x => rows.push(['–', 'Not recommended: ' + x.item, x.reason, '', '', '', '', ''])); sheet('AI actions', 'Claude-suggested corrective and mitigation actions (AI opinion, to be verified)' + (ac.sequencing_note ? ' – ' + ac.sequencing_note : ''), ['Priority', 'Action', 'What to do', 'Activities', 'Owner', 'Expected effect', 'Needs', 'Risk / trade-off'], rows, [9, 40, 70, 28, 18, 34, 40, 40], 'FF7C3AED'); } }

/* on/off switch, shown at the top of the comparison page (before any file is loaded). Default: OFF */
function cmpAiSwitch() { const use = S.cfg.ai.cmp === true;
  return `<div class="card" style="margin-bottom:14px;border-left:4px solid ${use ? '#0B7A75' : '#9AA5B1'}"><label class="sw" style="margin:0"><input type="checkbox" data-cai-use="1" style="width:22px;height:22px;flex:none" ${use ? "checked" : ""}><span><b>Use Claude AI in this comparison</b> – ${use ? 'ON: after both schedules are loaded, a Claude review card appears with the review and suggestion buttons.' : 'OFF (default): no AI step runs, nothing is sent to Anthropic, and no AI text goes into the report or appendix.'}${use && !(S.cfg.ai.on && S.cfg.ai.key && S.cfg.ai.consent) ? ' <span class="hint">Also needs the key and consent in Setup → AI.</span>' : ''}</span></label></div>`; }

/* ===== v6.0 shell: phone menu ===== */
document.addEventListener('click', e => { const t = e.target; if (t.closest && t.closest('#tb-menu')) { document.body.classList.toggle('navopen'); return; } if (document.body.classList.contains('navopen') && !(t.closest && t.closest('#nav') && !t.closest('[data-go]'))) document.body.classList.remove('navopen'); });
