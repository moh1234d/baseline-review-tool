/* ===== APP PART 29 (v9.1): Home screen, saved projects (this browser, project file, Google Drive) ===== */
const SV = { get() { return Object.assign({ auto: true, saveXer: true, keep: 20, drive: false, clientId: '' }, LS.get('brt.store', {}) || {}); }, set(o) { LS.set('brt.store', Object.assign(SV.get(), o)); } };
const idb = {
  db: null, open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('brt-sessions', 1); r.onupgradeneeded = () => r.result.createObjectStore('s', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('s', mode), rq = fn(t.objectStore('s')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
  put(v) { return this.tx('readwrite', s => s.put(v)); }, get(id) { return this.tx('readonly', s => s.get(id)); }, all() { return this.tx('readonly', s => s.getAll()); }, del(id) { return this.tx('readwrite', s => s.delete(id)); }
};
const svId = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
const svName = () => S.cfg.projectName || (S.rp && S.rp.B && S.rp.B.M.proj && S.rp.B.M.proj.proj_short_name) || 'Untitled project';
const svDate = t => { const d = new Date(t); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const svFd = v => v == null || !isFinite(v) ? '–' : E.fmtDate(Math.round(v));
/* mode 'idb' keeps the XER files as ArrayBuffers, 'b64' as text for a file or Drive */
async function svBuild(mode) {
  const R = S.rp || {}, name = svName(), id = svId(name), c = SV.get();
  let old = S._svRec && S._svRec.id === id ? S._svRec : null; if (!old && window.indexedDB) { try { old = await idb.get(id); } catch (e) { } }
  const rec = { tool: 'baseline-review-tool-session', version: 1, id, name, updated: Date.now(), lastStep: S.step === 'home' ? (old && old.lastStep) || 'setup' : S.step, profile: toProfile(), rp: null, history: old && old.history ? old.history.slice() : [], v: E.VERSION };
  if (R.A && R.B) {
    rec.rp = { A: { name: R.A.name, dd: R.A.M.dataDate }, B: { name: R.B.name, dd: R.B.M.dataDate }, files: null };
    if (c.saveXer && R.A.file && R.B.file) rec.rp.files = mode === 'b64' ? { A: await b64(R.A.file), B: await b64(R.B.file) } : { A: await R.A.file.arrayBuffer(), B: await R.B.file.arrayBuffer() };
    const D = R.tr; if (D && D.train && !D.levBusy) { const tg = D.train.target, key = R.A.name + '|' + R.B.name, e = { key, at: Date.now(), A: R.A.name, B: R.B.name, ddA: R.A.M.dataDate, ddB: R.B.M.dataDate, fA: tg.fA, fB: tg.fB, slip: tg.slip, gain: D.comb ? D.comb.gain : 0, nOn: D.levOn ? D.levOn.size : 0 }, i = rec.history.findIndex(x => x.key === key); if (i >= 0) rec.history[i] = e; else rec.history.push(e); rec.history.sort((a, b) => (a.ddB || 0) - (b.ddB || 0)); }
  }
  return rec;
}
let _svT; function sessionSaveSoon() { clearTimeout(_svT); _svT = setTimeout(() => svSave().catch(e => console.warn('save failed', e)), 1500); }
async function svSave() {
  const c = SV.get(); if (!c.auto || !window.indexedDB) return; if (!S.cfg.projectName && !(S.rp && S.rp.A && S.rp.B)) return;
  const rec = await svBuild('idb'); await idb.put(rec); S._svRec = { id: rec.id, history: rec.history, lastStep: rec.lastStep };
  const all = (await idb.all()).sort((a, b) => b.updated - a.updated); for (const o of all.slice(Math.max(1, +c.keep || 20))) await idb.del(o.id);
  if (c.drive && DR.ready() && Date.now() - (DR.last || 0) > 60000) { DR.last = Date.now(); try { await drSave(); DR.err = ''; } catch (e) { DR.err = e.message; } }
}
const svFile = f => !f ? null : f instanceof ArrayBuffer ? f : null;
async function svRestore(rec) {
  applyProfile(rec.profile); S.cfg.projectName = rec.profile && rec.profile.cfg ? rec.profile.cfg.projectName || '' : ''; S.rpAi = null; S.rp = { paths: null, pathIdx: 0 };
  S._svRec = { id: rec.id, history: rec.history || [], lastStep: rec.lastStep };
  if (rec.rp && rec.rp.files) {
    go('recovery'); toast('Restoring ' + rec.name + '…', 'ok');
    for (const side of ['A', 'B']) { const f = rec.rp.files[side], file = f && f.b64 ? unb64(f) : new File([f], rec.rp[side].name); await rpLoad(side, file); }
  } else if (rec.rp) { go('recovery'); toast('The XER files were not saved. Add ' + rec.rp.A.name + ' and ' + rec.rp.B.name + ' again.', 'warn'); }
  else go(rec.lastStep && rec.lastStep !== 'home' ? rec.lastStep : 'setup');
}
/* ---------- Google Drive: organised as  <tool folder> / <project number - name> / Project file | <date> / Reports, Source files ---------- */
const DR = { tok: null, exp: 0, ids: {}, last: 0, lastOk: 0, err: '', checked: null, up: new Set(), ready() { return !!this.tok && Date.now() < this.exp - 60000; }, reset() { this.ids = {}; this.up = new Set(); this.checked = null; this.rootName = ''; } };
const drKeep = () => { try { sessionStorage.setItem('brt.drtok', JSON.stringify({ t: DR.tok, e: DR.exp })); } catch (e) {} };
try { const k = JSON.parse(sessionStorage.getItem('brt.drtok') || 'null'); if (k && k.t && k.e > Date.now() + 60000) { DR.tok = k.t; DR.exp = k.e; } } catch (e) {}
let drSilentAt = 0;
document.addEventListener('pointerdown', () => { const c = SV.get(); if (!c.drive || !c.clientId || !c.lastConn || DR.ready() || Date.now() - drSilentAt < 600000 || !/^https?:/.test(location.protocol)) return; drSilentAt = Date.now(); drConnect().then(() => { drRefresh(); }).catch(() => {}); }, true);
const svNo = () => String(S.cfg.projectNo || '').trim();
const drClean = t => String(t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
const drProjName = () => { const m = SV.get().nameMode || 'name', no = svNo(), nm = svName(), same = !no || no.toLowerCase() === nm.toLowerCase() || nm.toLowerCase().startsWith(no.toLowerCase());
  return drClean(m === 'no' && no ? no : m === 'both' && !same ? no + ' - ' + nm : nm); };
const drToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const drScope = () => SV.get().driveFolderId ? 'https://www.googleapis.com/auth/drive' : 'https://www.googleapis.com/auth/drive.file';
const drLoadGsi = () => window.google && google.accounts && google.accounts.oauth2 ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in (offline?)')); document.head.appendChild(s); });
async function drConnect() {
  const c = SV.get(); if (!c.clientId) throw new Error('Enter the Google client ID in Setup → Saved projects first.'); if (!/^https?:/.test(location.protocol)) throw new Error('Google sign-in works only on your site address, not on a saved file.');
  await drLoadGsi();
  return new Promise((res, rej) => { const tc = google.accounts.oauth2.initTokenClient({ client_id: c.clientId, scope: drScope(), callback: r => { if (r.error) rej(new Error(r.error_description || r.error)); else { DR.tok = r.access_token; DR.exp = Date.now() + (+r.expires_in || 3600) * 1000; DR.err = ''; drKeep(); SV.set({ lastConn: Date.now() }); res(); } }, error_callback: e => rej(new Error(e && e.type || 'Google sign-in was closed')) }); tc.requestAccessToken({ prompt: SV.get().lastConn ? '' : 'consent' }); });
}
async function drApi(path, opt) { const r = await fetch('https://www.googleapis.com' + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + DR.tok }, opt && opt.headers) })); if (r.status === 401) { DR.tok = null; throw new Error('Google Drive sign-in expired: press Reconnect.'); } if (r.status === 404) throw new Error('Google Drive: folder or file not found (404). If you set your own folder, check its link and that you connected with full Drive access.'); if (!r.ok) throw new Error('Google Drive error ' + r.status); return r; }
const drQ = t => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function drChild(parent, name) {
  const key = parent + '/' + name; if (DR.ids[key]) return DR.ids[key];
  const q = encodeURIComponent("name='" + drQ(name) + "' and '" + parent + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"), j = await (await drApi('/drive/v3/files?q=' + q + '&fields=files(id)')).json();
  if (j.files && j.files[0]) return DR.ids[key] = j.files[0].id;
  const n = await (await drApi('/drive/v3/files', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) })).json(); return DR.ids[key] = n.id;
}
async function drRoot() {
  const c = SV.get(); if (DR.ids.root) return DR.ids.root;
  if (c.driveFolderId) { const j = await (await drApi('/drive/v3/files/' + c.driveFolderId + '?fields=id,name,mimeType')).json(); if (j.mimeType !== 'application/vnd.google-apps.folder') throw new Error('The folder link points to a file, not a folder.'); DR.rootName = j.name; return DR.ids.root = j.id; }
  const nm = drClean(c.driveRoot || 'Baseline Review Tool'), q = encodeURIComponent("name='" + drQ(nm) + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents");
  let j = await (await drApi('/drive/v3/files?q=' + q + '&fields=files(id)')).json(); DR.rootName = nm; if (j.files && j.files[0]) return DR.ids.root = j.files[0].id;
  j = await (await drApi('/drive/v3/files', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: nm, mimeType: 'application/vnd.google-apps.folder' }) })).json(); return DR.ids.root = j.id;
}
async function drPath(parts) { let id = await drRoot(); for (const p of parts) id = await drChild(id, p); return id; }
async function drPut(parent, name, blob) {
  const q = encodeURIComponent("name='" + drQ(name) + "' and '" + parent + "' in parents and trashed=false"), ex = ((await (await drApi('/drive/v3/files?q=' + q + '&fields=files(id)')).json()).files || [])[0];
  const meta = ex ? {} : { name, parents: [parent] }, body = new Blob(['--brt\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(meta) + '\r\n--brt\r\nContent-Type: ' + (blob.type || 'application/octet-stream') + '\r\n\r\n', blob, '\r\n--brt--']);
  await drApi('/upload/drive/v3/files' + (ex ? '/' + ex.id : '') + '?uploadType=multipart', { method: ex ? 'PATCH' : 'POST', headers: { 'content-type': 'multipart/related; boundary=brt' }, body });
}
async function drSave() {
  const rec = await svBuild('b64'), blob = await gzipStr(JSON.stringify(rec)), c = SV.get(), pj = drProjName();
  await drPut(await drPath([pj, 'Project file']), 'BRT_' + rec.id + '.brtp', new Blob([blob], { type: 'application/gzip' }));
  if (c.driveFiles !== false) { const files = []; if (S.rp && S.rp.A && S.rp.A.file) files.push(S.rp.A.file); if (S.rp && S.rp.B && S.rp.B.file) files.push(S.rp.B.file); if (S.orig && S.orig.xer) files.push(S.orig.xer);
    for (const f of files) { const k = pj + '|' + drToday() + '|' + f.name; if (DR.up.has(k)) continue; await drPut(await drPath([pj, drToday(), 'Source files']), f.name, f); DR.up.add(k); } }
  DR.lastOk = Date.now(); DR.err = '';
}
async function drOutput(blob, name) {
  const c = SV.get(); if (!c.drive || c.driveOutputs === false) return;
  if (!DR.ready()) { toast('Google Drive is not connected: this file was not copied to Drive.', 'warn'); return; }
  try { await drPut(await drPath([drProjName(), drToday(), 'Reports']), name, blob); DR.lastOk = Date.now(); toast('Also saved to Google Drive: ' + drProjName() + ' / ' + drToday() + ' / Reports', 'ok'); } catch (e) { DR.err = e.message; toast(e.message, 'bad'); }
}
const _dlOrig = download; download = function (blob, name) { _dlOrig(blob, name); if (!/\.brtp$/.test(String(name))) drOutput(blob, name); };
async function drList() { const q = encodeURIComponent("name contains 'BRT_' and trashed=false"); return ((await (await drApi('/drive/v3/files?q=' + q + '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc')).json()).files || []).filter(f => /^BRT_.*\.brtp$/.test(f.name)); }
async function drOpen(id) { const b = await (await drApi('/drive/v3/files/' + id + '?alt=media')).blob(); const rec = await readBundle(new File([b], 'x.brtp')); if (!rec || rec.tool !== 'baseline-review-tool-session') throw new Error('Not a project saved by this tool'); await svRestore(rec); }
/* status: connected? can it save? can it load? where? */
function drStatus() {
  const c = SV.get(), web = /^https?:/.test(location.protocol), ok = DR.ready(), why = !c.drive ? 'Google Drive is switched off (Setup → Saved projects).' : !c.clientId ? 'Add the Google client ID in Setup.' : !web ? 'Open the site address, not the saved file.' : !ok ? (c.lastConn ? 'Sign-in expired: press Reconnect.' : 'Press Connect.') : '';
  const root = c.driveFolderId ? (DR.rootName ? DR.rootName + ' (your folder)' : 'your folder (link set)') : drClean(c.driveRoot || 'Baseline Review Tool'), can = c.drive && !!c.clientId && web && ok;
  return { c, web, ok, can, why, conn: !c.drive ? 'Off' : ok ? 'Connected' : c.lastConn ? 'Sign-in expired' : 'Not connected', path: root + ' / ' + (drProjName() || '…') + ' / ' + drToday() };
}
function drStatusHtml(full) {
  const st = drStatus(), dot = (g, t) => `<span class="drdot ${g ? 'g' : 'r'}"></span>${t}`;
  return `<div class="drst"><div class="drgrid">
  <div><small>Connection</small><b>${dot(st.ok, st.conn)}</b></div>
  <div><small>Saving</small><b>${dot(st.can, st.can ? 'Available' : 'Not available')}</b></div>
  <div><small>Loading</small><b>${dot(st.can, st.can ? 'Available' : 'Not available')}</b></div>
  <div><small>Saves to</small><b class="drpath">${esc(st.path)}</b></div>
  <div><small>Last saved</small><b>${DR.lastOk ? esc(svDate(DR.lastOk)) : '–'}</b></div></div>
  ${st.why ? `<p class="hint" style="margin:8px 0 0">${esc(st.why)}</p>` : ''}${DR.err ? `<p class="hint" style="margin:6px 0 0;color:#C0392B">${esc(DR.err)}</p>` : ''}
  ${!svNo() ? `<p class="hint" style="margin:6px 0 0"></p>` : ''}
  <div class="actions" style="margin-top:8px;flex-wrap:wrap;gap:8px">${st.c.drive ? `<button class="btn ${st.ok ? '' : 'primary'}" data-sv-act="connect">${st.ok ? 'Reconnect' : (st.c.lastConn ? 'Reconnect' : 'Connect') + ' Google Drive'}</button><button class="btn" data-sv-act="check" ${st.ok ? '' : 'disabled'}>Check the folder</button><button class="btn" data-sv-act="drive-now" ${st.can ? '' : 'disabled'}>Save this project to Drive now</button>${st.ok ? '<button class="btn" data-sv-act="disconnect">Disconnect</button>' : ''}` : '<button class="btn primary" data-go="setup">Set up Google Drive</button>'}</div>
  ${full ? `<label class="f" style="max-width:340px;margin-top:10px"><span>Project number (optional, used when folder name includes it)</span><input type="text" data-sv-no="1" value="${esc(svNo())}" placeholder="e.g. P0076"></label>` : ''}</div>`;
}
function drChip() { const el = $('#tb-drive'); if (!el) return; const st = drStatus(); el.className = 'tbchip tbdrive' + (st.ok ? ' on' : ''); el.style.display = st.c.drive ? '' : 'none'; el.innerHTML = `<span class="drdot ${st.ok ? 'g' : 'r'}"></span>Drive`; el.title = 'Google Drive: ' + st.conn + (st.why ? '. ' + st.why : ''); }
function drRefresh() { drChip(); if (S.step === 'home') { const b = $('#hm-drive'); if (b) b.innerHTML = drStatusHtml(false); hmFill(); } else if (S.step === 'setup') viewSetup(); }
/* ---------- project file ---------- */
async function svExportFile() { const rec = await svBuild('b64'); const blob = await gzipStr(JSON.stringify(rec)); download(blob, svName().replace(/[^\w.-]+/g, '_') + '_project.brtp'); toast('Project file saved (' + (blob.size / 1048576).toFixed(1) + ' MB)', 'ok'); }
async function svOpenFile(file) { try { const b = await readBundle(file); if (b && b.tool === 'baseline-review-tool-session') await svRestore(b); else if (b && b.tool === 'baseline-review-tool-bundle') await importBundle(file); else throw new Error('This is not a project file from this tool.'); } catch (e) { toast(e.message, 'bad'); } }
/* ---------- Home ---------- */
const HM_CARDS = [['t1', '☰', 'Review a baseline', 'Check logic, durations, calendars and contract dates of a baseline programme.', [['XER only', 'quick'], ['With documents', 'setup']]], ['t2', '⇄', 'Check an update', 'See what moved since the baseline or the last update, and why.', [['Open', 'compare']]], ['t3', '🛟', 'Find the delay and recover it', 'Delay train, delay causes and recovery levers with what-if recalculation.', [['Open', 'recovery']]], ['t4', '🏗', 'Build a baseline', 'Turn a BOQ and contract documents into a draft baseline programme.', [['Start from BOQ', 'builder']]], ['t5', '⚖', 'Review a claim', 'Test a contractor claim against the schedules and the contract.', [['Open', 'claims']]], ['t6', '▤', 'Triage many projects', 'Rank a batch of XER files by schedule quality in one pass.', [['Open', 'portfolio']]]];
function viewHome() {
  $('#main').innerHTML = `<header class="ph"><h1>What do you want to do?</h1><p>Pick a goal, or drop your XER files and the tool suggests what to do. Nothing is uploaded: files are read in your browser.</p></header>
  <section class="card" id="hm-contsec"><h2>Continue</h2><div id="hm-cont"><p class="hint">Looking for saved projects…</p></div><div class="actions" style="flex-wrap:wrap;gap:8px"><button class="btn" data-sv-act="export">Save project file</button><label class="btn" for="hm-open">Open project file</label><input type="file" id="hm-open" accept=".brtp,.brt" hidden></div></section>
  <section class="card"><h2>Google Drive <small>status</small></h2><div id="hm-drive">${drStatusHtml(false)}</div></section>
  <div class="hm-grid">${HM_CARDS.map(([c, ic, t, d, ln]) => `<div class="hm-card ${c}"><div class="ic">${ic}</div><b>${t}</b><span>${d}</span><div class="hm-go">${ln.map(([l, k]) => `<button class="btn ${ln.length > 1 && k === 'setup' ? '' : 'primary'} sm" data-go="${k}">${l} →</button>`).join('')}</div></div>`).join('')}</div>
  <section class="card hm-drop"><h2>Or drop your files here</h2>${drop('hm-files', '.xer,.txt', true, 'Drop one or more XER files')}<div id="hm-found"></div></section>
  <div id="hm-hist"></div>`;
  hmFill();
}
async function hmFill() {
  const el = $('#hm-cont'); if (!el) return; let loc = []; try { loc = window.indexedDB ? (await idb.all()).sort((a, b) => b.updated - a.updated) : []; } catch (e) { }
  const c = SV.get(); let dr = [], drMsg = '';
  if (c.drive && DR.ready()) { try { dr = await drList(); } catch (e) { drMsg = e.message; } }
  const have = new Set(loc.map(r => r.id)), driveOnly = dr.filter(f => !have.has(f.name.replace(/^BRT_|\.brtp$/g, '')));
  const row = r => `<div class="hm-row"><div><b>${esc(r.name)}</b><small>${r.rp ? esc(dtr(r.rp.A.name, 28)) + ' → ' + esc(dtr(r.rp.B.name, 28)) : 'settings and decisions'} · ${esc(svDate(r.updated))}${r.rp && r.rp.files ? ' · files saved' : ''}</small></div><span class="hm-b">this browser</span><button class="btn sm primary" data-sv-open="${esc(r.id)}">Open</button><button class="btn sm" data-sv-del="${esc(r.id)}" title="Delete from this browser">✕</button></div>`;
  const drow = f => `<div class="hm-row"><div><b>${esc(f.name.replace(/^BRT_|\.brtp$/g, ''))}</b><small>Google Drive · ${esc(svDate(f.modifiedTime))}</small></div><span class="hm-b dr">Drive</span><button class="btn sm primary" data-sv-drive="${esc(f.id)}">Open</button></div>`;
  el.innerHTML = (loc.map(row).join('') + driveOnly.map(drow).join('')) || `<p class="hint">Nothing saved yet. Projects are saved automatically in this browser once you load files${c.auto ? '' : ' (auto-save is off in Setup → Saved projects)'}.</p>`;
  if (drMsg) el.innerHTML += `<p class="hint" style="color:#C0392B">${esc(drMsg)}</p>`;
  
  const last = loc.find(r => r.history && r.history.length); const hh = $('#hm-hist');
  if (hh && last) { const H = last.history, mx = Math.max(1, ...H.map(x => Math.abs(x.slip || 0)));
    hh.innerHTML = `<section class="card"><h2>Updates analysed – ${esc(last.name)} <small>${H.length > 1 ? 'is the delay shrinking?' : 'load more updates to see the trend'}</small></h2><div style="overflow-x:auto"><table class="tbl compact"><thead><tr><th>Update file</th><th>Data date</th><th>Forecast finish</th><th>Days late</th><th>Recovered by levers</th><th></th></tr></thead><tbody>${H.map(x => `<tr><td>${esc(dtr(x.B, 38))}</td><td>${esc(svFd(x.ddB))}</td><td>${esc(svFd(x.fB))}</td><td><b>${x.slip == null ? '–' : (x.slip > 0 ? '+' : '') + x.slip + ' d'}</b></td><td>${x.gain ? '−' + x.gain + ' d (' + x.nOn + ' lever' + (x.nOn === 1 ? '' : 's') + ')' : '–'}</td><td style="width:140px"><span class="hm-bar" style="width:${Math.round(Math.abs(x.slip || 0) / mx * 120)}px"></span></td></tr>`).join('')}</tbody></table></div></section>`; }
}
async function hmDrop(files) {
  const box = $('#hm-found'); if (!box) return; const got = [];
  for (const f of files) { try { const x = await xerStage(f); got.push({ f, M: x.M, n: x.M.tasks.length, dd: x.M.dataDate, proj: (x.M.proj && (x.M.proj.proj_short_name || x.M.proj.proj_id)) || '' }); } catch (e) { got.push({ f, err: e.message }); } }
  const ok = got.filter(g => g.M).sort((a, b) => (a.dd || 0) - (b.dd || 0)); S._hm = ok;
  const b = (k, lab, p) => `<button class="btn ${p ? 'primary' : ''}" data-hm="${k}">${lab}</button>`;
  box.innerHTML = `<h3 class="rp-h3">Recognised</h3>${got.map(g => g.M ? `<div class="hm-row"><span class="ok">✓</span><b>${esc(dtr(g.f.name, 44))}</b><small>${g.n.toLocaleString('en-US')} activities · data date ${esc(svFd(g.dd))}${g.proj ? ' · ' + esc(g.proj) : ''}</small></div>` : `<div class="hm-row"><span>✗</span><b>${esc(dtr(g.f.name, 44))}</b><small>${esc(g.err)}</small></div>`).join('')}
  ${ok.length ? `<h3 class="rp-h3">Suggested next steps</h3><div class="actions" style="flex-wrap:wrap;gap:8px">${ok.length === 1 ? b('quick', 'Quick review of this file', 1) : b('rp', 'Find the delay and recover it (oldest → newest)', 1) + b('cmp', 'Check the update')}${ok.length > 2 ? b('pf', 'Triage all ' + ok.length + ' files') : ''}</div>${ok.length > 1 ? `<p class="hint">The oldest data date (${esc(svFd(ok[0].dd))}) is used as the baseline / previous file and the newest (${esc(svFd(ok[ok.length - 1].dd))}) as the current update.</p>` : ''}` : ''}`;
}
document.addEventListener('change', e => { const t = e.target; if (t.id === 'hm-files' && t.files.length) hmDrop([...t.files]); if (t.id === 'hm-open' && t.files.length) svOpenFile(t.files[0]);
  if (t.matches && t.matches('[data-sv]')) { const k = t.dataset.sv; let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Math.max(1, +t.value || 20) : t.value.trim(); if (k === 'driveFolderId') { const m = /folders\/([\w-]+)/.exec(v) || /[?&]id=([\w-]+)/.exec(v); v = m ? m[1] : v.replace(/[^\w-]/g, ''); } SV.set({ [k]: v }); if (/^(driveFolderId|driveRoot|clientId|drive|nameMode)$/.test(k)) { DR.reset(); if (k === 'driveFolderId' || k === 'clientId') { DR.tok = null; SV.set({ lastConn: 0 }); } } drChip(); if (S.step === 'setup') viewSetup(); }
  if (t.matches && t.matches('[data-sv-no]')) { S.cfg.projectNo = t.value.trim(); DR.ids = {}; autosave(); drRefresh(); } });
document.addEventListener('click', async e => { const t = e.target.closest && e.target.closest('[data-hm],[data-sv-act],[data-sv-open],[data-sv-del],[data-sv-drive]'); if (!t) return;
  try {
    if (t.dataset.hm) { const ok = S._hm || [], k = t.dataset.hm, first = ok[0], last = ok[ok.length - 1], ent = g => ({ M: g.M, name: g.f.name, file: g.f });
      if (k === 'quick') { go('quick'); await qLoadXer(first.f); }
      else if (k === 'rp') { S.rp = { A: ent(first), B: ent(last), paths: null, pathIdx: 0 }; go('recovery'); }
      else if (k === 'cmp') { S.cmp = S.cmp || {}; S.cmp.A = ent(first); S.cmp.B = ent(last); S.cmp.res = null; S.cmp.more = {}; go('compare'); if (typeof runCmp === 'function') runCmp(); }
      else if (k === 'pf') { go('portfolio'); await pfRun(ok.map(g => g.f)); } return; }
    if (t.dataset.svOpen) { const r = await idb.get(t.dataset.svOpen); if (r) await svRestore(r); return; }
    if (t.dataset.svDel) { if (confirm('Delete this saved project from this browser?')) { await idb.del(t.dataset.svDel); hmFill(); } return; }
    if (t.dataset.svDrive) { await drOpen(t.dataset.svDrive); return; }
    const a = t.dataset.svAct;
    if (a === 'export') await svExportFile();
    if (a === 'connect') { await drConnect(); toast('Google Drive connected', 'ok'); drRefresh(); sessionSaveSoon(); }
    if (a === 'check') { const id = await drPath([drProjName()]); DR.err = ''; DR.checked = Date.now(); toast('Folder OK: ' + drStatus().path.split(' / ').slice(0, 2).join(' / '), 'ok'); drRefresh(); }
    if (a === 'drive-now') { if (!S.cfg.projectName && !(S.rp && S.rp.A)) throw new Error('Nothing to save yet: set a project name or load files first.'); await drSave(); toast('Saved to Google Drive', 'ok'); drRefresh(); }
    if (a === 'disconnect') { DR.tok = null; try { sessionStorage.removeItem('brt.drtok'); } catch (e) {} DR.reset(); SV.set({ lastConn: 0 }); toast('Google Drive disconnected in this browser', 'ok'); drRefresh(); }
    if (a === 'clear') { if (confirm('Delete ALL saved projects from this browser?')) { for (const r of await idb.all()) await idb.del(r.id); S._svRec = null; toast('Saved projects cleared', 'ok'); } }
  } catch (err) { console.error(err); DR.err = err.message; toast(err.message, 'bad'); drRefresh(); } });
function svCard() {
  const c = SV.get(), file = !/^https?:/.test(location.protocol);
  return `<section class="card"><h2>Saved projects <small>this browser, project file, Google Drive</small></h2>
  <label class="sw"><input type="checkbox" data-sv="auto" ${c.auto ? 'checked' : ''}><span>Save projects automatically in this browser (shown under Continue on the Home screen)</span></label>
  <label class="sw"><input type="checkbox" data-sv="saveXer" ${c.saveXer ? 'checked' : ''}><span>Also keep the XER files, so a project reopens with its files (off = only settings and results; you drop the files again)</span></label>
  <div class="grid g4"><label class="f"><span>Projects to keep</span><input type="number" min="1" data-sv="keep" value="${esc(c.keep)}"></label></div>
  <label class="sw"><input type="checkbox" data-sv="drive" ${c.drive ? 'checked' : ''}><span>Save my work to Google Drive (off by default)</span></label>
  <div class="aiopts ${c.drive ? '' : 'off'}">
  <div id="st-drive">${drStatusHtml(true)}</div>
  <div class="grid" style="margin-top:10px"><label class="f"><span>Google client ID (create once in Google Cloud)</span><input type="text" data-sv="clientId" value="${esc(c.clientId)}" placeholder="123456-abc.apps.googleusercontent.com" autocomplete="off"></label>
  <label class="f"><span>Project folder name</span><select data-sv="nameMode"><option value="name"${(c.nameMode||'name')==='name'?' selected':''}>Project name only</option><option value="both"${c.nameMode==='both'?' selected':''}>Project number - name</option><option value="no"${c.nameMode==='no'?' selected':''}>Project number only</option></select></label>
  <label class="f"><span>Tool folder name in My Drive (created if missing)</span><input type="text" data-sv="driveRoot" value="${esc(c.driveRoot || 'Baseline Review Tool')}"></label>
  <label class="f"><span>OR the link of a folder you made yourself (optional; needs full Drive access when you connect)</span><input type="text" data-sv="driveFolderId" value="${esc(c.driveFolderId || '')}" placeholder="https://drive.google.com/drive/folders/…" autocomplete="off"></label></div>
  <label class="sw"><input type="checkbox" data-sv="driveFiles" ${c.driveFiles !== false ? 'checked' : ''}><span>Also save the source XER files, in &lt;project&gt; / &lt;date&gt; / Source files</span></label>
  <label class="sw"><input type="checkbox" data-sv="driveOutputs" ${c.driveOutputs !== false ? 'checked' : ''}><span>Also copy every Word / Excel file I download, into &lt;project&gt; / &lt;date&gt; / Reports</span></label>
  <p class="hint">Layout: tool folder / <b>project number - name</b> / Project file (the latest project) · <b>YYYY-MM-DD</b> / Reports and Source files. With the default access the tool sees only what it created. Using your own folder needs full Drive access, which is broader.</p></div>
  <div class="actions" style="margin-top:8px"><button class="btn" data-sv-act="clear">Clear saved projects in this browser</button></div></section>`;
}
