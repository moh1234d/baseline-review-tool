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
export default {
  async fetch(request, env) {
    const denied = await check(request, env); if (denied) return denied;
    const url = new URL(request.url); if (url.pathname === '/api/claude' || url.pathname === '/api/claude-status') return proxy(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
