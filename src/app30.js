/* ===== APP PART 30 (v9.19): comments on any object in the Recovery planner — stage boxes, activities, WBS rows, lever cards ===== */
/* Keys are stable across reloads: a stage = its first and last activity codes; an activity = its code; a WBS row = its name path; a lever = label + stage.
   Stored in the project settings (S.cfg.rpNotes), so they travel with the saved project and the Drive session. */
const RPN = () => (S.cfg.rpNotes = S.cfg.rpNotes && typeof S.cfg.rpNotes === 'object' ? S.cfg.rpNotes : {});
const rpnKeyCar = c => c && c.rows && c.rows.length ? 'car:' + c.rows[0].t.code + '>' + c.rows[c.rows.length - 1].t.code : '';
const rpnKeyAct = t => t ? 'act:' + t.code : '';
const rpnKeyWbs = (W, id) => { const p = []; let w = W[id]; while (w) { p.unshift(w.name); w = W[w.parent]; } return 'wbs:' + p.join(' / '); };
const rpnCount = k => (RPN()[k] || []).length;
const rpnLabel = {};
/* small speech-bubble chip; filled amber with a count when the object has comments */
/* the object itself carries its key; right-click (or long-press on a phone) opens the menu */
const rpnA = (k, label) => { if (!k) return ''; rpnLabel[k] = label || rpnLabel[k] || k; return ` data-rpnk="${esc(k)}"`; };
const rpnSvg = (k, x, y, label) => { if (!k) return ''; rpnLabel[k] = label || rpnLabel[k] || k; const n = rpnCount(k); if (!n) return '';
  return `<g data-rpnote="${esc(k)}" style="cursor:pointer"><title>${n ? n + ' comment' + (n === 1 ? '' : 's') + ' — click to read or add' : 'Add a comment'}</title><rect x="${x}" y="${y}" width="${n ? 30 : 20}" height="16" rx="8" fill="${n ? '#f2b705' : '#fff'}" stroke="${n ? '#b8860b' : '#b9c2d0'}"/><path d="M${x + 5} ${y + 4.5}h10a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-5l-3 2.2v-2.2h-2a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z" fill="${n ? '#fff' : 'none'}" stroke="${n ? '#fff' : '#5e6a7d'}" stroke-width="1.1"/>${n ? `<text x="${x + 23}" y="${y + 11.5}" font-size="9" font-weight="800" fill="#3b2a00" text-anchor="middle">${n}</text>` : ''}</g>`; };
const rpnHtml = (k, label) => { if (!k) return ''; rpnLabel[k] = label || rpnLabel[k] || k; const n = rpnCount(k); if (!n) return ''; return `<span class="rpn-b ${n ? 'has' : ''}" data-rpnote="${esc(k)}" role="button" tabindex="0" title="${n ? n + ' comment' + (n === 1 ? '' : 's') : 'Add a comment'}">💬${n ? '<b>' + n + '</b>' : ''}</span>`; };
const rpnAll = () => Object.entries(RPN()).filter(([k, v]) => v && v.length);
function rpnOpen(k) { let el = document.getElementById('rpn-panel'); if (!el) { el = document.createElement('div'); el.id = 'rpn-panel'; document.body.appendChild(el); }
  const all = k === '*', N = RPN(), list = all ? rpnAll() : [[k, N[k] || []]], fmt = s => { try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (x) { return s; } };
  const kindOf = q => ({ car: 'Stage', act: 'Activity', wbs: 'WBS', lev: 'Lever' })[q.split(':')[0]] || 'Item';
  el.innerHTML = `<div class="rpn-in" role="dialog" aria-label="Comments"><div class="rpn-hd"><b>${all ? 'All comments (' + list.reduce((s, x) => s + x[1].length, 0) + ')' : 'Comments'}</b><button type="button" class="btn sm" data-rpnx="close">✕</button></div>
  ${list.map(([q, arr]) => `<div class="rpn-obj"><div class="rpn-k"><span class="rpn-kind">${kindOf(q)}</span> ${esc(rpnLbl(q))}</div>${all ? '' : ''}${arr.map((c, i) => `<div class="rpn-c"><p>${esc(c.t).replace(/\n/g, '<br>')}</p><small>${esc(fmt(c.at))}${c.by ? ' · ' + esc(c.by) : ''} <button type="button" class="rpn-del" data-rpnx="del" data-k="${esc(q)}" data-i="${i}" title="Delete this comment">Delete</button></small></div>`).join('')}${all ? `<button type="button" class="btn sm" data-rpnx="go" data-k="${esc(q)}">Add to this</button>` : ''}</div>`).join('') || '<p class="hint">No comments yet. Right-click any box, activity, WBS row or lever card and choose “Add comment” (on a phone: press and hold).</p>'}
  ${all ? '' : `<textarea id="rpn-txt" rows="4" placeholder="Write a comment…"></textarea><div class="rpn-ft"><input id="rpn-by" placeholder="Your name (optional)" value="${esc(LS.get('brt.rpnBy', ''))}"><button type="button" class="btn primary sm" data-rpnx="add" data-k="${esc(k)}">Add comment</button></div>`}</div>`;
  el.hidden = false; const ta = document.getElementById('rpn-txt'); if (ta) ta.focus(); }
