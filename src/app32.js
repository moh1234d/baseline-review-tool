/* v9.41: what a manager needs first — how wide the driving front is, whether the update recorded progress, and one plain summary. */
const rpOpenT = t => t && t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS';
/* every unfinished activity that drives the finish with no gap (stored dates), and its work fronts:
   a front = in progress, or not started with nothing unfinished before it */
function rpDriveNet(R) {
  const M = R && R.B && R.B.M; if (!M) return null; const pk = (R.paths || []).map(p => p.code).join('|');
  if (R.dnet && R.dnetFor === M && R.dnetK === pk) return R.dnet; let tg = null;
  try { const c = R.tr && R.tr.train && R.tr.train.target && R.tr.train.target.code; tg = (c && (M.byCode[c] || [])[0]) || E.dlTargets(M)[0]; } catch (e) { tg = null; }
  if (!tg) return (R.dnet = null);
  const seen = new Set([tg.id]), st = [tg], net = [];
  while (st.length && net.length < 20000) { const t = st.pop(); if (!rpOpenT(t)) continue; net.push(t); let d = []; try { d = E.dlDrivers(M, t) || []; } catch (e) { d = []; }
    for (const x of d) if (x.gap != null && x.gap <= 0.01 && !seen.has(x.from.id) && x.from.type !== 'TT_LOE' && x.from.type !== 'TT_WBS') { seen.add(x.from.id); st.push(x.from); } }
  const shown = new Set(); (R.paths || []).forEach(p => (p.chain || []).forEach(t => shown.add(t.id)));
  const fronts = net.filter(t => t.status === 'TK_Active' || (t.status === 'TK_NotStart' && !t.pre.some(l => rpOpenT(l.from))));
  R.dnetFor = M; R.dnetK = pk;
  return (R.dnet = { n: net.length, fronts, shown: fronts.filter(t => shown.has(t.id)), missing: fronts.filter(t => !shown.has(t.id)) }); }
/* did the update record progress since the baseline / previous file? */
const rpStallWarn = () => Math.max(0, Math.min(100, +S.cfg.rpStallWarn || 60));
function rpStall(R) {
  const A = R && R.A && R.A.M, B = R && R.B && R.B.M; if (!A || !B) return null; if (R.stall && R.stallA === A && R.stallB === B) return R.stall;
  const bBy = new Map(); B.tasks.forEach(t => { if (!bBy.has(t.code)) bBy.set(t.code, t); });
  let act = 0, same = 0, due = 0, notSt = 0; const dd = B.dataDate;
  for (const a of A.tasks) { if (a.type === 'TT_LOE' || a.type === 'TT_WBS' || a.isMile) continue; const t = bBy.get(a.code); if (!t) continue;
    if (a.status === 'TK_Active' && t.status === 'TK_Active') { act++; if ((t.remWd || 0) >= (a.remWd || 0) - 0.5) same++; }
    if (a.status === 'TK_NotStart' && a.es != null && dd != null && a.es <= dd) { due++; if (t.status === 'TK_NotStart') notSt++; } }
  const pc = (x, n) => n ? Math.round(x / n * 100) : null, days = A.dataDate != null && dd != null ? Math.round(dd - A.dataDate) : null;
  const s = { act, same, pSame: pc(same, act), due, notSt, pNot: pc(notSt, due), days };
  s.warn = days > 0 && ((act >= 20 && s.pSame >= rpStallWarn()) || (due >= 20 && s.pNot >= rpStallWarn()));
  R.stallA = A; R.stallB = B; return (R.stall = s); }
