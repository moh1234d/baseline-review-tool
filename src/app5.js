/* ===== APP PART 5: AI reviews (sequence, critical path), progress-curve inputs, report tick boxes ===== */
GROUP_ORDER.splice(GROUP_ORDER.indexOf('Schedule logic') + 1, 0, 'Sequence & critical path');
Object.assign(WHY, {
  R8: 'A back-loaded progress curve pushes risk to the end of the contract and hides early delay; progress reports become unreliable.',
  SQ: 'If the logic does not follow the way the work is built, the dates are not achievable and delay to one step will not move the next.',
  CP1: 'The critical path is what the Employer uses to judge delay; it must be continuous and run through the main work.',
  CP: 'The critical path decides the finish date; if it runs through the wrong work or hides behind overlap links, delay to the real drivers is not visible.'
});
S.held = S.held || {};
const EXTRA_IDS = ['R8', 'SQ', 'CP1', 'CP'];
function refreshExtra() {
  const o = S.out; if (!o) return; o.results = o.results.filter(r => !EXTRA_IDS.includes(r.id));
  E.runExtra(S.M, S.cfg, o, { sequences: S.cfg.sequences, cpAi: S.cpAi }); allocNumbers(); autosave();
}
const jsonSys = 'You are a senior planning engineer reviewing a contractor\'s baseline construction programme for the Employer\'s project management consultant. You give judgements and reasons only; a person decides. Answer with JSON only.';
function seqPromptText() {
  return `Below, for each trade, are the step names used in the contractor's work packages and one example package in scheduled order. For each trade, give the best-practice construction order as pairs of steps (earlier step → later step) using ONLY the exact step names listed. Include only pairs that are really required (not every combination). For each pair say whether the relationship must be Finish-to-Start ("FS") or whether overlap is normal for long linear works so that Start-to-Start with lag together with Finish-to-Finish with lag is acceptable ("FS_OR_SSFF"). Add a short reason. A step name can repeat for different elements of the same package (e.g. raft, walls, slab); each pair applies within the same element only. Tests and inspections come before the work that covers or builds on the tested item. Ignore step names that are one-off items (e.g. a specific manhole number).\nReturn JSON: {"trades":{"<trade>":{"pairs":[{"from":"","to":"","rel":"FS|FS_OR_SSFF","reason":""}],"note":""}}}\n\n`;
}
function renderAi() {
  const ai = S.cfg.ai, pk = S.out.pk; const off = !ai.on || !ai.key;
  const seq = S.cfg.sequences, prop = S.seqProposal, ch = S.out.chains;
  const sp = E.sequencePayload(pk), cp = E.cpPayload(S.M, ch);
  const cost = (task, txt) => '$' + estimateCost(task, txt.length + 1500, 2500).toFixed(2);
  let h = `<div class="card"><h2>AI reviews</h2><p class="hint">These two checks need Claude. Claude only gives judgements and reasons – code does the testing, and you decide what goes in the report. ${off ? '<b>AI is ' + (ai.on ? 'missing an API key' : 'switched off for this project') + ' (Setup → AI); both checks stay "Not run".</b>' : ''}</p></div>`;
  h += `<div class="card"><h2>1. Sequence of work per trade</h2><p class="hint">Status: ${seq && seq.approved ? '<span class="chip ok">approved ' + esc(seq.date || '') + '</span> – tested on all ' + pk.packages.length + ' work packages' : '<span class="chip">not approved yet</span>'}. Claude proposes the build order for each trade from one example package; you approve or edit it once and the code tests every package. The approved order is saved with the project.</p>
  <details><summary>What will be sent to Claude (${fmtN(sp.length)} characters, est. ${cost('sequence', sp)} with ${esc(modelFor('sequence'))})</summary><pre class="prev">${esc(seqPromptText() + sp)}</pre><p class="hint">Only activity step names and the order of one example package per trade. No costs, no contract text.</p></details>
  <div class="actions"><button class="btn primary" id="ai-seq" ${off ? 'disabled' : ''}>Ask Claude to propose the sequences</button></div>`;
  if (prop) {
    h += '<div id="seq-edit">';
    for (const [trade, v] of Object.entries(prop.trades)) {
      h += `<h3>${esc(trade)} <small class="mut">${esc(v.note || '')}</small></h3><table class="t"><tr><th>Use</th><th>Earlier step</th><th>Later step</th><th>Relationship</th><th>Reason</th></tr>`;
      (v.pairs || []).forEach((p, i) => { h += `<tr><td><input type="checkbox" data-seq="${esc(trade)}|${i}|on" ${p.on !== false ? 'checked' : ''}></td><td>${esc(p.from)}</td><td>${esc(p.to)}</td><td><select data-seq="${esc(trade)}|${i}|rel"><option value="FS" ${p.rel === 'FS' ? 'selected' : ''}>Finish-to-Start only</option><option value="FS_OR_SSFF" ${p.rel !== 'FS' ? 'selected' : ''}>FS, or SS+FF with lags</option></select></td><td>${esc(p.reason || '')}</td></tr>`; });
      h += '</table>';
    }
    h += `</div><div class="actions"><button class="btn primary" id="seq-approve">Approve these sequences and run the test</button></div>`;
  }
  h += '</div>';
  h += `<div class="card"><h2>2. Critical and near-critical paths</h2><p class="hint">Code traces the longest path and every near-critical chain (within ${S.cfg.nearCrit} days). Claude reads each chain from first to last activity and says whether it makes sense for this project. ${S.cpAi ? (S.out.cpStale ? '<span class="chip open">Result is out of date – the paths changed, run again</span>' : '<span class="chip ok">done ' + esc(S.cpAi.date) + ' with ' + esc(S.cpAi.model) + '</span>') : ''}</p>
  <p class="hint">${ch.critChains.length} critical chain(s) (${ch.crit.size} activities) · ${ch.nearChains.length} near-critical chain(s) (${ch.near.size} activities)</p>
  <details><summary>What will be sent to Claude (${fmtN(cp.length)} characters, est. ${cost('critpath', cp)} with ${esc(modelFor('critpath'))})</summary><pre class="prev">${esc(cp)}</pre><p class="hint">Activity codes, names, durations, float and link types of the chains only.</p></details>
  <div class="actions"><button class="btn primary" id="ai-cp" ${off ? 'disabled' : ''}>Ask Claude to review the paths</button></div></div>`;
  $('#tab-body').innerHTML = h;
}
async function aiSeq() {
  const b = $('#ai-seq'); b.disabled = true; b.textContent = 'Claude is working…';
  try {
    const t = await callClaude('sequence', jsonSys, seqPromptText() + E.sequencePayload(S.out.pk), 6000); const j = parseJson(t);
    const trades = {}; for (const [k, v] of Object.entries(j.trades || {})) { const known = S.out.pk.trades[k]; if (!known) continue; const names = new Set([...known.steps.keys()].map(x => x.toLowerCase())); trades[k] = { note: v.note, pairs: (v.pairs || []).filter(p => p.from && p.to && names.has(String(p.from).toLowerCase()) && names.has(String(p.to).toLowerCase())).map(p => ({ from: p.from, to: p.to, rel: p.rel === 'FS' ? 'FS' : 'FS_OR_SSFF', reason: p.reason, on: true })) }; }
    S.seqProposal = { trades, model: modelFor('sequence') }; toast('Proposal ready – review it, then approve.', 'ok');
  } catch (e) { toast(e.message, 'bad'); }
  renderAi();
}
function seqApprove() {
  const approved = {}; for (const [k, v] of Object.entries(S.seqProposal.trades)) { const r = v.pairs.filter(p => p.on !== false).map(p => ({ from: p.from, to: p.to, rel: p.rel, reason: p.reason })); if (r.length) approved[k] = r; }
  S.cfg.sequences = { approved, date: new Date().toISOString().slice(0, 10), model: S.seqProposal.model }; refreshExtra(); toast('Sequences approved and tested', 'ok'); renderAi();
}
async function aiCp() {
  const b = $('#ai-cp'); b.disabled = true; b.textContent = 'Claude is working…';
  try {
    const ch = S.out.chains, payload = E.cpPayload(S.M, ch);
    const prompt = `Judge the longest (critical) path and each near-critical chain of this construction programme (${S.cfg.projectName || 'project'}). Read each chain from the first to the last activity. Does it follow a logical real-world sequence? Is it continuous, does it run through the main work, does it jump between unrelated work, rely on odd links or large lags, or hide behind overlap links? Notes: lags and SS/FF links are acceptable for linear works if sensible. Give a verdict "logical" or "questionable" for each chain and list only the activities (by code) where something is wrong, with a one-sentence reason.\nReturn JSON: {"critical":{"verdict":"","summary":"","issues":[{"activity":"code","reason":""}]},"near":[{"chain":1,"verdict":"","summary":"","issues":[{"activity":"code","reason":""}]}],"alternatives_view":"one sentence on whether the near-critical chains are a real risk to the finish"}\n\n` + payload;
    const j = parseJson(await callClaude('critpath', jsonSys, prompt, 5000));
    S.cpAi = { hash: S.out.cpHash, result: j, model: modelFor('critpath'), date: new Date().toISOString().slice(0, 10) }; refreshExtra(); toast('Path review done', 'ok');
  } catch (e) { toast(e.message, 'bad'); }
  renderAi();
}
/* ---- report tick boxes ---- */
const isHeld = r => !!S.held[r.id];
const issued = () => S.out.results.filter(r => r.status === 'fail' && !isHeld(r));
function setHeld(fn) { S.out.results.filter(r => r.status === 'fail').forEach(r => { if (fn(r)) delete S.held[r.id]; else S.held[r.id] = true; }); autosave(); }
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.inc) { el.checked ? delete S.held[el.dataset.inc] : S.held[el.dataset.inc] = true; autosave(); const a = el.closest('.chk'); if (a) a.classList.toggle('held', !el.checked); return; }
  if (el.dataset.seq) { const [t, i, f] = el.dataset.seq.split('|'); const p = S.seqProposal.trades[t].pairs[+i]; if (f === 'on') p.on = el.checked; else p.rel = el.value; }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'ai-seq') aiSeq(); else if (b.id === 'seq-approve') seqApprove(); else if (b.id === 'ai-cp') aiCp();
  else if (b.id === 'inc-all') { setHeld(() => true); renderExport(); } else if (b.id === 'inc-none') { setHeld(() => false); renderExport(); } else if (b.id === 'inc-major') { setHeld(r => r.tier === 'major'); renderExport(); }
});

