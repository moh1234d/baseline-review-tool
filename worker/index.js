// Sign-in, users, permissions and activity log for the Baseline Review Tool (v9.43).
// Admin: one built-in account. Its name is BRT_ADMIN (default "admin"); its password is the Worker secret BRT_PASSWORD
// (set in Cloudflare, never in this repository). If the secret is missing the site stays closed.
// Users: created by the admin, kept in KV (BRT_KV) with a salted PBKDF2 hash — passwords are never stored or shown.
// Sessions: a signed cookie (HMAC). Log: batches of events in KV, kept for cfg.logDays.
const enc = new TextEncoder();
async function same(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y); let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i]; return d === 0;
}
const b64 = buf => { let s = ''; for (const c of new Uint8Array(buf)) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const JR = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'content-type': 'application/json', 'Cache-Control': 'no-store' }, h || {}) });
export const SECTIONS = ['portfolio', 'quick', 'full', 'compare', 'delay', 'recovery', 'claims', 'builder', 'roundtrip', 'assess'];
export const FUNCS = ['upload', 'export'];            // AI, Google Drive and changing Setup are for the admin only
const CFG_DEF = { sessionHours: 12, logDays: 90, maxFails: 5, lockMinutes: 15 };
const adminName = env => String(env.BRT_ADMIN || 'admin').trim().toLowerCase();
const normUser = u => String(u == null ? '' : u).trim().toLowerCase();
const okUser = u => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(u);
async function hashPw(pw, salt) { const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']); return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 100000 }, k, 256)); }
async function hmac(env, msg) { const k = await crypto.subtle.importKey('raw', enc.encode('brt-session|' + env.BRT_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); }
export async function getCfg(env) { let c = null; try { c = env.BRT_KV ? await env.BRT_KV.get('cfg:auth', 'json') : null; } catch (e) { c = null; } return Object.assign({}, CFG_DEF, c || {}); }
async function getUser(env, name) { if (!env.BRT_KV) return null; try { return await env.BRT_KV.get('user:' + name, 'json'); } catch (e) { return null; } }
const pub = u => ({ name: u.name, fullName: u.fullName || '', role: 'user', disabled: !!u.disabled, sections: (u.sections || []).filter(x => SECTIONS.includes(x)), funcs: (u.funcs || []).filter(x => FUNCS.includes(x)), created: u.created || null, lastLogin: u.lastLogin || null });
const cookieOf = (request) => { const m = /(?:^|;\s*)brt_s=([^;]+)/.exec(request.headers.get('Cookie') || ''); return m ? m[1] : ''; };
const setCookie = (v, maxAge, secure) => 'brt_s=' + v + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (secure ? '; Secure' : '');
/* who is asking? null, or { name, role, sections, funcs } read fresh (a disabled or changed user takes effect at once) */
export async function whoIs(request, env) {
  const tok = cookieOf(request); if (!tok || !env.BRT_PASSWORD) return null; const i = tok.lastIndexOf('.'); if (i < 0) return null;
  const body = tok.slice(0, i); if (!(await same(tok.slice(i + 1), await hmac(env, body)))) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(unb64(body))); } catch (e) { return null; }
  if (!p || !p.u || !(p.exp > Date.now())) return null;
  if (p.r === 'admin') return p.u === adminName(env) ? { name: p.u, role: 'admin', sections: SECTIONS.slice(), funcs: FUNCS.slice() } : null;
  const u = await getUser(env, p.u); if (!u || u.disabled || (u.pv || 0) !== (p.v || 0)) return null;
  return Object.assign(pub(u), { role: 'user' });
}
/* one log record = one KV write: { u, role, ev: [{ t, a, d }] }, newest first by key */
export async function logPut(env, who, events) {
  if (!env.BRT_KV || !events || !events.length) return; try { const cfg = await getCfg(env), now = Date.now();
    const ev = events.slice(0, 60).map(e => ({ t: Math.min(now, +e.t || now), a: String(e.a || '').slice(0, 40), d: String(e.d == null ? '' : e.d).slice(0, 300) })).filter(e => e.a);
    if (!ev.length) return; const key = 'log:' + String(9e15 - now).padStart(16, '0') + ':' + Math.random().toString(36).slice(2, 8);
    await env.BRT_KV.put(key, JSON.stringify({ u: who.name, role: who.role, ev }), { expirationTtl: Math.max(1, Math.min(730, Math.round(+cfg.logDays || 90))) * 86400 }); } catch (e) { /* the log never blocks the tool */ }
}
const LOGIN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baseline Review Tool — sign in</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#eef1f5;font-family:'Segoe UI',Arial,sans-serif;color:#1d2433}
form{background:#fff;border:1px solid #dde3ea;border-radius:14px;padding:26px 28px;width:min(360px,calc(100vw - 32px));box-sizing:border-box;box-shadow:0 10px 30px rgba(16,24,40,.08)}
h1{font-size:19px;margin:0 0 4px}p{margin:0 0 16px;color:#5e6a7d;font-size:13px}label{display:block;font-size:12px;font-weight:600;margin:12px 0 4px}
input{width:100%;box-sizing:border-box;border:1px solid #c9d1dc;border-radius:9px;padding:10px 12px;font-size:15px}input:focus{outline:2px solid #0f7c6c;border-color:#0f7c6c}
button{margin-top:18px;width:100%;border:0;border-radius:9px;background:#0f7c6c;color:#fff;font-size:15px;font-weight:600;padding:11px;cursor:pointer}button[disabled]{opacity:.6}
#m{min-height:18px;margin-top:12px;font-size:13px;color:#c0392b}</style></head><body><form id="f" autocomplete="on"><h1>Baseline Review Tool</h1><p>Sign in to continue.</p>
<label for="u">User name</label><input id="u" name="username" autocomplete="username" autocapitalize="none" required autofocus>
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button id="b" type="submit">Sign in</button><div id="m" role="alert"></div></form><script>
document.getElementById('f').addEventListener('submit',async function(e){e.preventDefault();var b=document.getElementById('b'),m=document.getElementById('m');b.disabled=true;m.textContent='';
try{var r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({u:document.getElementById('u').value,p:document.getElementById('p').value})});
var j=await r.json().catch(function(){return{}});if(r.ok){location.reload();return}m.textContent=j.error||'Sign-in failed.'}catch(x){m.textContent='No connection. Try again.'}b.disabled=false});</script></body></html>`;
export async function auth(request, env, url) {
  const p = url.pathname, m = request.method, secure = url.protocol === 'https:';
  if (m !== 'GET' && m !== 'HEAD') { const o = request.headers.get('Origin'); if (o && o !== url.origin) return JR({ error: 'Cross-site request refused.' }, 403); }
  if (p === '/api/auth/login' && m === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return JR({ error: 'Bad request.' }, 400); }
    const name = normUser(b.u), pw = String(b.p == null ? '' : b.p), cfg = await getCfg(env), fk = 'fail:' + name, bad = 'Wrong user name or password.';
    if (!name || !pw || name.length > 64 || pw.length > 200) return JR({ error: bad }, 401);
    let f = null; try { f = env.BRT_KV ? await env.BRT_KV.get(fk, 'json') : null; } catch (e) { f = null; }
    if (f && f.n >= cfg.maxFails) return JR({ error: 'Too many wrong attempts. Try again in ' + cfg.lockMinutes + ' minutes.' }, 429);
    let who = null, pv = 0;
    if (name === adminName(env)) { if (await same(pw, String(env.BRT_PASSWORD))) who = { name, role: 'admin' }; }
    else { const u = await getUser(env, name); if (u && !u.disabled && u.salt && await same(await hashPw(pw, u.salt), u.hash)) { who = { name, role: 'user' }; pv = u.pv || 0; try { u.lastLogin = Date.now(); await env.BRT_KV.put('user:' + name, JSON.stringify(u)); } catch (e) { } } else if (!u) await hashPw(pw, 'AAAAAAAAAAAAAAAAAAAAAA'); }
    if (!who) { try { if (env.BRT_KV) await env.BRT_KV.put(fk, JSON.stringify({ n: (f ? f.n : 0) + 1 }), { expirationTtl: Math.max(60, cfg.lockMinutes * 60) }); } catch (e) { }
      await logPut(env, { name: name.slice(0, 32), role: '?' }, [{ a: 'sign-in failed', d: '' }]); return JR({ error: bad }, 401); }
    try { if (f && env.BRT_KV) await env.BRT_KV.delete(fk); } catch (e) { }
    const hrs = Math.max(1, Math.min(720, +cfg.sessionHours || 12)), body = b64(enc.encode(JSON.stringify({ u: who.name, r: who.role, v: pv, exp: Date.now() + hrs * 3600e3 })));
    await logPut(env, who, [{ a: 'sign-in', d: '' }]);
    return JR({ ok: true, name: who.name, role: who.role }, 200, { 'Set-Cookie': setCookie(body + '.' + await hmac(env, body), hrs * 3600, secure) });
  }
  const who = await whoIs(request, env);
  if (p === '/api/auth/logout') { if (who) await logPut(env, who, [{ a: 'sign-out', d: '' }]); return JR({ ok: true }, 200, { 'Set-Cookie': setCookie('x', 0, secure) }); }
  if (!who) return JR({ error: 'Sign in first.' }, 401);
  if (p === '/api/auth/me') return JR({ name: who.name, fullName: who.fullName || '', role: who.role, sections: who.sections, funcs: who.funcs, allSections: SECTIONS, allFuncs: FUNCS });
  if (p === '/api/log' && m === 'POST') { let b; try { b = await request.json(); } catch (e) { return JR({ error: 'Bad request.' }, 400); } await logPut(env, who, Array.isArray(b.events) ? b.events : []); return JR({ ok: true }); }
  if (!p.startsWith('/api/admin/')) return JR({ error: 'Unknown route.' }, 404);
  if (who.role !== 'admin') return JR({ error: 'Admin only.' }, 403);
  if (!env.BRT_KV) return JR({ error: 'Storage (BRT_KV) is not set up on the Worker.' }, 503);
  if (p === '/api/admin/users' && m === 'GET') { const out = []; let cur; do { const l = await env.BRT_KV.list({ prefix: 'user:', cursor: cur }); for (const k of l.keys) { const u = await env.BRT_KV.get(k.name, 'json'); if (u) out.push(pub(u)); } cur = l.list_complete ? null : l.cursor; } while (cur);
    return JR({ admin: adminName(env), users: out.sort((a, b) => a.name.localeCompare(b.name)) }); }
  if (p === '/api/admin/users' && m === 'POST') { let b; try { b = await request.json(); } catch (e) { return JR({ error: 'Bad request.' }, 400); }
    const name = normUser(b.name); if (!okUser(name)) return JR({ error: 'User name: 3 to 32 characters — letters, digits, dot, dash or underscore.' }, 400);
    if (name === adminName(env)) return JR({ error: 'That name is the admin account.' }, 400);
    const old = await getUser(env, name), pw = b.password == null ? '' : String(b.password);
    if (!old && !pw) return JR({ error: 'A new user needs a password.' }, 400); if (pw && (pw.length < 8 || pw.length > 200)) return JR({ error: 'Password: at least 8 characters.' }, 400);
    const u = old || { name, created: Date.now(), pv: 0 };
    if (b.fullName != null) u.fullName = String(b.fullName).slice(0, 80);
    if (Array.isArray(b.sections)) u.sections = b.sections.filter(x => SECTIONS.includes(x)); if (Array.isArray(b.funcs)) u.funcs = b.funcs.filter(x => FUNCS.includes(x));
    if (b.disabled != null) u.disabled = !!b.disabled;
    if (pw) { const salt = b64(crypto.getRandomValues(new Uint8Array(16))); u.salt = salt; u.hash = await hashPw(pw, salt); u.pv = (u.pv || 0) + 1; }   // a new password signs the user out everywhere
    await env.BRT_KV.put('user:' + name, JSON.stringify(u));
    await logPut(env, who, [{ a: old ? 'user changed' : 'user added', d: name + (pw && old ? ' · password reset' : '') + (b.disabled != null ? (u.disabled ? ' · disabled' : ' · enabled') : '') + ' · sections: ' + ((u.sections || []).join(', ') || 'none') + ' · functions: ' + ((u.funcs || []).join(', ') || 'none') }]);
    return JR({ ok: true, user: pub(u) }); }
  if (p === '/api/admin/users' && m === 'DELETE') { const name = normUser(url.searchParams.get('name')); if (!(await getUser(env, name))) return JR({ error: 'No such user.' }, 404); await env.BRT_KV.delete('user:' + name); await logPut(env, who, [{ a: 'user deleted', d: name }]); return JR({ ok: true }); }
  if (p === '/api/admin/cfg' && m === 'GET') return JR(await getCfg(env));
  if (p === '/api/admin/cfg' && m === 'POST') { let b; try { b = await request.json(); } catch (e) { return JR({ error: 'Bad request.' }, 400); } const c = await getCfg(env), n = (v, lo, hi, d) => { v = Math.round(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const nc = { sessionHours: n(b.sessionHours, 1, 720, c.sessionHours), logDays: n(b.logDays, 1, 730, c.logDays), maxFails: n(b.maxFails, 3, 50, c.maxFails), lockMinutes: n(b.lockMinutes, 1, 1440, c.lockMinutes) };
    await env.BRT_KV.put('cfg:auth', JSON.stringify(nc)); await logPut(env, who, [{ a: 'settings changed', d: 'session ' + nc.sessionHours + ' h · log kept ' + nc.logDays + ' days · lock after ' + nc.maxFails + ' wrong attempts for ' + nc.lockMinutes + ' min' }]); return JR(nc); }
  if (p === '/api/admin/log' && m === 'GET') { const lim = Math.max(1, Math.min(200, +url.searchParams.get('limit') || 100)), l = await env.BRT_KV.list({ prefix: 'log:', limit: lim, cursor: url.searchParams.get('cursor') || undefined }), rows = [];
    for (const k of l.keys) { const r = await env.BRT_KV.get(k.name, 'json'); if (r && r.ev) for (const e of r.ev) rows.push({ t: e.t, u: r.u, role: r.role, a: e.a, d: e.d }); }
    rows.sort((a, b) => b.t - a.t); return JR({ rows, cursor: l.list_complete ? null : l.cursor }); }
  return JR({ error: 'Unknown route.' }, 404);
}
/* Claude proxy: the Anthropic key is the Worker secret ANTHROPIC_API_KEY. Only reached after the password gate. */
const MAX_OUT = 8000;
export async function proxy(request, env, url, fetchFn) {
  if (url.pathname === '/api/claude-status') return Response.json({ proxy: !!env.ANTHROPIC_API_KEY }, { headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  if (!env.ANTHROPIC_API_KEY) return Response.json({ error: { message: 'No ANTHROPIC_API_KEY secret is set on the Worker.' } }, { status: 503 });
  let b; try { b = await request.json(); } catch (e) { return Response.json({ error: { message: 'Bad request body' } }, { status: 400 }); }
  if (!b || typeof b.model !== 'string' || !/^claude-[a-z0-9.-]+$/.test(b.model) || !Array.isArray(b.messages)) return Response.json({ error: { message: 'Only Claude models and a messages array are accepted.' } }, { status: 400 });
  const allow = env.AI_MODELS ? String(env.AI_MODELS).split(',').map(x => x.trim()) : null; if (allow && !allow.includes(b.model)) return Response.json({ error: { message: 'Model not allowed on this proxy: ' + b.model } }, { status: 403 });
  b.max_tokens = Math.min(+b.max_tokens || 2000, +env.AI_MAX_TOKENS || MAX_OUT); b.stream = false;
  const r = await (fetchFn || fetch)('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(b) });
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', 'Cache-Control': 'no-store' } });
}
/* Google Drive sign-in on the server: the OAuth client secret (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) and the long-lived refresh token (KV binding BRT_KV) never reach the browser.
   The browser only receives short-lived access tokens from /api/drive/token, after the password gate. */
const SCOPES = { 'drive.file': 'https://www.googleapis.com/auth/drive.file', 'drive': 'https://www.googleapis.com/auth/drive' };
const rnd = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const J = (o, st) => Response.json(o, { status: st || 200, headers: { 'Cache-Control': 'no-store' } });
export async function drive(request, env, url, fetchFn) {
  const f = fetchFn || fetch, ok = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.BRT_KV), p = url.pathname.replace('/api/drive/', '');
  if (p === 'status') { const r = ok ? await env.BRT_KV.get('drive:refresh', 'json') : null; return J({ configured: ok, connected: !!r, scope: r ? r.scope : '' }); }
  if (!ok) return J({ error: 'Google Drive is not set up on the Worker (secrets GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and KV binding BRT_KV).' }, 503);
  const redirect = url.origin + '/api/drive/callback';
  if (p === 'login') {
    const scope = url.searchParams.get('scope') === 'drive' ? 'drive' : 'drive.file', state = rnd(); await env.BRT_KV.put('state:' + state, scope, { expirationTtl: 600 });
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: SCOPES[scope], access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state });
    return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q, 302);
  }
  if (p === 'callback') {
    const state = url.searchParams.get('state') || '', code = url.searchParams.get('code'), scope = state ? await env.BRT_KV.get('state:' + state) : null;
    if (!scope || !code) return new Response('Google sign-in was cancelled or expired. Go back and press Connect again.', { status: 400 });
    await env.BRT_KV.delete('state:' + state);
    const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }) }), j = await r.json().catch(() => ({}));
    if (!j.refresh_token) return new Response('Google did not return a refresh token (' + (j.error_description || j.error || r.status) + '). Remove the app at myaccount.google.com/permissions and connect again.', { status: 502 });
    await env.BRT_KV.put('drive:refresh', JSON.stringify({ token: j.refresh_token, scope })); return Response.redirect(url.origin + '/?drive=connected', 302);
  }
  if (p === 'token') {
    const r0 = await env.BRT_KV.get('drive:refresh', 'json'); if (!r0) return J({ error: 'not_connected' }, 401);
    const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: r0.token, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }) }), j = await r.json().catch(() => ({}));
    if (j.error === 'invalid_grant') { await env.BRT_KV.delete('drive:refresh'); return J({ error: 'not_connected' }, 401); }
    if (!j.access_token) return J({ error: j.error_description || j.error || 'Google refused the token request' }, 502);
    return J({ access_token: j.access_token, expires_in: j.expires_in || 3600, scope: r0.scope });
  }
  if (p === 'disconnect' && request.method === 'POST') {
    const r0 = await env.BRT_KV.get('drive:refresh', 'json'); if (r0) { try { await f('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(r0.token), { method: 'POST' }); } catch (e) { } await env.BRT_KV.delete('drive:refresh'); }
    return J({ ok: true });
  }
  return J({ error: 'Unknown Drive route' }, 404);
}
export default {
  async fetch(request, env) {
    if (!env.BRT_PASSWORD) return new Response('Site is closed: no password has been set.', { status: 503 });
    const url = new URL(request.url), p = url.pathname;
    if (p.startsWith('/api/auth/') || p.startsWith('/api/admin/') || p === '/api/log') return auth(request, env, url);
    const who = await whoIs(request, env);
    if (!who) { if (p.startsWith('/api/') && p !== '/api/drive/callback') return JR({ error: 'Sign in first.' }, 401); return new Response(LOGIN_PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }); }
    if (p === '/api/claude' || p === '/api/claude-status') { if (who.role !== 'admin') return p === '/api/claude-status' ? JR({ proxy: false, adminOnly: true }) : JR({ error: { message: 'AI is for the admin only.' } }, 403);
      if (p === '/api/claude' && request.method === 'POST') await logPut(env, who, [{ a: 'AI request', d: '' }]); return proxy(request, env, url); }
    if (p.startsWith('/api/drive/')) { if (who.role !== 'admin') return p === '/api/drive/status' ? JR({ configured: false, connected: false, scope: '', adminOnly: true }) : JR({ error: 'Google Drive is for the admin only.' }, 403);
      if (p === '/api/drive/login' || p === '/api/drive/disconnect') await logPut(env, who, [{ a: p === '/api/drive/login' ? 'Drive connect' : 'Drive disconnect', d: '' }]); return drive(request, env, url); }
    const r = await env.ASSETS.fetch(request); if (p === '/' || p.endsWith('.html')) { const h = new Headers(r.headers); h.set('Cache-Control', 'no-store'); return new Response(r.body, { status: r.status, headers: h }); } return r;
  }
};
