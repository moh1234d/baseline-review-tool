/* v9.43: sign-in, users, permissions and activity log (client side).
   Online, the server says who is signed in and what they may open. The offline file has no server: it runs as before, with everything open. */
const AUTH = { mode: 'offline', name: '', fullName: '', role: 'admin', sections: [], funcs: [], allSections: [], allFuncs: [] };
const isAdmin = () => AUTH.role === 'admin';
const SEC_OF = step => ['setup', 'files', 'confirm', 'run', 'report'].includes(step) ? 'full' : step;
const SEC_LBL = { portfolio: 'Portfolio triage', quick: 'Quick review · XER only', full: 'Full review (setup, files, confirmations, checks, report)', compare: 'Schedule comparison', delay: 'Delay analysis', recovery: 'Recovery planner', claims: 'Claim review', builder: 'Baseline builder', roundtrip: 'P6 roundtrip check', assess: 'Tool assessment' };
const FN_LBL = { upload: 'Load files (XER, Excel, PDF, project files)', export: 'Export and download (Excel, Word, XER, project files)' };
const canSee = step => step === 'home' || (step === 'admin' ? AUTH.mode === 'online' && isAdmin() : isAdmin() || AUTH.sections.includes(SEC_OF(step)));
const canDo = f => isAdmin() || AUTH.funcs.includes(f);
/* activity log: events are sent in batches */
const LOGQ = []; let logTimer = null;
function brtLog(a, d) { if (AUTH.mode !== 'online') return; LOGQ.push({ t: Date.now(), a: String(a), d: d == null ? '' : String(d) }); if (LOGQ.length >= 40) brtLogFlush(); else if (!logTimer) logTimer = setTimeout(brtLogFlush, 20000); }
function brtLogFlush(beacon) { clearTimeout(logTimer); logTimer = null; if (!LOGQ.length || AUTH.mode !== 'online') return; const body = JSON.stringify({ events: LOGQ.splice(0, LOGQ.length) });
  try { if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' })); else fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => { }); } catch (e) { console.error(e); } }
window.addEventListener('pagehide', () => brtLogFlush(true)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') brtLogFlush(true); });
async function authInit() {
  if (!/^https?:$/.test(location.protocol)) return;
  try { const r = await fetch('/api/auth/me', { cache: 'no-store' }); if (r.status === 401) { location.reload(); return; } if (!r.ok) return; const j = await r.json(); if (!j || !j.role) return;
    Object.assign(AUTH, { mode: 'online', name: j.name, fullName: j.fullName || '', role: j.role, sections: j.sections || [], funcs: j.funcs || [], allSections: j.allSections || [], allFuncs: j.allFuncs || [] });
    if (!isAdmin() && S.cfg.ai) Object.keys(S.cfg.ai).forEach(k => { if (S.cfg.ai[k] === true) S.cfg.ai[k] = false; });
    authChip(); } catch (e) { console.error(e); } }
function authChip() { const el = $('#tb-user'); if (!el) return; if (AUTH.mode !== 'online') { el.style.display = 'none'; return; }
  el.style.display = ''; el.innerHTML = `<span>👤 ${esc(AUTH.fullName || AUTH.name)}${isAdmin() ? ' · admin' : ''}</span><b>Sign out</b>`; el.title = 'Signed in as ' + AUTH.name + ' — click to sign out';
  if (!isAdmin()) { const a = $('#tb-ai'), d = $('#tb-drive'); if (a) a.style.display = 'none'; if (d) d.style.display = 'none'; } }
async function authSignOut() { brtLogFlush(); try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { console.error(e); } location.reload(); }
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#tb-user')) authSignOut(); });
/* functions a user was not given: loading files, exporting */
const authFiles = (e, files) => { if (AUTH.mode !== 'online') return true; if (!canDo('upload')) { brtLog('blocked', 'load file ' + [...files].map(f => f.name).join(', ').slice(0, 200)); e.stopImmediatePropagation(); e.preventDefault(); toast('Loading files is not enabled for your account. Ask the admin.', 'bad'); return false; } brtLog('load file', [...files].map(f => f.name).join(', ').slice(0, 280)); return true; };
document.addEventListener('change', e => { const t = e.target; if (t && t.type === 'file' && t.files && t.files.length && !authFiles(e, t.files)) t.value = ''; }, true);
document.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) authFiles(e, f); }, true);
/* Setup is for the admin: a user sees it read-only */
function authLockSetup() { if (AUTH.mode !== 'online' || isAdmin() || S.step !== 'setup') return; const m = $('#main'); m.querySelectorAll('input,select,textarea,button').forEach(el => { if (!el.dataset.go) el.disabled = true; });
  const h = m.querySelector('header.ph'); if (h) h.insertAdjacentHTML('afterend', '<p class="adm-ro">Setup can be changed by the admin only. You can read the values here.</p>'); }