/* ===== Not-run checks: fill the missing input ===== */
function fixButtons(r) {
  const s = r.summary || '', id = r.id; let h = '';
  if (/not entered|No contractual milestones/i.test(s)) h = `<button class="btn sm" data-fill="${id}">Fill from contract documents (Claude)</button><button class="btn sm" data-go="setup">Enter it myself</button>`;
  else if (/resource not identified/i.test(s)) h = '<button class="btn sm" data-go="confirm">Choose the resource in Confirmations</button>';
  else if (/approval activities/i.test(s)) h = '<button class="btn sm" data-go="confirm">Select approval activities in Confirmations</button>';
  else if (/Not provided/i.test(s)) h = '<button class="btn sm" data-go="files">Add the document in Files</button>';
  else if (/Eid/i.test(s) || r.id === 'L11b') h = '<button class="btn sm" data-go="confirm">Enter the Eid dates in Confirmations</button>';
  return h ? `<div class="actions fixrow">${h}</div><div id="fill-${id}"></div>` : '';
}
function rerunChecks() {
  const M = S.M, c = S.cfg; E.applyCategories(M, c.wbsMap); const out = E.run(M, c); E.runDocs(M, c, out); E.runExtra(M, c, out, { sequences: c.sequences, cpAi: S.cpAi });
  S.out = out; allocNumbers(); autosave(); viewReport();
}
async function fillFromDocs(id) {
  const box = $('#fill-' + id);
  const text = (typeof relevantContractText === 'function') ? relevantContractText() : '';
  if (!text || !text.trim()) { box.innerHTML = '<div class="found"><b>No contract document is loaded.</b> This value is stated in the contract (Agreement / Particulars / Time clauses). Upload it in <a href="#" data-go="files">Files → Contract documents</a>, then press this button again. If the PDF is a scan, tick OCR when loading it.</div>'; return; }
  if (!aiReady()) return;
  box.innerHTML = '<div class="found">Claude is reading the contract documents…</div>';
  try {
    let res = S.contractFound;
    if (!res) {
      const chunks = []; let cur = ''; for (const p of text.split(/\n(?=\[)/)) { if ((cur + p).length > 24000) { chunks.push(cur); cur = ''; } cur += '\n' + p; } if (cur.trim()) chunks.push(cur);
      const sys = 'You extract facts from construction contract documents. Reply with JSON only. Never guess: use null when a value is not stated. For every value give the exact quote and the source tag shown in brackets, e.g. "[file p.12]".';
      const q = 'Return JSON: {"contractValue":{"value":number|null,"currency":string|null,"quote":string,"source":string},"duration":{"value":number|null,"unit":"months"|"days"|null,"quote":string,"source":string},"commencement":{"date":"YYYY-MM-DD"|null,"quote":string,"source":string},"reviewPeriodDays":{"value":number|null,"quote":string,"source":string},"milestones":[{"name":string,"days":number|null,"date":"YYYY-MM-DD"|null,"quote":string,"source":string}]}';
      res = []; for (const ch of chunks) res.push(parseJson(await callClaude('read_contract', sys, q + '\n\nDOCUMENT TEXT:\n' + ch, 2500))); S.contractFound = res;
    }
    const first = k => res.map(r => r[k]).find(x => x && (x.value != null || x.date != null)); const c = S.cfg, rows = [];
    const add = (key, label, have, f, show, apply) => { if (have) return; const v = f; if (v) rows.push({ key, label, show: show(v), quote: v.quote, source: v.source, apply: () => apply(v) }); };
    add('cv', 'Contract value', c.contractValue, first('contractValue'), v => fmtN(v.value) + ' ' + (v.currency || ''), v => c.contractValue = v.value);
    add('du', 'Contract duration', c.durationValue, first('duration'), v => v.value + ' ' + (v.unit || 'months'), v => { c.durationValue = v.value; c.durationUnit = v.unit || 'months'; });
    add('nt', 'Commencement / NTP date', c.ntp, (first('commencement') || {}).date ? first('commencement') : null, v => v.date, v => c.ntp = v.date);
    add('rv', 'Review period (days)', c.reviewDays, first('reviewPeriodDays'), v => v.value + ' days', v => c.reviewDays = v.value);
    const ms = res.flatMap(r => r.milestones || []).filter(m => m.name && (m.days != null || m.date));
    if (!(c.milestones || []).length && ms.length) ms.forEach((m, i) => rows.push({ key: 'ms' + i, label: 'Milestone', show: m.name + ' – ' + (m.days != null ? m.days + ' days' : m.date), quote: m.quote, source: m.source, apply: () => { c.milestones = c.milestones || []; c.milestones.push({ name: m.name, days: m.days, date: m.date, actId: null, quote: m.quote, source: m.source }); } }));
    S.fillRows = rows;
    if (!rows.length) { box.innerHTML = '<div class="found"><b>Claude did not find the missing value(s) in the loaded documents.</b> Check that the right contract pages are loaded, or enter the value in Setup.</div>'; return; }
    box.innerHTML = `<div class="found"><b>Claude found these. Check each against its quote before accepting – nothing is used until you accept.</b><table class="tbl compact"><tbody>${rows.map((r, i) => `<tr><td><input type="checkbox" data-fillrow="${i}" checked></td><td>${esc(r.label)}</td><td><b>${esc(r.show)}</b></td><td><q>${esc(r.quote || '')}</q></td><td>${esc(r.source || '')}</td></tr>`).join('')}</tbody></table><div class="actions"><button class="btn primary sm" id="fill-accept">Accept ticked values and re-run the checks</button></div><small class="hint">Milestones still need to be matched to programme activities in Confirmations.</small></div>`;
  } catch (e) { box.innerHTML = '<div class="found bad">' + esc(e.message) + '</div>'; }
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fill]'); if (f) { e.preventDefault(); fillFromDocs(f.dataset.fill); return; }
  const b = e.target.closest('#fill-accept'); if (b) { const on = [...document.querySelectorAll('[data-fillrow]')].filter(x => x.checked).map(x => +x.dataset.fillrow); on.forEach(i => S.fillRows[i].apply()); toast(on.length + ' value(s) accepted – re-running the checks', 'ok'); rerunChecks(); }
});
