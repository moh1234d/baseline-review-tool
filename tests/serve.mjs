// Local stand-in for Cloudflare: runs worker/index.js with an in-memory KV and serves dist/index.html. For tests and local checks only.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import w from '../worker/index.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
export function serve(opts = {}) {
  const m = new Map(), kv = { m, get: async (k, t) => { const v = m.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
    list: async o => ({ keys: [...m.keys()].filter(k => k.startsWith(o.prefix || '')).sort().slice(0, o.limit || 1000).map(name => ({ name })), list_complete: true }) };
  const page = () => fs.readFileSync(path.join(dir, '..', 'dist', 'index.html'));
  const env = { BRT_PASSWORD: opts.password || 'test-admin-pass', BRT_KV: kv, ASSETS: { fetch: async () => new Response(page(), { headers: { 'content-type': 'text/html; charset=utf-8' } }) } };
  const srv = http.createServer(async (q, s) => { const chunks = []; for await (const c of q) chunks.push(c); const body = Buffer.concat(chunks);
    const r = await w.fetch(new Request('http://' + q.headers.host + q.url, { method: q.method, headers: q.headers, body: ['GET', 'HEAD'].includes(q.method) ? undefined : body }), env);
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); s.writeHead(r.status, h); s.end(Buffer.from(await r.arrayBuffer())); });
  return new Promise(res => srv.listen(opts.port || 0, '127.0.0.1', () => res({ srv, kv, url: 'http://127.0.0.1:' + srv.address().port })));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) serve({ port: +process.argv[2] || 8787 }).then(x => console.log('running at ' + x.url + '  (admin / test-admin-pass)'));