/* ---------------- Administration: users, permissions, settings, activity log ---------------- */
const ADM = { users: [], admin: 'admin', cfg: null, log: [], cursor: null, edit: null, err: '', fU: '', fA: '', fFrom: '', fTo: '', del: '' };
const admApi = async (path, o) => { const r = await fetch(path, Object.assign({ cache: 'no-store' }, o && o.json ? { method: o.method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o.json) } : o || {})); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('Request failed (' + r.status + ')')); return j; };
async function admLoad(more) { try { if (!more) { const [u, c] = await Promise.all([admApi('/api/admin/users'), admApi('/api/admin/cfg')]); ADM.users = u.users; ADM.admin = u.admin; ADM.cfg = c; ADM.log = []; ADM.cursor = null; }
    const l = await admApi('/api/admin/log?limit=100' + (more && ADM.cursor ? '&cursor=' + encodeURIComponent(ADM.cursor) : '')); ADM.log = (more ? ADM.log : []).concat(l.rows); ADM.cursor = l.cursor; ADM.err = ''; } catch (e) { ADM.err = e.message; }
  if (S.step === 'admin') viewAdmin(true); }
const admWhen = t => { if (!t) return '–'; const d = new Date(t), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const admLogRows = () => ADM.log.filter(r => (!ADM.fU || r.u === ADM.fU) && (!ADM.fA || (r.a + ' ' + r.d).toLowerCase().includes(ADM.fA.toLowerCase())) && (!ADM.fFrom || r.t >= Date.parse(ADM.fFrom + 'T00:00:00')) && (!ADM.fTo || r.t <= Date.parse(ADM.fTo + 'T23:59:59')));
function viewAdmin(loaded) {
  if (!canSee('admin')) { go('home'); return; } if (!loaded) { $('#main').innerHTML = '<header class="ph"><h1>Users and activity log</h1><p>Loading…</p></header>'; admLoad(); return; }
  const E = ADM.edit, chk = (name, v, lab, on) => `<label class="adm-ck"><input type="checkbox" data-adm${name}="${v}" ${on ? 'checked' : ''}> ${esc(lab)}</label>`;
  const editor = E ? `<section class="card adm-ed"><h2>${E.isNew ? 'Add a user' : 'Edit user · ' + esc(E.name)}</h2>
    <div class="adm-grid"><label>User name<input id="adm-name" value="${esc(E.name)}" ${E.isNew ? '' : 'disabled'} autocomplete="off" autocapitalize="none" placeholder="e.g. ahmed.k"></label><label>Full name (optional)<input id="adm-full" value="${esc(E.fullName || '')}" autocomplete="off"></label>
    <label>${E.isNew ? 'Password' : 'New password (leave empty to keep the current one)'}<input id="adm-pw" type="password" autocomplete="new-password" placeholder="at least 8 characters"></label></div>
    <h3>Sections this user can open</h3><div class="adm-cks">${AUTH.allSections.map(s => chk('sec', s, SEC_LBL[s] || s, (E.sections || []).includes(s))).join('')}</div>
    <p class="adm-q"><button type="button" class="btn sm ghost" data-admall="1">Tick all</button><button type="button" class="btn sm ghost" data-admall="0">Clear all</button></p>
    <h3>Functions this user can use</h3><div class="adm-cks">${AUTH.allFuncs.map(f => chk('fn', f, FN_LBL[f] || f, (E.funcs || []).includes(f))).join('')}</div>
    <p class="hint">AI, Google Drive and changing Setup are for the admin only and cannot be given to a user.</p>
    <p class="adm-q"><button type="button" class="btn primary" data-admsave="1">${E.isNew ? 'Add user' : 'Save changes'}</button><button type="button" class="btn" data-admcancel="1">Cancel</button><span class="adm-err" role="alert">${esc(E.err || '')}</span></p></section>` : '';
  const urow = u => `<tr class="${u.disabled ? 'off' : ''}"><td><b>${esc(u.name)}</b>${u.fullName ? '<br><small>' + esc(u.fullName) + '</small>' : ''}</td><td>${u.disabled ? '<span class="adm-pill off">Disabled</span>' : '<span class="adm-pill on">Active</span>'}</td><td>${u.sections.length ? u.sections.map(s => esc((SEC_LBL[s] || s).split(' (')[0].split(' · ')[0])).join(', ') : '<i>none</i>'}</td><td>${u.funcs.length ? u.funcs.map(f => f === 'upload' ? 'Load files' : 'Export').join(', ') : '<i>none</i>'}</td><td>${admWhen(u.lastLogin)}</td>
    <td class="adm-act"><button type="button" class="btn sm" data-admedit="${esc(u.name)}">Edit</button><button type="button" class="btn sm" data-admtoggle="${esc(u.name)}">${u.disabled ? 'Enable' : 'Disable'}</button><button type="button" class="btn sm ${ADM.del === u.name ? 'danger' : ''}" data-admdel="${esc(u.name)}">${ADM.del === u.name ? 'Confirm delete' : 'Delete'}</button></td></tr>`;
  const c = ADM.cfg || {}, rows = admLogRows(), names = [...new Set(ADM.log.map(r => r.u))].sort();
  $('#main').innerHTML = `<header class="ph"><h1>Users and activity log</h1><p>You are the admin (<b>${esc(ADM.admin)}</b>). You decide who can sign in, which sections each user can open and which functions each can use. Everything they do is listed in the log below.</p></header>
  ${ADM.err ? `<p class="adm-err" role="alert">${esc(ADM.err)}</p>` : ''}
  <section class="card"><div class="adm-hd"><h2>Users · ${ADM.users.length}</h2>${E ? '' : '<button type="button" class="btn primary" data-admnew="1">Add a user</button>'}</div>
    ${ADM.users.length ? `<div class="adm-sc"><table class="tbl compact adm-t"><thead><tr><th>User</th><th>Status</th><th>Sections</th><th>Functions</th><th>Last sign-in</th><th></th></tr></thead><tbody>${ADM.users.map(urow).join('')}</tbody></table></div>` : '<p class="hint">No users yet. Only the admin can sign in.</p>'}</section>
  ${editor}
  <section class="card"><h2>Sign-in settings</h2><div class="adm-grid four"><label>Stay signed in for (hours)<input id="adm-c-sessionHours" type="number" min="1" max="720" value="${c.sessionHours || 12}"></label><label>Keep the activity log for (days)<input id="adm-c-logDays" type="number" min="1" max="730" value="${c.logDays || 90}"></label><label>Lock after wrong passwords<input id="adm-c-maxFails" type="number" min="3" max="50" value="${c.maxFails || 5}"></label><label>Lock for (minutes)<input id="adm-c-lockMinutes" type="number" min="1" max="1440" value="${c.lockMinutes || 15}"></label></div>
    <p class="adm-q"><button type="button" class="btn" data-admcfg="1">Save settings</button><span class="hint">The admin password is the one set in Cloudflare; it is changed there.</span></p></section>
  <section class="card"><div class="adm-hd"><h2>Activity log · ${rows.length}${rows.length !== ADM.log.length ? ' of ' + ADM.log.length : ''} loaded</h2><span><button type="button" class="btn sm" data-admrefresh="1">Refresh</button> <button type="button" class="btn sm" data-admxls="1" ${rows.length ? '' : 'disabled'}>Export to Excel</button></span></div>
    <div class="adm-grid four"><label>User<select id="adm-f-u"><option value="">All</option>${names.map(n => `<option ${ADM.fU === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label>Action contains<input id="adm-f-a" value="${esc(ADM.fA)}" placeholder="e.g. export, sign-in"></label><label>From<input id="adm-f-from" type="date" value="${esc(ADM.fFrom)}"></label><label>To<input id="adm-f-to" type="date" value="${esc(ADM.fTo)}"></label></div>
    ${rows.length ? `<div class="adm-sc"><table class="tbl compact adm-t"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr><td class="nw">${admWhen(r.t)}</td><td><b>${esc(r.u)}</b>${r.role === 'admin' ? ' <small>admin</small>' : ''}</td><td>${esc(r.a)}</td><td>${esc(r.d)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Nothing to show for this filter.</p>'}
    ${ADM.cursor ? '<p class="adm-q"><button type="button" class="btn sm" data-admmore="1">Load older entries</button></p>' : ''}
    <p class="hint">Logged: sign-in, sign-out and wrong passwords; sections opened; files loaded (names only — the files never leave the user’s computer); exports; AI and Drive use; every change you make here. New entries can take up to a minute to appear.</p></section>`;
}
function admRead() { const E = ADM.edit; if (!E) return; const g = id => { const el = $('#' + id); return el ? el.value : ''; }; if (E.isNew) E.name = g('adm-name').trim().toLowerCase(); E.fullName = g('adm-full').trim(); E.pw = g('adm-pw');
  E.sections = [...document.querySelectorAll('[data-admsec]')].filter(x => x.checked).map(x => x.dataset.admsec); E.funcs = [...document.querySelectorAll('[data-admfn]')].filter(x => x.checked).map(x => x.dataset.admfn); }
document.addEventListener('click', async e => { if (S.step !== 'admin') return; const t = e.target.closest && e.target.closest('button'); if (!t) return; const d = t.dataset;
  const run = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg, 'ok'); await admLoad(); } catch (x) { if (ADM.edit) { ADM.edit.err = x.message; viewAdmin(true); } else toast(x.message, 'bad'); } };
  if (d.admnew) { ADM.edit = { isNew: true, name: '', fullName: '', sections: [], funcs: ['upload', 'export'] }; viewAdmin(true); const n = $('#adm-name'); if (n) n.focus(); }
  else if (d.admedit) { const u = ADM.users.find(x => x.name === d.admedit); if (u) { ADM.edit = { isNew: false, name: u.name, fullName: u.fullName, sections: u.sections.slice(), funcs: u.funcs.slice() }; viewAdmin(true); } }
  else if (d.admcancel) { ADM.edit = null; viewAdmin(true); }
  else if (d.admall) { document.querySelectorAll('[data-admsec]').forEach(x => { x.checked = d.admall === '1'; }); }
  else if (d.admsave) { admRead(); const E = ADM.edit, body = { name: E.name, fullName: E.fullName, sections: E.sections, funcs: E.funcs }; if (E.pw) body.password = E.pw; await run(async () => { await admApi('/api/admin/users', { json: body }); ADM.edit = null; }, E.isNew ? 'User added' : 'Saved'); }
  else if (d.admtoggle) { const u = ADM.users.find(x => x.name === d.admtoggle); if (u) await run(() => admApi('/api/admin/users', { json: { name: u.name, disabled: !u.disabled } }), u.disabled ? 'User enabled' : 'User disabled — signed out at once'); }
  else if (d.admdel) { if (ADM.del !== d.admdel) { ADM.del = d.admdel; viewAdmin(true); setTimeout(() => { if (ADM.del === d.admdel) { ADM.del = ''; if (S.step === 'admin') viewAdmin(true); } }, 5000); } else { ADM.del = ''; await run(() => admApi('/api/admin/users?name=' + encodeURIComponent(d.admdel), { method: 'DELETE' }), 'User deleted'); } }
  else if (d.admcfg) { const v = k => +($('#adm-c-' + k) || {}).value; await run(() => admApi('/api/admin/cfg', { json: { sessionHours: v('sessionHours'), logDays: v('logDays'), maxFails: v('maxFails'), lockMinutes: v('lockMinutes') } }), 'Settings saved'); }
  else if (d.admrefresh) { brtLogFlush(); await admLoad(); }
  else if (d.admmore) await admLoad(true);
  else if (d.admxls) { const rows = admLogRows().map(r => ({ When: admWhen(r.t), User: r.u, Role: r.role, Action: r.a, Detail: r.d })); const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = [{ wch: 17 }, { wch: 18 }, { wch: 8 }, { wch: 22 }, { wch: 80 }]; XLSX.utils.book_append_sheet(wb, ws, 'Activity log');
    download(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Activity_log_' + new Date().toISOString().slice(0, 10) + '_v' + E.VERSION + '.xlsx'); } });
document.addEventListener('input', e => { if (S.step !== 'admin') return; const m = { 'adm-f-u': 'fU', 'adm-f-a': 'fA', 'adm-f-from': 'fFrom', 'adm-f-to': 'fTo' }[e.target.id]; if (!m) return; ADM[m] = e.target.value; if (e.target.id === 'adm-f-a') { clearTimeout(ADM._t); ADM._t = setTimeout(() => { viewAdmin(true); const el = $('#adm-f-a'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 350); } else viewAdmin(true); });