const rpnClose = () => { const el = document.getElementById('rpn-panel'); if (el) el.hidden = true; };
const rpnRefresh = () => { if (S.step === 'recovery') { const sc = document.querySelector('.rpv-scroll'), sl = sc ? sc.scrollLeft : 0, st = sc ? sc.scrollTop : 0, y = window.scrollY; trRender('rp'); window.scrollTo(0, y); const s2 = document.querySelector('.rpv-scroll'); if (s2) { s2.scrollLeft = sl; s2.scrollTop = st; } } };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpnote]'); if (!b) return; e.stopPropagation(); e.preventDefault(); rpnOpen(b.dataset.rpnote); }, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.rpn-b')) { e.preventDefault(); rpnOpen(e.target.dataset.rpnote); } if (e.key === 'Escape') rpnClose(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpnx]'); if (!b) return; const a = b.dataset.rpnx, N = RPN();
  if (a === 'close') return rpnClose();
  if (a === 'all') return rpnOpen('*');
  if (a === 'go') return rpnOpen(b.dataset.k);
  if (a === 'add') { const t = (document.getElementById('rpn-txt').value || '').trim(); if (!t) return; const by = (document.getElementById('rpn-by').value || '').trim(); LS.set('brt.rpnBy', by);
    (N[b.dataset.k] = N[b.dataset.k] || []).push({ t, at: new Date().toISOString(), by, label: rpnLabel[b.dataset.k] || '' }); try { autosave(); } catch (x) { } rpnOpen(b.dataset.k); rpnRefresh(); return; }
  if (a === 'del') { const k = b.dataset.k, arr = N[k] || []; arr.splice(+b.dataset.i, 1); if (!arr.length) delete N[k]; try { autosave(); } catch (x) { } const el = document.getElementById('rpn-panel'); rpnOpen(el && /All comments/.test(el.textContent) ? '*' : k); rpnRefresh(); } });
/* labels saved with a comment let the "All comments" list and the report name the object even when it is not on screen */
const rpnLbl = q => rpnLabel[q] || ((RPN()[q] || []).find(c => c.label) || {}).label || q.replace(/^\w+:/, '');

