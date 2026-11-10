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
export default {
  async fetch(request, env) {
    const denied = await check(request, env); if (denied) return denied;
    return env.ASSETS.fetch(request);
  }
};
