/* v9.43 (UI): admin creates a user with limited permissions; the user sees and can do only that; the log records it. */
import assert from 'assert'; import { createRequire } from 'module'; import { serve } from './serve.mjs';
const require = createRequire(import.meta.url); let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('users ui: skipped (playwright not installed)'); process.exit(0); }
const { project } = require('./fixtures.js');
const { srv, url } = await serve(); const b = await chromium.launch(); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }, eq = (a, x, m) => { assert.deepStrictEqual(a, x, m); n++; };
try {
  const errs = [], mk = async () => { const c = await b.newContext({ viewport: { width: 1400, height: 900 } }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const signIn = async (p, u, pw) => { await p.goto(url); await p.fill('#u', u); await p.fill('#p', pw); await p.click('#b'); };
  const nav = p => p.evaluate(() => [...document.querySelectorAll('#steps [data-go]')].map(x => x.dataset.go));
  /* admin */
  const a = await mk(); await a.goto(url); ok(await a.$('#f') && !(await a.$('#steps')), 'visitor gets the sign-in page only');
  await signIn(a, 'admin', 'wrong-pass'); await a.waitForFunction(() => document.getElementById('m').textContent); ok(/Wrong/.test(await a.textContent('#m')), 'wrong password is refused with a message');
  await signIn(a, 'admin', 'test-admin-pass'); await a.waitForSelector('#steps [data-go="admin"]'); ok((await nav(a)).includes('recovery') && (await nav(a)).includes('setup'), 'admin sees every section and Administration');
  await a.click('[data-go="admin"]'); await a.waitForSelector('[data-admnew]'); await a.click('[data-admnew]');
  await a.fill('#adm-name', 'sara.m'); await a.fill('#adm-full', 'Sara M'); await a.fill('#adm-pw', 'short'); await a.click('[data-admsave]'); await a.waitForFunction(() => /8 characters/.test((document.querySelector('.adm-ed .adm-err') || {}).textContent || '')); n++;
  await a.fill('#adm-pw', 'sara-pass-123'); await a.check('[data-admsec="recovery"]'); await a.check('[data-admsec="quick"]'); await a.uncheck('[data-admfn="export"]'); await a.click('[data-admsave]');
  await a.waitForFunction(() => [...document.querySelectorAll('.adm-t td b')].some(x => x.textContent === 'sara.m')); n++;
  /* user */
  const u = await mk(); await signIn(u, 'sara.m', 'sara-pass-123'); await u.waitForSelector('#steps [data-go="recovery"]');
  eq((await nav(u)).sort(), ['home', 'quick', 'recovery'], 'user menu shows only the sections given');
  ok(await u.evaluate(() => document.getElementById('tb-ai').style.display === 'none'), 'AI switch hidden for a user');
  await u.evaluate(() => go('compare')); eq(await u.evaluate(() => S.step), 'home', 'a section not given cannot be opened'); await u.evaluate(() => go('setup')); eq(await u.evaluate(() => S.step), 'home', 'Setup cannot be opened without Full review');
  eq(await u.evaluate(async () => (await fetch('/api/admin/users')).status), 403, 'user cannot call admin routes'); eq(await u.evaluate(async () => (await fetch('/api/claude', { method: 'POST', body: '{}' })).status), 403, 'user cannot call AI');
  await u.evaluate(() => go('recovery')); await u.setInputFiles('#rp-A', { name: 'bl.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(project({ name: 'BL', dd: '2026-02-01' }), 'latin1') }); await u.waitForFunction(() => S.rp && S.rp.A, null, { timeout: 30000 }); n++;
  ok(await u.evaluate(() => { let made = false; const o = document.createElement; document.createElement = function (t) { if (t === 'a') made = true; return o.call(document, t); }; download(new Blob(['x']), 'x.txt'); document.createElement = o; return !made; }), 'export is blocked when not given');
  await u.evaluate(() => brtLogFlush()); await u.waitForTimeout(400);
  /* admin: log, then remove the upload right and disable */
  await a.click('[data-admrefresh]'); await a.waitForFunction(() => /load file/.test(document.querySelector('#main').innerText) && /bl\.xer/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
  const log = await a.evaluate(() => ADM.log.map(r => r.u + '|' + r.a)); ok(log.includes('sara.m|sign-in') && log.includes('sara.m|open section') && log.includes('admin|user added') && log.some(x => x.endsWith('|sign-in failed')), 'log shows user actions, admin changes and the wrong password');
  await a.click('[data-admedit="sara.m"]'); await a.uncheck('[data-admfn="upload"]'); await a.click('[data-admsave]'); await a.waitForFunction(() => !document.querySelector('.adm-ed'));
  await u.reload(); await u.waitForSelector('#steps [data-go="recovery"]'); await u.evaluate(() => go('recovery')); await u.setInputFiles('#rp-B', { name: 'up.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(project({ name: 'UPD', dd: '2026-03-01' }), 'latin1') }); await u.waitForTimeout(800);
  ok(await u.evaluate(() => !(S.rp && S.rp.B)), 'loading files is blocked once the admin removes it');
  await a.click('[data-admtoggle="sara.m"]'); await a.waitForFunction(() => !!document.querySelector('.adm-pill.off'));
  await u.reload(); await u.waitForSelector('#f'); ok(!(await u.$('#steps')), 'disabled user is back at the sign-in page');
  await a.click('#tb-user'); await a.waitForSelector('#f'); n++;
  eq(errs, [], 'page errors: ' + errs.join(' | '));
  console.log('users ui: ' + n + ' sign-in / permission checks passed');
} finally { await b.close(); srv.close(); }