/* ---------- right-click menu ---------- */
function rpnMenu(k, x, y) { let m = document.getElementById('rpn-menu'); if (!m) { m = document.createElement('div'); m.id = 'rpn-menu'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  const n = rpnCount(k), lb = rpnLbl(k);
  m.innerHTML = `<div class="rpn-mh">${esc(lb)}</div><button type="button" role="menuitem" data-rpnm="add" data-k="${esc(k)}">💬 Add comment</button>${n ? `<button type="button" role="menuitem" data-rpnm="view" data-k="${esc(k)}">View comments (${n})</button>` : ''}<button type="button" role="menuitem" data-rpnm="all">All comments in this project</button>`;
  m.hidden = false; const r = m.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight; m.style.left = Math.max(4, Math.min(x, W - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, H - r.height - 4)) + 'px'; const b = m.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
const rpnMenuClose = () => { const m = document.getElementById('rpn-menu'); if (m) m.hidden = true; };
document.addEventListener('contextmenu', e => { const o = e.target.closest && e.target.closest('[data-rpnk]'); if (!o || S.step !== 'recovery') return; e.preventDefault(); rpnMenu(o.dataset.rpnk, e.clientX, e.clientY); });
/* long-press for phones and tablets that do not send a context menu */
let rpnLp = null; document.addEventListener('touchstart', e => { const o = e.target.closest && e.target.closest('[data-rpnk]'); if (!o || e.touches.length !== 1) return; const t = e.touches[0]; rpnLp = { x: t.clientX, y: t.clientY, k: o.dataset.rpnk, tm: setTimeout(() => { rpnLp.fired = true; rpnMenu(rpnLp.k, rpnLp.x, rpnLp.y); }, 550) }; }, { passive: true });
document.addEventListener('touchmove', e => { if (!rpnLp) return; const t = e.touches[0]; if (Math.abs(t.clientX - rpnLp.x) > 10 || Math.abs(t.clientY - rpnLp.y) > 10) { clearTimeout(rpnLp.tm); rpnLp = null; } }, { passive: true });
document.addEventListener('touchend', e => { if (!rpnLp) return; clearTimeout(rpnLp.tm); if (rpnLp.fired) e.preventDefault(); rpnLp = null; });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpnm]'); const m = document.getElementById('rpn-menu'); if (!b) { if (m && !m.hidden && !(e.target.closest && e.target.closest('#rpn-menu'))) rpnMenuClose(); return; }
  e.stopPropagation(); rpnMenuClose(); const a = b.dataset.rpnm; if (a === 'all') rpnOpen('*'); else rpnOpen(b.dataset.k); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') rpnMenuClose(); });
window.addEventListener('scroll', rpnMenuClose, true); window.addEventListener('resize', rpnMenuClose);

/* ---------- "delaying now": the activity at the data date that the rest of each path waits for ----------
   In progress on the path -> the last one in the chain (it drives the next step); none in progress -> the first not started. */
const RPDN = {}; let rpDnSeq = 0;
function rpDelayNow(T) { if (!T || !T.cars) return null; if (T._dnFor === T) return T._dn; T._dnFor = T;
  T.cars.forEach(c => { c._dn = null; });
  const R = S.rp, M = R && R.B && R.B.M; if (!M) return (T._dn = null);
  /* v9.24: follow the links that drive the CURRENT dates (from the tool's recalculation of the update, same options as the file),
     backwards from the end of the path, while the predecessor is unfinished. The first activity that nothing unfinished drives
     is the one the rest of the path is waiting for. An activity in progress can be waiting too (e.g. its finish held by an FF link). */
  if (!R.B._rc || R.B._rcFor !== M) { try { R.B._rc = E.recalc(M); R.B._rcFor = M; } catch (e) { R.B._rc = null; } }
  const rc = R.B._rc, rows = T.cars.flatMap(c => c.rows.filter(r => r.t).map(r => ({ r, c }))), byId = new Map(rows.map(o => [o.r.t.id, o]));
  const open = t => t && t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS';
  const last = [...rows].reverse().find(o => open(o.r.t)); if (!last) return (T._dn = null);
  let t = last.r.t; const walk = [t], via = [], seen = new Set([t.id]);
  if (rc && rc.drv) for (let k = 0; k < 4000; k++) { const l = rc.drv.get(t.id); if (!l || !open(l.from) || seen.has(l.from.id)) break; via.unshift(l); t = l.from; walk.unshift(t); seen.add(t.id); }
  else { const act = rows.filter(o => o.r.t.status === 'TK_Active'), pk = act.length ? act[act.length - 1] : rows.find(o => o.r.t.status === 'TK_NotStart'); if (pk) { t = pk.r.t; walk.splice(0, walk.length, t); } }
  const own = byId.get(t.id), a = own ? own.r.a : (R.A && R.A.M && R.A.M.tasks.find(x => x.code === t.code)) || null;
  const car = own ? own.c : T.cars.find(c => c.phase !== 'done' && c.phase !== 'end') || T.cars[0];
  const late = a && a.ef != null && t.ef != null ? Math.round(t.ef - a.ef) : null;
  const lk = l => (({ PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF' })[l.type] || l.type) + (l.lagWd ? (l.lagWd > 0 ? '+' : '') + Math.round(l.lagWd * 10) / 10 : '');
  /* how it holds the path: the first few steps after it, and the first activity in progress that is waiting on it */
  const steps = walk.slice(0, 5).map((x, i) => (i ? ' → ' + lk(via[i - 1]) + ' → ' : '') + x.code + (x.status === 'TK_Active' && i ? ' (in progress, waiting)' : ''));
  const heldAct = walk.slice(1).filter(x => x.status === 'TK_Active');
  const info = { t, car, code: t.code, name: t.name, st: t.status === 'TK_Active' ? 'In progress' : 'Not started', ef: t.ef, bf: a ? a.ef : null, late, tf: rpTF(t), chain: steps.join('') + (walk.length > 5 ? ' → … (' + (walk.length - 5) + ' more)' : ''), held: heldAct.map(x => x.code), outside: !own, flow: walk.slice(0, 5).map((x, i) => ({ code: x.code, act: x.status === 'TK_Active', lk: i ? lk(via[i - 1]) : '' })), more: Math.max(0, walk.length - 5) };
  info.key = t.code + '#' + (++rpDnSeq); if (car) car._dn = info; RPDN[info.key] = info; return (T._dn = info); }
const rpDnTip = (info, rank) => { if (info.t) info.tf = rpTF(info.t); const tf = info.tf == null ? '–' : rpFlt(info.tf), lt = info.late == null ? 'not in baseline file' : info.late > 0 ? '+' + info.late + ' d late' : info.late < 0 ? Math.abs(info.late) + ' d early' : 'on time';
  const why = (info.outside ? 'It sits on the path this one branches from, so ' + (rank ? 'Path ' + rank : 'this path') + ' waits for it.' : 'Nothing unfinished drives it, so the rest of ' + (rank ? 'Path ' + rank : 'the path') + ' waits for it.') + (info.held.length ? ' <b>' + info.held.slice(0, 3).map(esc).join(', ') + (info.held.length > 3 ? ' …' : '') + '</b> ' + (info.held.length === 1 ? 'is' : 'are') + ' in progress but only waiting for it.' : '');
  const chips = (info.flow || []).map((f, i) => (i ? `<span class="dn-ar">${esc(f.lk)} ›</span>` : '') + `<span class="dn-chip${i === 0 ? ' c' : f.act ? ' w' : ''}">${esc(f.code)}</span>`).join('') + (info.more ? `<span class="dn-ar">› +${info.more} more</span>` : '');
  return `<div class="dn-top"><span class="k">HOLDING ${rank ? 'PATH ' + rank + ' ' : 'THIS PATH '}NOW</span><span class="dn-late ${info.late == null ? 'na' : info.late > 0 ? '' : 'ok'}">${lt}</span></div><div class="dn-code">${esc(info.code)}</div><div class="dn-n">${esc(info.name)}</div>`
    + `<table class="dn-t"><tr><td>Status</td><td>${info.st}</td></tr>${info.t && rpLocTxt(info.t) ? `<tr><td>Location</td><td>${esc(rpLocTxt(info.t))}</td></tr>` : ''}<tr><td>Finish now / baseline</td><td>${esc(RPD(info.ef))} / ${info.bf != null ? esc(RPD(info.bf)) : 'not in baseline file'}</td></tr><tr><td>Total float</td><td class="${info.tf != null && info.tf < 0 ? 'r' : ''}">${tf}</td></tr></table>`
    + `<div class="dn-why">${why}</div>${(info.flow || []).length > 1 ? `<div class="dn-chips">${chips}</div>` : ''}`; };
const rpDnAttr = (info, rank) => info ? ` data-rpdn="${esc(info.key)}" data-rpdnr="${rank || ''}"` : '';
const rpDnPinSvg = (x, y) => `<g data-rpdnpin="1" style="cursor:help"><rect x="${x}" y="${y}" width="112" height="16" rx="8" fill="#c0392b" stroke="#fff" stroke-width="1.2"/><text x="${x + 56}" y="${y + 11.5}" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing=".3">HOLDING THE PATH</text></g>`;
/* the hover note */
function rpDnShow(el) { const info = RPDN[el.dataset.rpdn]; if (!info) return; let tp = document.getElementById('rpdn-tip'); if (!tp) { tp = document.createElement('div'); tp.id = 'rpdn-tip'; tp.setAttribute('role', 'tooltip'); document.body.appendChild(tp); }
  tp.innerHTML = rpDnTip(info, +el.dataset.rpdnr || 0); tp.hidden = false; const b = el.getBoundingClientRect(), r = tp.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  let x = Math.max(6, Math.min(b.left, W - r.width - 6)), y = b.bottom + 10; tp.classList.toggle('up', false); if (y + r.height > H - 6) { y = Math.max(6, b.top - r.height - 10); tp.classList.add('up'); }
  tp.style.left = x + 'px'; tp.style.top = y + 'px'; tp.style.setProperty('--ax', Math.max(14, Math.min(r.width - 20, b.left + Math.min(60, b.width / 2) - x)) + 'px'); }
const rpDnHide = () => { const tp = document.getElementById('rpdn-tip'); if (tp) tp.hidden = true; };
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-rpdn]'); if (el) rpDnShow(el); else if (!(e.target.closest && e.target.closest('#rpdn-tip'))) rpDnHide(); });
document.addEventListener('click', e => { const p = e.target.closest && e.target.closest('[data-rpdnpin]'); if (!p) return; const el = p.closest('[data-rpdn]'); if (!el) return; e.stopPropagation(); e.preventDefault(); const tp = document.getElementById('rpdn-tip'); if (tp && !tp.hidden) rpDnHide(); else rpDnShow(el); }, true);
window.addEventListener('scroll', rpDnHide, true); document.addEventListener('keydown', e => { if (e.key === 'Escape') rpDnHide(); });

/* ---------- v9.29: paths prioritised by when their own work starts (forecast, from the data date) ----------
   NOW = in progress or starting within rpNowDays; THIS MONTH = within rpSoonDays; LATER = after that. Path 1 (longest) is always kept.
   Within a tier the paths keep their float order. LATER paths are hidden unless the "Show later paths" switch is on. */
const rpPrioOn = () => S.cfg.rpPrio !== false && S.cfg.rpPrio !== 'off';
const rpNowD = () => rpClamp(S.cfg.rpNowDays, 1, 60, 7), rpSoonD = () => Math.max(rpNowD(), rpClamp(S.cfg.rpSoonDays, 2, 180, 30));
const rpShowLater = () => !!S.cfg.rpShowLater;
const rpPrioKey = () => [rpPrioOn(), rpNowD(), rpSoonD(), rpShowLater(), S.cfg.rpAllDriving, S.cfg.rpMaxDriving, (S.rp && S.rp.B ? rpOrdGet(S.rp.B.M).join(',') : '')].join('|');
const RP_TIER = { 1: ['NOW', 'now'], 2: ['THIS MONTH', 'soon'], 3: ['LATER', 'later'] };
function rpTierOf(M, p) { const dd = M.dataDate, ch = (p.chain || []).filter(t => t && t.status !== 'TK_Complete' && t.type !== 'TT_LOE' && t.type !== 'TT_WBS');
  const act = ch.find(t => t.status === 'TK_Active'), f = act || ch.slice().sort((a, b) => (a.es || 0) - (b.es || 0))[0];
  if (!f) return { tier: 3, start: null, act: false, code: '' };
  const st = act ? (act.as != null ? act.as : act.es) : f.es, days = st == null || dd == null ? 1e9 : st - dd;
  return { tier: act || days <= rpNowD() ? 1 : days <= rpSoonD() ? 2 : 3, start: st, act: !!act, days: Math.round(days), code: f.code, name: f.name }; }
function rpPrioritise(M, all, n, R) { all.forEach(p => { p.tierInfo = rpTierOf(M, p); });
  R.pathsHidden = []; all.forEach(p => { p.primary = p.rank === 1; }); if (!rpPrioOn()) { all.forEach(p => { p.tierInfo = null; }); return all.slice(0, n); }
  const p1 = all.filter(p => p.rank === 1), rest = all.filter(p => p.rank !== 1).sort((a, b) => (a.tierInfo.tier === 3 ? 3 : 1) - (b.tierInfo.tier === 3 ? 3 : 1) || a.tierInfo.tier - b.tierInfo.tier || a.rank - b.rank);
  const near = rest.filter(p => p.tierInfo.tier < 3), later = rest.filter(p => p.tierInfo.tier === 3);
  /* v9.41: every path with no float to the finish is shown, whatever the Paths number (up to rpMaxDriving); then renumbered 1..N as displayed */
  const allDrv = !/^(no|off|false|0)$/i.test(String(S.cfg.rpAllDriving == null ? 'yes' : S.cfg.rpAllDriving)), cap = Math.max(n, Math.min(40, Math.round(+S.cfg.rpMaxDriving || 20)));
  const drv = allDrv ? near.filter(p => !(p.rel > 0.5)) : [], take = Math.max(Math.max(0, n - p1.length), Math.min(drv.length, cap - p1.length));
  const nearSel = allDrv ? drv.concat(near.filter(p => !drv.includes(p))).slice(0, take) : near.slice(0, take);
  const sel = p1.concat(nearSel.sort((a, b) => a.tierInfo.tier - b.tierInfo.tier || a.rank - b.rank)); const maxRk = Math.max(...sel.map(p => p.rank));
  const lat = rpShowLater() ? later.filter(p => p.rank < maxRk || sel.length < n).slice(0, n) : [];
  R.pathsHidden = rest.filter(p => !sel.includes(p) && !lat.includes(p)).map(p => ({ rank: p.rank, tier: p.tierInfo.tier, start: p.tierInfo.start }));
  p1.forEach(p => { p.primary = true; });
  let out = sel.concat(lat);
  /* v9.41 R05: paths that hold the finish together can be put in the user's own order (saved per project) */
  { const ord = rpOrdGet(M), gi = new Map(); out.forEach(p => { const k = rpGrpKey(p); if (!gi.has(k)) gi.set(k, k === 'D' ? -1 : gi.size); });
    const pos = c => { const q = ord.indexOf(c); return q < 0 ? 1e6 : q; };
    out = out.map((p, q) => [p, q]).sort((a, b) => gi.get(rpGrpKey(a[0])) - gi.get(rpGrpKey(b[0])) || (ord.length ? pos(a[0].code) - pos(b[0].code) : 0) || a[1] - b[1]).map(x => x[0]); }
  out.forEach((p, i) => { p.rank0 = p.rank; p.rank = i + 1; }); return out; }
const rpOrdKey = M => 'brt.rpOrder.' + String((M && M.proj && M.proj.proj_short_name) || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const rpOrdGet = M => { const v = LS.get(rpOrdKey(M), []); return Array.isArray(v) ? v : []; };
const rpIsDrvP = p => p.primary || (!(p.rel > 0.5) && !(p.tierInfo && p.tierInfo.tier === 3));
/* v9.41 R06: a group = paths with the same float (and the same NOW / THIS MONTH / LATER class); paths are arranged inside their group */
const rpGrpKey = p => rpIsDrvP(p) ? 'D' : ((p.tierInfo ? p.tierInfo.tier : 0) + '|' + Math.round(p.rel || 0));
function rpOrdMove(code, dir) { const R = S.rp, M = R.B.M, P = R.paths || [], me = P.find(p => p.code === code); if (!me) return; const k = rpGrpKey(me), d = P.filter(p => rpGrpKey(p) === k).map(p => p.code), i = d.indexOf(code);
  if (dir === 'top') { d.splice(i, 1); d.unshift(code); } else { const j = i + dir; if (j < 0 || j >= d.length) return; d.splice(i, 1); d.splice(j, 0, code); }
  let q = 0; LS.set(rpOrdKey(M), P.map(p => rpGrpKey(p) === k ? d[q++] : p.code)); rpOrdApply(code); }
function rpOrdApply(keep) { const R = S.rp, sel = keep || ((R.paths || [])[R.pathIdx || 0] || {}).code; R.paths = null; R.pt = null; R.ptKey = null; R.dnet = null; runTrain('rp'); const i = (R.paths || []).findIndex(p => p.code === sel); if (i >= 0 && i !== (R.pathIdx || 0)) { R.pathIdx = i; runTrain('rp'); } viewRecovery(); }
/* the "Arrange" panel under the path selector */
function rpOrdPanel(R) { const P = R.paths || []; if (P.length < 2 || !rpPrioOn()) return ''; const groups = []; P.forEach(p => { const k = rpGrpKey(p); let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, ps: [] }); g.ps.push(p); });
  const multi = groups.filter(g => g.ps.length > 1); if (!multi.length) return ''; const L = rpPathTrains(R), custom = rpOrdGet(R.B.M).length > 0;
  const row = (p, i, n) => { const ln = L.find(x => x.p === p), dn = ln && ln.T ? rpDelayNow(ln.T) : null, nm = dn ? dn.name : (p.label || p.name), loc = dn && dn.t ? rpLocFullTxt(dn.t) : '';
    return `<li><span class="rpo-k">Path ${p.rank}</span><span class="rpo-n"><b>${esc(nm)}</b>${loc ? `<small>📍 ${esc(loc)}</small>` : ''}</span><span class="rpo-b"><button type="button" data-rpord="top" data-rpordc="${esc(p.code)}" ${i === 0 ? 'disabled' : ''} title="Move to the top of its group">⤒</button><button type="button" data-rpord="-1" data-rpordc="${esc(p.code)}" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button><button type="button" data-rpord="1" data-rpordc="${esc(p.code)}" ${i === n - 1 ? 'disabled' : ''} title="Move down">▼</button></span></li>`; };
  const gl = g => g.k === 'D' ? 'Driving the finish · no float' : (g.ps[0].tierInfo ? RP_TIER[g.ps[0].tierInfo.tier][0] + ' · ' : '') + rpFlt(Math.max(0, rpRelU(g.ps[0]))) + ' of float';
  const nP = multi.reduce((a, g) => a + g.ps.length, 0);
  return `<details class="rpo" ${R.ordOpen ? 'open' : ''}><summary>Arrange paths with the same float · ${multi.length === 1 ? nP + ' paths' : multi.length + ' groups, ' + nP + ' paths'}${custom ? ' · <b>your order</b>' : ''}</summary><p class="hint" style="margin:4px 0 6px">Paths in one group have the same float, so the tool cannot rank them. Inside each group, put first the one you want to see first; a path stays in its own group. The paths are renumbered in your order in every view and report. Saved for this project.</p>${multi.map(g => `<h4 class="rpo-g">${esc(gl(g))} <small>${g.ps.length} paths</small></h4><ol>${g.ps.map((p, i) => row(p, i, g.ps.length)).join('')}</ol>`).join('')}${custom ? '<button type="button" class="btn sm ghost" data-rpord="reset">Back to the tool’s order</button>' : ''}</details>`; }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpord]'); if (!b || !S.rp || !S.rp.B) return; const R = S.rp; R.ordOpen = true;
  if (b.dataset.rpord === 'reset') { LS.set(rpOrdKey(R.B.M), []); rpOrdApply(); return; } rpOrdMove(b.dataset.rpordc, b.dataset.rpord === 'top' ? 'top' : +b.dataset.rpord); });
