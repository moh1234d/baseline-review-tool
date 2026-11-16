// Password gate for the Baseline Review Tool.
// The password is the Worker secret BRT_PASSWORD (set in Cloudflare, never in this repository).
// Any user name is accepted; only the password is checked. If the secret is missing the site stays closed.
const enc = new TextEncoder();
async function same(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y); let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i]; return d === 0;
}
export async function check(request, env) {
  if (!env.BRT_PASSWORD) return new Response('Site is closed: no password has been set.', { status: 503 });
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Basic ')) {
    try { const raw = atob(h.slice(6)), i = raw.indexOf(':'); if (i >= 0 && await same(raw.slice(i + 1), String(env.BRT_PASSWORD))) return null; } catch (e) { }
  }
  return new Response('Password required.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Baseline Review Tool", charset="UTF-8"', 'Cache-Control': 'no-store' } });
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
    const denied = await check(request, env); if (denied) return denied;
    const url = new URL(request.url); if (url.pathname === '/api/claude' || url.pathname === '/api/claude-status') return proxy(request, env, url);
    if (url.pathname.startsWith('/api/drive/')) return drive(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
