/* ===== APP PART 24 (v8.0): Delay train (where the delay entered the chain) + origin and recovery plan (levers tested with the what-if) ===== */
const trCfg = () => Object.assign({}, E.TRAIN_DEFAULTS, S.cfg.train || {});
function runTrain() {
  const D = S.dl; D.train = null; D.lev = null; D.comb = null;
  const all = dlModels(); if (!D.base || !D.ups.length) return;
  const Bm = D.mode === 'A' ? (D.upUsed || D.ups[D.ups.length - 1]).M : all[all.length - 1].M;
  try { D.train = E.delayTrain(D.base.M, Bm, { targetCode: D.target, cfg: trCfg() }); } catch (e) { console.error(e); D.trainErr = e.message; return; }
  D.trainSel = D.train && D.train.origin ? D.train.cars.findIndex(c => c.isOrigin) : 0; D.levBusy = true;
  setTimeout(() => {
    try { const hw = Object.assign({}, E.DELAY_DEFAULTS, S.cfg.delay || {}).holdWords; D.lev = E.trainLevers(Bm, D.train, { holdWords: hw });
      /* start with the best lever of each car ticked */
      const best = new Map(); D.lev.levers.forEach((l, i) => { if (l.gain > 0 && (!best.has(l.car) || l.gain > D.lev.levers[best.get(l.car)].gain)) best.set(l.car, i); });
      D.levOn = new Set(best.values()); trainComb(Bm);
      D.levAll = D.lev.levers.length ? E.trainCombine(Bm, D.lev.levers.filter(l => l.gain > 0)).gain : 0;
    } catch (e) { console.error(e); D.trainErr = 'Levers could not be tested: ' + e.message; }
    D.levBusy = false; if (S.step === 'delay') viewDelay();
  }, 30);
}
function trainComb(Bm) { const D = S.dl; if (!D.lev) return; Bm = Bm || (D.mode === 'A' ? (D.upUsed || D.ups[D.ups.length - 1]).M : dlModels().slice(-1)[0].M); const on = [...D.levOn].map(i => D.lev.levers[i]); D.comb = on.length ? E.trainCombine(Bm, on) : { gain: 0 }; }
const trD = (v, unit) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + (unit === false ? '' : ' d');
function trainHtml() {
  const D = S.dl, T = D.train; if (!T) return D.trainErr ? `<div class="warnbox">${esc(D.trainErr)}</div>` : '';
  const c0 = trCfg(), o = T.origin, oc = T.cars.find(c => c.isOrigin), lev = D.lev ? D.lev.levers : [], tg = T.target;
  const levOf = c => lev.map((l, i) => [l, i]).filter(([l]) => l.car === c.idx && l.gain > 0).sort((a, b) => b[0].gain - a[0].gain);
  const bestAll = lev.slice().sort((a, b) => b.gain - a.gain)[0];
  const ddIdx = T.cars.findIndex(c => c.phase === 'next' || c.phase === 'end');
  const car = c => { const ph = { done: 'DONE', now: 'IN PROGRESS', next: 'NEXT', end: 'FINISH' }[c.phase], cl = c.delta >= 1 ? 'add' : c.delta <= -1 ? 'rec' : 'z', ls = levOf(c).slice(0, 2);
    return `${c.idx === ddIdx && ddIdx > 0 ? '<div class="tr-dd" title="Data date"></div>' : ''}<button class="tr-car ${c.phase} ${c.isOrigin ? 'org' : ''} ${D.trainSel === c.idx ? 'sel' : ''}" data-trcar="${c.idx}" title="${esc(c.title)}">${c.isOrigin ? '<span class="tr-flag">DELAY STARTS HERE</span>' : ''}
      <span class="tr-ph">${ph}</span><b class="tr-t">${esc(c.phase === 'end' ? tg.name : c.title)}</b>${c.phase === 'end' ? `<span class="tr-d ${tg.slip > 0 ? 'add' : 'z'}">${trD(tg.slip || 0)}</span><small>${esc(E.fmtDate(tg.fB))}</small>` : `<span class="tr-d ${cl}">${trD(c.delta)}</span><small>${c.n} activit${c.n === 1 ? 'y' : 'ies'} · slip ${trD(c.slip)}</small>`}
      <span class="tr-chips">${D.levBusy && (c.phase === 'next' || c.phase === 'now') ? '<i class="chip">testing…</i>' : ls.map(([l]) => `<i class="chip ok">${esc(l.label.split(' ')[0])} −${l.gain} d</i>`).join('')}</span><span class="tr-wh"><i></i><i></i></span></button>`; };
  const read = (() => { if (!o) return 'No activity on the chain added ' + c0.originMin + ' days or more; the finish moved ' + trD(tg.slip || 0) + '.';
    const big = T.rows.slice().sort((a, b) => b.own - a.own)[0];
    let s = `The delay starts at <b>${esc(o.name)}</b> (${esc(o.code)}${o.pDur != null ? `: planned ${o.pDur} d, took ${o.cDur} d` : ''}, ${trD(o.own)}).`;
    if (big && big !== o) s += ` The largest single addition is <b>${esc(big.name)}</b> (${trD(big.own)}${big.pDur != null ? `, planned ${big.pDur} d, took ${big.cDur} d` : ''}).`;
    s += ` Work already done added ${trD(T.added)}${T.recovered ? ' and recovered ' + Math.abs(T.recovered) + ' d' : ''}; the finish is now ${trD(tg.slip || 0)}.`;
    if (bestAll && bestAll.gain > 0) { const bc = T.cars[bestAll.car]; s += ` Best single lever ahead: <b>${esc(bestAll.label.toLowerCase())}</b> in “${esc(dtr(bc.title, 60))}” (−${bestAll.gain} d${bestAll.copies > 1 ? ', applied to all ' + bestAll.copies + ' identical copies; this car alone saves ' + (bestAll.gainCarOnly || 0) + ' d' : ''}).`; }
    return s; })();
  /* F: left = selected car, right = levers */
  const sc = T.cars[D.trainSel] || oc || T.cars[0];
  const left = (() => { if (!sc) return ''; const rows = sc.rows;
    const head = sc.isOrigin && o ? `<div class="tr-orig"><span class="tr-ot">DELAY STARTS HERE</span><h3>${esc(o.name)}</h3><small>${esc(o.code)} · ${esc(o.status === 'TK_Complete' ? 'completed ' + E.fmtDate(o.t.ef) : o.status === 'TK_Active' ? 'in progress' : 'not started')}</small><div class="tr-big">${trD(o.own)}</div>${o.pDur != null ? `<div class="tr-du"><span>Planned</span><i style="width:${Math.max(4, Math.min(100, o.pDur * 100 / Math.max(o.pDur, o.cDur, 1)))}%"></i><em>${o.pDur} d</em></div><div class="tr-du a"><span>${o.status === 'TK_Complete' ? 'Actual' : 'Current'}</span><i style="width:${Math.max(4, Math.min(100, o.cDur * 100 / Math.max(o.pDur, o.cDur, 1)))}%"></i><em>${o.cDur} d</em></div>` : ''}<p>Ask the contractor what held this activity: resources on site, materials, approvals or access.</p></div>`
      : `<h3 class="bt" style="margin-top:0">${esc(sc.title)}</h3>`;
    const tb = `<div class="scroll" style="max-height:360px"><table class="tbl"><thead><tr><th>Activity</th><th>Planned</th><th>${sc.phase === 'done' ? 'Actual' : 'Current'}</th><th style="text-align:right">Effect</th></tr></thead><tbody>${rows.map(r => `<tr class="${r === o ? 'tr-or' : ''}"><td>${esc(r.name)}<br><small class="hint">${esc(r.code)}${r.isNew ? ' · not in the baseline' : ''}</small></td><td>${r.pDur == null ? '–' : r.pDur + ' d'}</td><td>${r.cDur == null ? '–' : r.cDur + ' d'}</td><td style="text-align:right;font-weight:700" class="${r.own >= 1 ? 'tr-add' : r.own <= -1 ? 'tr-rec' : ''}">${r.own ? trD(r.own) : '0'}</td></tr>`).join('')}</tbody></table></div>`;
    return head + `<h4 class="tr-h4">${sc.isOrigin ? 'Activities in this car' : 'Activities'} · ${sc.n} · ${trD(sc.delta)} overall</h4>` + tb; })();
  const right = (() => { if (D.levBusy) return '<p class="hint">Testing the levers with the what-if recalculation…</p>'; if (!lev.length) return '<p class="hint">No lever found on the work still to come (nothing to overlap, no long lags, nothing long enough to speed up).</p>';
    const byCar = new Map(); lev.forEach((l, i) => { if (!byCar.has(l.car)) byCar.set(l.car, []); byCar.get(l.car).push([l, i]); });
    let h = ''; for (const [ci, ls] of byCar) { const c = T.cars[ci]; h += `<div class="tr-lc ${D.trainSel === ci ? 'sel' : ''}">${esc(dtr(c.title, 70))}</div>`;
      for (const [l, i] of ls.sort((a, b) => b[0].gain - a[0].gain)) h += `<label class="tr-lev"><input type="checkbox" data-trlev="${i}" ${D.levOn.has(i) ? 'checked' : ''}><span><b>${esc(l.label)}</b><small>${esc(l.how)} · ${l.n} change${l.n === 1 ? '' : 's'}${l.copies > 1 ? ` · all ${l.copies} identical copies (this car alone: ${l.gainCarOnly > 0 ? '−' + l.gainCarOnly : '0'} d)` : ''} · ${esc(l.who)}</small></span><em class="${l.gain > 0 ? '' : 'z'}">${l.gain > 0 ? '−' + l.gain : '0'} d</em></label>`; }
    const g = D.comb ? D.comb.gain : 0, tot = Math.max(1, tg.slip || 0), pct = Math.max(0, Math.min(100, g * 100 / tot));
    h += `<div class="tr-meter"><b>Ticked levers together: ${g > 0 ? '−' + g : '0'} d</b><div class="tr-bar"><i style="width:${pct}%"></i></div><div class="tr-lab"><span>Recovered ${g} d</span><span>Remaining ${Math.max(0, (tg.slip || 0) - g)} d of ${trD(tg.slip || 0)}</span></div></div>
      <p class="hint" style="margin-top:6px">Levers do not simply add up: once one path is shortened, another path drives the finish. Every lever ticked: −${D.levAll || 0} d. Numbers come from the tool's simplified recalculation (no resource levelling); whether a lever is possible on site is for the reviewer to judge.</p>`;
    return h; })();
  const set = (k, lab, step) => `<label class="f"><span>${lab}</span><input type="number" min="0" step="${step || 1}" data-trset="${k}" value="${esc(c0[k])}"></label>`;
  return `<section class="card tr-card"><h2>Delay train <small>where the delay entered the driving chain, and where it can be won back</small></h2>
  <div class="tr-kpi"><div class="vt ${tg.slip > 0 ? 'bad' : 'info'}"><span>Finish moved</span><b>${trD(tg.slip || 0)}</b><small>${esc(E.fmtDate(tg.fA))} → ${esc(E.fmtDate(tg.fB))}</small></div><div class="vt bad"><span>Delay starts at</span><b style="font-size:15px">${o ? esc(dtr(o.name, 46)) : '–'}</b><small>${o ? trD(o.own) + ' · ' + esc(o.code) : ''}</small></div><div class="vt info"><span>Done work added / recovered</span><b>${trD(T.added)} / ${T.recovered ? '−' + Math.abs(T.recovered) + ' d' : '0'}</b><small>${T.rows.length} activities on the chain</small></div><div class="vt ${D.levAll > 0 ? 'ok' : 'info'}"><span>Levers ahead (tested)</span><b>${D.levBusy ? '…' : (D.levAll > 0 ? '−' + D.levAll : '0') + ' d'}</b><small>all levers together</small></div></div>
  <div class="tr-train">${T.cars.map(car).join('')}</div>
  <p class="hint" style="margin:4px 0 10px">Grey = done, amber = in progress, white = still to come. Click a car to see its activities; the levers are on the right.</p>
  <div class="cause tr-read"><b>Reading:</b> ${read}</div>
  <div class="tr-f"><div class="tr-fl">${left}</div><div class="tr-fr"><h3 class="bt" style="margin-top:0">Mitigation levers (tested)</h3>${right}</div></div>
  <details class="tr-set"><summary>Delay train settings</summary><div class="actions" style="flex-wrap:wrap;gap:12px;align-items:flex-end;margin-top:8px">${set('originMin', 'Delay starts at the first activity adding at least (days)')}${set('maxCars', 'Number of cars (about)')}${set('startAtPct', 'Overlap: start when the predecessor is (% done)')}${set('lagMin', 'Long lag: from (working days)')}${set('lagTo', 'Shorten long lags to (working days)')}${set('crewPct', 'Extra crew / second shift: duration −(%)')}${set('minRemWd', 'Skip activities with less remaining than (working days)')}
  <label class="f"><span>Apply levers to identical copies (same activity in other plots or blocks)</span><select data-trset="twins"><option value="1" ${c0.twins ? 'selected' : ''}>Yes</option><option value="0" ${c0.twins ? '' : 'selected'}>No, this car only</option></select></label>
  <label class="f" style="min-width:min(100%,420px)"><span>Authority and approval words (never sped up by crews; may run in parallel)</span><input type="text" data-trset="authWords" value="${esc(c0.authWords)}"></label></div></details></section>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-trcar]'); if (!b) return; S.dl.trainSel = +b.dataset.trcar; const y = window.scrollY; viewDelay(); window.scrollTo(0, y); });
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset) return;
  if (el.dataset.trlev !== undefined) { const i = +el.dataset.trlev; if (el.checked) S.dl.levOn.add(i); else S.dl.levOn.delete(i); trainComb(); const y = window.scrollY; viewDelay(); window.scrollTo(0, y); return; }
  if (el.dataset.trset !== undefined) { const k = el.dataset.trset; S.cfg.train = S.cfg.train || {};
    if (k === 'twins') S.cfg.train.twins = el.value === '1';
    else if (k === 'authWords') { try { new RegExp(el.value, 'i'); S.cfg.train.authWords = el.value; } catch (err) { toast('Not a valid word list', 'bad'); return; } }
    else { const v = parseFloat(el.value); if (isNaN(v) || v < 0) { toast('Enter a number of 0 or more', 'bad'); return; } S.cfg.train[k] = v; }
    if (typeof saveCfg === 'function') saveCfg(); runTrain(); viewDelay(); }
});