document.addEventListener('toggle', e => { if (e.target && e.target.classList && e.target.classList.contains('rpo') && S.rp) S.rp.ordOpen = e.target.open; }, true);
/* how many displayed paths have no float to the finish (path 1 included) */
const rpCoDrive = () => { const P = (S.rp && S.rp.paths) || []; return P.filter(p => p.rank === 1 || (!(p.rel > 0.5) && !(p.tierInfo && p.tierInfo.tier === 3))).length; };
const rpDrvLbl = () => rpCoDrive() > 1 ? 'PATH 1 OF ' + rpCoDrive() + ' DRIVING THE FINISH' : 'LONGEST PATH';
const rpTierTag = p => { const ti = p && p.tierInfo; if (!ti) return ''; const [lb, cl] = RP_TIER[ti.tier]; return `<span class="rp-tier ${cl}" title="${esc(rpTierWhen(p))}">${lb}</span>`; };
const rpTierWhen = p => { const ti = p && p.tierInfo; if (!ti || ti.start == null) return ''; return ti.act ? 'in progress since ' + RPD(ti.start) : 'starts ' + RPD(ti.start) + (ti.days >= 0 ? ' (in ' + ti.days + ' day' + (ti.days === 1 ? '' : 's') + ')' : ' (late to start)'); };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpshowlater]'); if (!b) return; S.cfg.rpShowLater = !rpShowLater(); try { autosave(); } catch (x) { } const R = S.rp; if (R) { R.pathsN = null; R.pathIdx = 0; } runTrain('rp'); viewRecovery(); });

