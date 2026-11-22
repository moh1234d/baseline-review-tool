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
