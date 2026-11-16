/* ===== APP PART 28: Recovery planner AI (v8.9) – OFF by default; Claude is a second opinion, the engine keeps every number ===== */
const RPAI_CAUSES = { design: 'Design / approval', procurement: 'Procurement / delivery', access: 'Site access / handover', resources: 'Productivity / resources', scope: 'Scope change / variation', authority: 'Authority / third party', logic: 'Logic or sequence change', unknown: 'Cannot tell' };
AI_TASKS.push({ id: 'rp_review', label: 'Recovery planner – causes, lever review, extra ideas', def: 'claude-sonnet-5-5' }, { id: 'rp_words', label: 'Recovery planner – action wording and contractor questions', def: 'claude-sonnet-5-5' });
const rpAiOn = () => S.cfg.ai && S.cfg.ai.rp === true;
const rpAiSt = () => (S.rpAi = S.rpAi || { rev: null, words: null, busy: false, err: '', dec: {}, tone: 'contractor', anon: LS.get('brt.rpAnon', true) !== false });
function rpAiSigLev(D, R) { const T = D.train; return [R.A.name, R.B.name, R.pathIdx || 0, T.target.slip, T.cars.length, D.lev ? D.lev.levers.map(l => l.kind + l.car + ':' + l.gain).join(',') : '', rpAiSt().anon ? 'a' : 'n'].join('|'); }
function rpAiSigOn(D, R) { return rpAiSigLev(D, R) + '|' + [...D.levOn].sort().join(',') + '|' + rpAiSt().tone; }
/* facts sent: activity names, dates-free day counts, lever shapes. No cost, no resources, no project / file name. */
function rpAiPack(D, R) {
  const T = D.train, st = rpAiSt(), al = new Map(), rev = new Map(); let n = 0;
  const cd = r => { if (!st.anon) return r.code; if (!al.has(r.code)) { al.set(r.code, 'A' + (++n)); rev.set('A' + n, r.code); } return al.get(r.code); };
  const pack = {
    finish: { baseline: RPD(T.target.fA), current_forecast: RPD(T.target.fB), slip_days: T.target.slip },
    cars: T.cars.map((c, i) => ({ car: i + 1, phase: c.phase, stage: c.title, days_added: c.delta, delay_starts_here: !!c.isOrigin,
      activities: c.rows.slice().sort((a, b) => Math.abs(b.own) - Math.abs(a.own)).slice(0, 6).map(r => ({ id: cd(r), name: r.name, status: r.status, planned_days: r.pDur, actual_or_current_days: r.cDur, days_added: r.own })) })),
    levers: (D.lev ? D.lev.levers : []).map((l, i) => ({ lever: i, kind: l.kind, label: l.label, car: l.car + 1, stage: T.cars[l.car].title, days_gained_alone_engine: l.gain, identical_copies: l.copies || 1,
      examples: E.leverExamples(T, l, 4).map(x => x.kind === 'dur' ? { activity: x.name || x.id, duration_from: x.from, duration_to: x.to } : { predecessor: x.pred, successor: x.succ, link_now: x.before, link_with_lever: x.after }) })),
    selected_levers: [...D.levOn], engine_days_recovered_selected: D.comb ? D.comb.gain : 0
  };
  return { pack, rev };
}
function rpAiBack(txt, rev) { return esc(String(txt == null ? '' : txt)).replace(/\bA(\d{1,4})\b/g, (m) => rev && rev.has(m) ? rev.get(m) : m); }
const RPAI_SYS = `You are a senior planning engineer in a project-management consultancy reviewing a contractor's recovery options. You receive FACTS calculated by a schedule engine from a Primavera P6 update: a delay train (cars = stages of the driving path) and mitigation levers the engine tested. All numbers come from the engine. Do not calculate, change or invent any number, date or duration; quote only figures present in the facts. Everything you write is a SUGGESTION for the planner to confirm. Write plain English, short, specific to the activity names given. Reply with JSON only, no text around it.`;
async function rpAiRunReview() {
  const D = trSt('rp'), R = S.rp, st = rpAiSt(); if (!aiReady()) return; const { pack, rev } = rpAiPack(D, R); st.busy = 'review'; st.err = ''; viewRecovery();
  try {
    const sys = RPAI_SYS + `\nTask: (1) for every car that has days_added > 0 or delay_starts_here, classify the most likely cause: one of ${Object.keys(RPAI_CAUSES).join(', ')}, with confidence 0 to 1 and a one-sentence reason from the activity names / durations; (2) review every lever: verdict "sound", "check" or "illogical" with a one-sentence reason (illogical = would break physical sequence such as rebar before pour, or approval before submission; check = depends on something the facts do not show); (3) up to 4 extra recovery ideas for cars on the path, each one sentence, not duplicating the levers.\nJSON: {"causes":[{"car":1,"cause":"design","confidence":0.7,"reason":"..."}],"levers":[{"lever":0,"verdict":"sound","reason":"..."}],"extra":[{"car":2,"idea":"..."}]}`;
    const txt = await callClaude('rp_review', sys, JSON.stringify(pack), 3000), j = parseJson(txt);
    if (!j || typeof j !== 'object') throw new Error('Claude did not return readable JSON');
    st.rev = { sig: rpAiSigLev(D, R), rev, causes: (j.causes || []).filter(x => x && x.car), levers: (j.levers || []).filter(x => x && x.lever != null), extra: (j.extra || []).filter(x => x && x.idea), at: Date.now() }; st.dec = {};
  } catch (e) { console.error(e); st.err = e.message; }
  st.busy = false; viewRecovery();
}
async function rpAiRunWords() {
  const D = trSt('rp'), R = S.rp, st = rpAiSt(); if (!aiReady()) return; if (!D.levOn.size) { toast('Switch on at least one lever first.', 'warn'); return; }
  const { pack, rev } = rpAiPack(D, R); pack.selected_levers_detail = [...D.levOn].map(i => pack.levers[i]); st.busy = 'words'; st.err = ''; viewRecovery();
  try {
    const aud = st.tone === 'employer' ? 'the employer (formal, concise, decision-oriented)' : 'the contractor (written as a request "to check with the contractor": confirm, justify, submit, never an order)';
    const sys = RPAI_SYS + `\nTask: write the corrective action for each SELECTED lever for ${aud}, one or two sentences, naming the real activities; add one action for the stage where the delay starts; then up to 6 questions to put to the contractor about the delay causes and the feasibility of the levers.\nJSON: {"actions":[{"lever":0,"text":"..."},{"lever":"origin","text":"..."}],"questions":[{"car":1,"text":"..."}]}`;
    const txt = await callClaude('rp_words', sys, JSON.stringify(pack), 3000), j = parseJson(txt);
    if (!j || typeof j !== 'object') throw new Error('Claude did not return readable JSON');
    st.words = { sig: rpAiSigOn(D, R), rev, actions: (j.actions || []).filter(x => x && x.text), questions: (j.questions || []).filter(x => x && x.text), at: Date.now() };
  } catch (e) { console.error(e); st.err = e.message; }
  st.busy = false; viewRecovery();
}
const rpAiRev = (D, R) => { const r = rpAiSt().rev; return r && r.sig === rpAiSigLev(D, R) ? r : null; };
const rpAiWords = (D, R) => { const w = rpAiSt().words; return w && w.sig === rpAiSigOn(D, R) ? w : null; };
const rpAiVerdict = (D, R, i) => { const r = rpAiRev(D, R); return r ? r.levers.find(x => +x.lever === i) || null : null; };
/* accepted AI wording replaces the fixed sentence in the Word report and the Excel table */
function rpAiAccepted(D, key) { if (!rpAiOn()) return null; const R = S.rp, w = rpAiWords(D, R), st = rpAiSt(); if (!w || st.dec['w:' + key] !== 'acc') return null; const a = w.actions.find(x => String(x.lever) === String(key)); return a ? String(a.text).replace(/\bA(\d{1,4})\b/g, m => w.rev && w.rev.has(m) ? w.rev.get(m) : m) : null; }
/* engine recalculation of the AI-vetted set: levers the AI called illogical are dropped */
function rpAiVetted(D, R) {
  const rv = rpAiRev(D, R); if (!rv || !D.lev) return null; const ab = trAB('rp'); if (!ab) return null;
  const bad = new Set(rv.levers.filter(x => x.verdict === 'illogical').map(x => +x.lever)), keep = [...D.levOn].filter(i => !bad.has(i)), dropped = [...D.levOn].filter(i => bad.has(i));
  const on = keep.sort((a, b) => D.lev.levers[a].car - D.lev.levers[b].car || D.lev.levers[b].gain - D.lev.levers[a].gain).map(i => D.lev.levers[i]);
  const comb = on.length ? E.trainCombine(ab[1], on, { r0: D.r0 }) : { gain: 0 }; return { keep, dropped, gain: comb.gain || 0 };
}
function rpAiCompareRows(D, R) {
  const T = D.train, N = rpNums(D), rv = rpAiRev(D, R), w = rpAiWords(D, R), st = rpAiSt(), v = rv ? rpAiVetted(D, R) : null, fx = rpActions(D), rows = [];
  const dec = Object.values(st.dec), acc = dec.filter(x => x === 'acc').length, rej = dec.filter(x => x === 'rej').length, total = rv ? rv.causes.length + rv.levers.length + rv.extra.length + (w ? w.actions.length + w.questions.length : 0) : 0;
  rows.push(['Levers switched on', N.nOn, v ? v.keep.length + (v.dropped.length ? ' (AI would drop ' + v.dropped.length + ')' : '') : 'run the AI review']);
  rows.push(['Days recovered (engine recalculation)', N.gain + ' d', v ? v.gain + ' d' : '–']);
  rows.push(['Forecast finish with levers', RPD(T.target.fB - N.gain), v ? RPD(T.target.fB - v.gain) : '–']);
  rows.push(['Delay causes classified', '0 (not done)', rv ? rv.causes.length + ' car(s), to confirm' : '–']);
  rows.push(['Levers with a logic verdict', '0 (engine tests dates, not sense)', rv ? rv.levers.length + ' (' + rv.levers.filter(x => x.verdict === 'illogical').length + ' illogical, ' + rv.levers.filter(x => x.verdict === 'check').length + ' to check)' : '–']);
  rows.push(['Corrective actions', fx.con.length + fx.auth.length + ' (fixed wording)', w ? w.actions.length + ' (AI wording)' : '–']);
  rows.push(['Questions for the contractor', '0', w ? w.questions.length : '–']);
  rows.push(['Extra ideas (not recalculated)', '0', rv ? rv.extra.length : '–']);
  rows.push(['Your decisions on AI suggestions', '–', total ? acc + ' accepted · ' + rej + ' rejected · ' + (total - acc - rej) + ' open' : '–']);
  return { rows, v };
}
function rpAiPanel(D, R, T) {
  const st = rpAiSt(), on = rpAiOn(), ready = !!(S.cfg.ai.on && (S.cfg.ai.key || aiViaProxy()) && S.cfg.ai.consent);
  const sw = `<b>Claude AI</b> – second opinion on causes, levers and wording; it never changes a number.${!ready ? ' <span class="hint">Needs your key and consent in Setup → AI.</span>' : ''}`;
  if (!on) return '';
  if (!T) return `<section class="card rpai" style="margin-top:14px;border-left:4px solid #0B7A75">${sw}<p class="hint" style="margin:8px 0 0">Load both files to run the AI review.</p></section>`;
  if (false) return `<section class="card rpai off" style="margin-top:14px;border-left:4px solid #9AA5B1">${sw}</section>`;
  const { pack } = rpAiPack(D, R), chars = JSON.stringify(pack).length, c1 = estimateCost('rp_review', chars, 1500), c2 = estimateCost('rp_words', chars, 1500), rv = rpAiRev(D, R), w = rpAiWords(D, R), busy = st.busy;
  const tag = '<span class="rpai-tag" title="Claude suggestion – check it before you use it">AI suggestion</span>', btn = (id, lab, extra) => `<button class="btn ${extra || ''}" data-rpai-run="${id}" ${busy ? 'disabled' : ''}>${lab}</button>`;
  const dec = (key) => { const d = st.dec[key]; return `<span class="rpai-dec"><button class="btn sm ${d === 'acc' ? 'primary' : ''}" data-rpai-dec="${key}:acc">Accept</button><button class="btn sm ${d === 'rej' ? 'primary' : ''}" data-rpai-dec="${key}:rej">Reject</button></span>`; };
  let h = `<section class="card rpai" style="margin-top:14px;border-left:4px solid #0B7A75"><div style="margin-bottom:10px">${sw}</div>
  <div class="rpai-opts"><label class="f"><span>Send activity codes</span><select id="rpai-anon"><option value="1" ${st.anon ? 'selected' : ''}>No – replace with A1, A2… (recommended)</option><option value="0" ${st.anon ? '' : 'selected'}>Yes – send the real codes</option></select></label>
  <label class="f"><span>Write the actions for</span><select id="rpai-tone"><option value="contractor" ${st.tone === 'contractor' ? 'selected' : ''}>the contractor (to check with the contractor)</option><option value="employer" ${st.tone === 'employer' ? 'selected' : ''}>the employer (formal, short)</option></select></label></div>
  <p class="hint" style="margin:6px 0">Sent: activity names, day counts and lever shapes only (no cost, resources, file or project name). About ${Math.round(chars / 1000)} k characters; estimate ${'$' + c1.toFixed(3)} for the review and ${'$' + c2.toFixed(3)} for the wording.</p>
  <div class="actions" style="gap:8px;flex-wrap:wrap">${btn('review', busy === 'review' ? 'Reviewing…' : 'Run AI review (causes · levers · ideas)', 'primary')}${btn('words', busy === 'words' ? 'Writing…' : 'Write actions and questions')}</div>${st.err ? `<p class="hint" style="color:#C0392B">${esc(st.err)}</p>` : ''}`;
  if (rv) {
    h += `<h3 class="rp-h3" style="margin-top:14px">Delay cause by car ${tag}</h3><div class="rpai-list">${rv.causes.map(x => { const c = T.cars[(+x.car || 1) - 1]; if (!c) return ''; return `<div class="rpai-row"><b>Car ${x.car} · ${esc(rpShort(c.title, 46))}</b><span class="chip">${esc(RPAI_CAUSES[x.cause] || x.cause || '?')}${x.confidence != null ? ' · ' + Math.round(+x.confidence * 100) + '%' : ''}</span><small>${rpAiBack(x.reason, rv.rev)}</small>${dec('c:' + x.car)}</div>`; }).join('') || '<p class="hint">No cause suggested.</p>'}</div>
    <h3 class="rp-h3" style="margin-top:14px">Logic check of the levers ${tag}</h3><div class="rpai-list">${rv.levers.map(x => { const l = D.lev.levers[+x.lever]; if (!l) return ''; return `<div class="rpai-row v-${esc(x.verdict)}"><b>${esc(l.label)} · ${esc(rpWhere(T, l))}</b><span class="chip rpai-v">${esc(x.verdict === 'sound' ? 'Looks sound' : x.verdict === 'illogical' ? 'Illogical' : 'Check')}</span><small>${rpAiBack(x.reason, rv.rev)}</small>${dec('l:' + x.lever)}</div>`; }).join('')}</div>
    ${rv.extra.length ? `<h3 class="rp-h3" style="margin-top:14px">Extra ideas ${tag} <small>not recalculated by the engine</small></h3><div class="rpai-list">${rv.extra.map((x, i) => `<div class="rpai-row"><b>Car ${esc(x.car || '')}</b><small>${rpAiBack(x.idea, rv.rev)}</small>${dec('x:' + i)}</div>`).join('')}</div>` : ''}`; }
  if (w) {
    const fx = rpActions(D), fixed = new Map(fx.con.concat(fx.auth).filter(a => a[2]).map(a => [D.lev.levers.indexOf(a[2]), a[0]]));
    h += `<h3 class="rp-h3" style="margin-top:14px">Action wording ${tag} <small>accepted wording goes into the Word report and Excel</small></h3><div class="rpai-list">${w.actions.map(a => `<div class="rpai-row"><b>${a.lever === 'origin' ? 'Where the delay starts' : esc((D.lev.levers[+a.lever] || {}).label || 'Lever ' + a.lever)}</b><small>${rpAiBack(a.text, w.rev)}</small>${fixed.has(+a.lever) ? `<small class="rpai-fx">Fixed wording: ${esc(fixed.get(+a.lever))}</small>` : ''}${dec('w:' + a.lever)}</div>`).join('')}</div>
    <h3 class="rp-h3" style="margin-top:14px">Questions to check with the contractor ${tag}</h3><div class="rpai-list">${w.questions.map((q, i) => `<div class="rpai-row"><b>${q.car ? 'Car ' + esc(q.car) : 'General'}</b><small>${rpAiBack(q.text, w.rev)}</small>${dec('q:' + i)}</div>`).join('')}</div>`; }
  const cmp = rpAiCompareRows(D, R);
  h += `<h3 class="rp-h3" style="margin-top:16px">With AI against without AI</h3><div style="overflow-x:auto"><table class="tbl compact"><thead><tr><th></th><th>Without AI (engine only)</th><th>With AI (second opinion)</th></tr></thead><tbody>${cmp.rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">“With AI” days come from the same engine recalculation, with the levers Claude called illogical taken out. Claude never supplies a number.</p>
  <div class="actions" style="gap:8px;flex-wrap:wrap">${cmp.v && cmp.v.dropped.length ? `<button class="btn" data-rpai-apply="1">Switch off the ${cmp.v.dropped.length} lever(s) the AI called illogical</button>` : ''}<button class="btn" data-rpai-xlsx="1" ${rv ? '' : 'disabled'}>Download the comparison (.xlsx)</button></div></section>`;
  return h;
}
/* AI marks on the lever cards and delay-train cars (added after the page is drawn) */
function rpAiDecorate() {
  if (!rpAiOn()) return; const D = trSt('rp'), R = S.rp, rv = D && D.train ? rpAiRev(D, R) : null; if (!rv) return;
  document.querySelectorAll('.rp-lc [data-trlev]').forEach(cb => { const i = +String(cb.dataset.trlev).split(':')[1], x = rv.levers.find(q => +q.lever === i); if (!x || x.verdict === 'sound') return; const b = cb.parentElement.querySelector('b'); if (!b) return; const s = document.createElement('span'); s.className = 'rpai-tag ' + (x.verdict === 'illogical' ? 'bad' : 'warn'); s.textContent = 'AI: ' + (x.verdict === 'illogical' ? 'illogical?' : 'check'); s.title = String(x.reason || ''); b.appendChild(s); });
  document.querySelectorAll('.tr-car[data-rpcar]').forEach(el => { const x = rv.causes.find(q => +q.car - 1 === +el.dataset.rpcar); if (!x || !RPAI_CAUSES[x.cause] || x.cause === 'unknown') return; const s = document.createElement('i'); s.className = 'rpai-tag'; s.textContent = 'AI: ' + RPAI_CAUSES[x.cause]; s.title = String(x.reason || ''); el.appendChild(s); });
}
async function rpAiXlsx() {
  const D = trSt('rp'), R = S.rp, T = D.train, rv = rpAiRev(D, R), w = rpAiWords(D, R), st = rpAiSt(), X = await lib('exceljs'), wb = new X.Workbook(), c = rpAiCompareRows(D, R); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool';
  const sheet = (name, cols, rows) => { const ws = wb.addWorksheet(name); ws.columns = cols.map(([h, wd]) => ({ header: h, width: wd })); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A41' } }; rows.forEach(r => ws.addRow(r)); ws.eachRow(r => r.alignment = { wrapText: true, vertical: 'top' }); };
  const dd = k => ({ acc: 'Accepted', rej: 'Rejected' }[st.dec[k]] || 'Open');
  sheet('Summary', [['Measure', 40], ['Without AI (engine only)', 36], ['With AI (second opinion)', 48]], c.rows);
  if (rv) { sheet('Causes', [['Car', 6], ['Stage', 50], ['Cause (AI)', 26], ['Confidence', 11], ['Reason', 70], ['Decision', 11]], rv.causes.map(x => { const k = T.cars[(+x.car || 1) - 1]; return [x.car, k ? k.title : '', RPAI_CAUSES[x.cause] || x.cause, x.confidence, String(x.reason || '').replace(/\bA(\d{1,4})\b/g, m => rv.rev.has(m) ? rv.rev.get(m) : m), dd('c:' + x.car)]; }));
    sheet('Lever review', [['Lever', 34], ['Where', 30], ['Engine days alone', 16], ['AI verdict', 12], ['AI reason', 70], ['Decision', 11]], rv.levers.map(x => { const l = D.lev.levers[+x.lever]; return l ? [l.label, rpWhere(T, l), l.gain, x.verdict, String(x.reason || '').replace(/\bA(\d{1,4})\b/g, m => rv.rev.has(m) ? rv.rev.get(m) : m), dd('l:' + x.lever)] : null; }).filter(Boolean)); }
  if (w) { const fx = rpActions(D), fixed = new Map(fx.con.concat(fx.auth).filter(a => a[2]).map(a => [D.lev.levers.indexOf(a[2]), a[0]]));
    sheet('Wording', [['Lever', 34], ['Fixed wording (no AI)', 70], ['AI wording', 70], ['Decision', 11]], w.actions.map(a => [a.lever === 'origin' ? 'Where the delay starts' : (D.lev.levers[+a.lever] || {}).label, fixed.get(+a.lever) || '', String(a.text).replace(/\bA(\d{1,4})\b/g, m => w.rev.has(m) ? w.rev.get(m) : m), dd('w:' + a.lever)]));
    sheet('Questions', [['Car', 8], ['Question (AI)', 100], ['Decision', 11]], w.questions.map((q, i) => [q.car || '', q.text, dd('q:' + i)])); }
  download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Recovery_AI_vs_no_AI_v' + E.VERSION + '.xlsx'); toast('Comparison created', 'ok');
}
document.addEventListener('change', e => { const t = e.target; if (!t || !t.matches) return;
  if (t.id === 'rpai-anon') { const st = rpAiSt(); st.anon = t.value === '1'; LS.set('brt.rpAnon', st.anon); viewRecovery(); }
  if (t.id === 'rpai-tone') { rpAiSt().tone = t.value; viewRecovery(); } });
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-rpai-run],[data-rpai-dec],[data-rpai-apply],[data-rpai-xlsx]'); if (!t) return;
  if (t.dataset.rpaiRun) { t.dataset.rpaiRun === 'review' ? rpAiRunReview() : rpAiRunWords(); return; }
  if (t.dataset.rpaiDec) { const [k, v] = t.dataset.rpaiDec.split(/:(?=acc$|rej$)/), st = rpAiSt(); st.dec[k] = st.dec[k] === v ? undefined : v; viewRecovery(); return; }
  if (t.dataset.rpaiApply) { const D = trSt('rp'), v = rpAiVetted(D, S.rp); if (v) { v.dropped.forEach(i => D.levOn.delete(i)); trainComb('rp'); viewRecovery(); } return; }
  if (t.dataset.rpaiXlsx) rpAiXlsx().catch(err => { console.error(err); toast('Could not create the file: ' + err.message, 'bad'); }); });

document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('#tb-ai'); if (!t) return;
  if (S.step === 'recovery') { S.cfg.ai.rp = !(S.cfg.ai.rp === true); saveAiSettings(); renderNav(); viewRecovery(); }
  else if (S.step === 'compare') { S.cfg.ai.cmp = !(S.cfg.ai.cmp === true); saveAiSettings(); renderNav(); viewCompare(); } });