/* ---------- v9.30: pan (drag to move) and wheel zoom inside the charts; an opened box is brought into view ---------- */
const rpPanBox = el => el && el.closest && el.closest('.rpv-scroll');
let rpPan = null, rpPanEat = false;
document.addEventListener('pointerdown', e => { if (e.button !== 0 || e.pointerType === 'touch') return; const sc = rpPanBox(e.target); if (!sc || e.target.closest('input,select,textarea,button,a,.rpn-b,[data-rpnote],[data-rpdnpin],[data-rplh]')) return;
  rpPan = { sc, x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop, wy: window.scrollY, moved: false, id: e.pointerId }; });
document.addEventListener('pointermove', e => { if (!rpPan) return; const dx = e.clientX - rpPan.x, dy = e.clientY - rpPan.y;
  if (!rpPan.moved && Math.abs(dx) + Math.abs(dy) < 5) return; if (!rpPan.moved) { rpPan.moved = true; rpPan.sc.classList.add('panning'); try { rpPan.sc.setPointerCapture(rpPan.id); } catch (x) { } }
  rpPan.sc.scrollLeft = rpPan.sl - dx; const canY = rpPan.sc.scrollHeight > rpPan.sc.clientHeight + 2;
  if (canY) rpPan.sc.scrollTop = rpPan.st - dy; else window.scrollTo(window.scrollX, rpPan.wy - dy); e.preventDefault(); });