const rpNum = v => Number(v).toLocaleString('en-US');
/* the summary strip at the top of the page */
function rpSummary(R, D) {
  const T = D && D.train; if (!T) return ''; const N = rpNums(D), net = rpDriveNet(R), st = rpStall(R), m = rpMatch(), p6 = (() => { try { return rpP6(); } catch (e) { return null; } })();
  const late = Math.round(N.slip || 0), nf = net ? net.fronts.length : 0;
  let head = late > 0 ? `Forecast finish <b>${esc(RPD(N.tg.fB))}</b> — <b class="r">${late} day${late === 1 ? '' : 's'} later</b> than ${esc(RPD(N.tg.fA))}.` : late < 0 ? `Forecast finish <b>${esc(RPD(N.tg.fB))}</b> — ${-late} day${late === -1 ? '' : 's'} earlier than ${esc(RPD(N.tg.fA))}.` : `Forecast finish <b>${esc(RPD(N.tg.fB))}</b> — as the baseline.`;
  if (net && nf) head += nf === 1 ? ` One work front holds this date (${rpNum(net.n)} activities drive it).` : ` <b>${nf} work fronts hold this date together</b> (${rpNum(net.n)} activities drive it): recovering one front alone does not bring the finish forward.`;
  const chip = (cl, t, tip) => `<span class="rps-c ${cl}" title="${esc(tip || '')}">${cl === 'ok' ? '✓' : cl === 'bad' ? '✕' : '!'} ${t}</span>`, chips = [];
  if (m) chips.push(chip(m.verdict === 'ok' ? 'ok' : m.verdict === 'warn' ? 'warn' : 'bad', m.verdict === 'ok' ? 'Same project in both files' : m.verdict === 'warn' ? 'Files only partly match' : 'Files look like different projects', `Activity IDs ${m.ids}% · WBS ${m.wbs}% · same ID in same WBS ${m.same}%`));
  if (p6 && p6.st && p6.st.n) chips.push(chip(p6.verdict === 'match' ? 'ok' : p6.verdict === 'no' ? 'bad' : 'warn', p6.verdict === 'match' ? 'Dates match P6' : p6.verdict === 'minor' ? 'Dates match P6 with minor differences' : p6.verdict === 'unsched' ? 'File not scheduled (F9) after progress' : 'Dates do not match P6', 'The tool recalculates the update and compares with the dates P6 stored. Details under “Data checks” at the bottom.'));
  if (st && st.days > 0) chips.push(st.warn ? chip('warn', `Little progress recorded in ${st.days} days`, `${st.same} of ${st.act} activities in progress have the same remaining duration as before (${st.pSame}%); ${st.notSt} of ${st.due} due to start have not started (${st.pNot}%).`) : chip('ok', 'Progress recorded since the previous file', `${st.act - st.same} of ${st.act} activities in progress moved on; ${st.due - st.notSt} of ${st.due} due to start have started.`));
  let warn = '';
  if (st && st.warn) warn = `<p class="rps-w"><b>Check the update before relying on the forecast.</b> In the ${st.days} days between the two files, ${st.pSame != null ? `<b>${st.pSame}%</b> of the activities in progress (${rpNum(st.same)} of ${rpNum(st.act)}) kept the same remaining duration` : ''}${st.pSame != null && st.pNot != null ? ' and ' : ''}${st.pNot != null ? `<b>${st.pNot}%</b> of the activities due to start (${rpNum(st.notSt)} of ${rpNum(st.due)}) did not start` : ''}. Either the site stood still, or the data date was moved without entering progress.</p>`;
  let miss = '';
  if (net && net.missing.length) miss = `<details class="rps-m"><summary>${net.shown.length} of ${nf} driving work fronts are on the paths shown · ${net.missing.length} more</summary><ul>${net.missing.slice(0, 40).map(t => `<li><i>${esc(t.code)}</i> ${esc(t.name)}${rpLocOn() && rpLocFullTxt(t) ? ' · 📍 ' + esc(rpLocFullTxt(t)) : ''} <small>${t.status === 'TK_Active' ? 'in progress' : 'ready to start'}</small></li>`).join('')}</ul><p class="hint" style="margin:4px 0 0">These branch off inside a listed path or repeat it in another area. They hold the finish in the same way.</p></details>`;
  return `<section class="rps"><p class="rps-h">${head}</p><div class="rps-cs">${chips.join('')}</div>${warn}${miss}<p class="rps-l">Total float is against the contract finish: a negative figure is the number of days late.</p></section>`; }
/* v9.41: wording by phase — work still to come is "later / earlier than baseline"; only work done or under way has added or recovered delay */
const rpCapC = (d, c) => { const fut = c && (c.phase === 'next' || c.phase === 'end'); return fut ? (d >= 1 ? 'later than baseline' : d <= -1 ? 'earlier than baseline' : 'as baseline') : (d >= 1 ? 'added here' : d <= -1 ? 'recovered here' : 'no change here'); };
const rpCapRow = (d, c) => { const fut = c && (c.phase === 'next' || c.phase === 'end'); return fut ? (d <= -1 ? 'Earlier than baseline' : 'Later than baseline') : (d <= -1 ? 'Recovered here' : 'Delay added here'); };