const rpPanEnd = () => { if (!rpPan) return; if (rpPan.moved) { rpPan.sc.classList.remove('panning'); rpPanEat = true; setTimeout(() => { rpPanEat = false; }, 0); } rpPan = null; };
document.addEventListener('pointerup', rpPanEnd); document.addEventListener('pointercancel', rpPanEnd);
document.addEventListener('click', e => { if (rpPanEat) { e.stopPropagation(); e.preventDefault(); rpPanEat = false; } }, true);
/* wheel zoom around the mouse: Ctrl + wheel (or pinch on a trackpad); plain wheel too when the setting says so */
let rpZsave = null;
document.addEventListener('wheel', e => { const sc = rpPanBox(e.target); if (!sc) return; const plain = /^(y|yes|on|true|1)$/i.test(String(S.cfg.rpWheelZoom || '')); if (!e.ctrlKey && !plain) return; e.preventDefault();
  const z0 = rpZoom(), z1 = Math.round(Math.max(40, Math.min(300, z0 * Math.exp(-e.deltaY * 0.0022)))); if (z1 === z0) return;
  const r = sc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = z1 / z0, sl = sc.scrollLeft, st = sc.scrollTop;
  S.cfg.rpZoom = z1; const w = document.querySelector('.rp-wrap'); if (w) w.style.setProperty('--rpz', z1);
  const sl2 = document.getElementById('rp-lz'); if (sl2) { sl2.value = z1; const b = sl2.nextElementSibling; if (b) b.textContent = z1 + '%'; }
  sc.scrollLeft = (sl + mx) * k - mx; if (sc.scrollHeight > sc.clientHeight + 2) sc.scrollTop = (st + my) * k - my;
  clearTimeout(rpZsave); rpZsave = setTimeout(() => { try { autosave(); } catch (x) { } }, 400); }, { passive: false });
/* bring an opened box (or the box just collapsed) into view, inside the chart, without jumping the page */
function rpFocus(sel) { const el = document.querySelector(sel); if (!el) return; const sc = rpPanBox(el) || document.querySelector('.rpv-scroll'); if (!sc) return;
  const r = el.getBoundingClientRect(), c = sc.getBoundingClientRect(), pad = 16;
  if (r.width + pad * 2 <= c.width) sc.scrollLeft += (r.left + r.width / 2) - (c.left + c.width / 2); else sc.scrollLeft += r.left - c.left - pad;
  if (sc.scrollHeight > sc.clientHeight + 2) { if (r.height + pad * 2 <= c.height) sc.scrollTop += (r.top + r.height / 2) - (c.top + c.height / 2); else sc.scrollTop += r.top - c.top - pad; }
  const r2 = el.getBoundingClientRect(), vh = window.innerHeight, top = Math.max(8, (document.querySelector('.rp-full') ? 0 : 70));
  if (r2.height + 24 <= vh - top) { if (r2.top < top || r2.bottom > vh - 8) window.scrollBy({ top: (r2.top + r2.height / 2) - (top + (vh - top) / 2), behavior: 'smooth' }); }
  else if (r2.top < top || r2.top > vh * 0.4) window.scrollBy({ top: r2.top - top - 8, behavior: 'smooth' }); }

/* v9.33: switch between calendar days and working days for float, on the Recovery planner itself (same setting as Setup: rpFloatUnit) */
const rpUnitSw = () => { const u = rpFU(); const b = (v, l, t) => `<button type="button" role="radio" aria-checked="${u === v}" class="${u === v ? 'on' : ''}" data-rpunit="${v}" title="${t}">${l}</button>`;
  return `<span class="rp-seg" role="radiogroup" aria-label="Float shown in"><span class="cap">Float in</span>${b('cd', 'Calendar days', 'Float in calendar days: the same on every calendar, so paths on 6-day and 7-day calendars compare directly')}${b('wd', 'Working days', 'Float in working days of each activity’s own calendar, as P6 shows it')}</span>`; };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpunit]'); if (!b) return; const v = b.dataset.rpunit; if (v === rpFU()) return; S.cfg.rpFloatUnit = v; try { autosave(); } catch (x) { } viewRecovery(); });
