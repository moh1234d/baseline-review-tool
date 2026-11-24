/* v9.36 regression test (UI): whatever the Recovery planner shows must come from the files loaded NOW.
   Loads an old baseline that lacks some activities, then replaces it (and later the update) and checks, in every view,
   that every path row, every box and every "Delaying now" note points at the current files — never at a replaced one. */
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('ui: skipped (playwright not installed)'); process.exit(0); }
const path = require('path'), fs = require('fs'), assert = require('assert');
const { project } = require('./fixtures');
const DIST = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(DIST)) { console.error('ui: build first (python3 build.py)'); process.exit(1); }
const file = (name, txt) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(txt, 'latin1') });
const OLD_BL = file('old-baseline.xer', project({ name: 'BL-OLD', dd: '2026-02-01', omit: ['A4', 'B3', 'C3'] }));
const BL = file('baseline.xer', project({ name: 'BL', dd: '2026-02-01' }));
const UPD1 = file('update-1.xer', project({ name: 'UPD1', dd: '2026-03-01', shift: 3, tf: -5 }));
const UPD2 = file('update-2.xer', project({ name: 'UPD2', dd: '2026-03-08', shift: 5, tf: -9 }));
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForTimeout(500);
  await p.evaluate(() => { S.cfg.rpPaths = 3; S.cfg.rpPrio = false; LS.set('brt.rpView', 'plots'); go('recovery'); });
  const ready = name => p.waitForFunction(n => { const R = S.rp; if (!R || !((R.A && R.A.name === n) || (R.B && R.B.name === n))) return false; if (!R.A || !R.B) return true; return R.tr && R.tr.train && !R.tr.levBusy && R.tr.lev; }, name, { timeout: 60000 });
  const load = async (side, f) => { await p.setInputFiles('#rp-' + side, { name: f.name, mimeType: f.mimeType, buffer: f.buffer }); await ready(f.name); await p.waitForTimeout(300); };
  let n = 0;
  /* the invariant, checked in each view */
  const check = async label => {
    for (const v of ['plots', 'net', 'p6', 'cards']) {
      const ok = await p.evaluate(v => { const b = document.querySelector(`[data-rpview="${v}"]`); if (!b) return false; b.click(); return true; }, v); if (!ok) continue;
      await p.waitForTimeout(250);
      const bad = await p.evaluate(() => {
        const R = S.rp, A = new Set(R.A.M.tasks), B = new Set(R.B.M.tasks), out = [];
        const inA = code => (R.A.M.byCode[code] || [])[0] || null;
        rpPathTrains(R).forEach(({ p, T }) => { if (!T) return; T.cars.forEach(c => c.rows.forEach(r => {
          if (r.t && !B.has(r.t)) out.push('path ' + p.rank + ': ' + r.t.code + ' is from a replaced update file');
          if (r.a && !A.has(r.a)) out.push('path ' + p.rank + ': ' + r.t.code + ' baseline is from a replaced baseline file');
          if (r.t && !r.a && inA(r.t.code)) out.push('path ' + p.rank + ': ' + r.t.code + ' is in the baseline file but shown without a baseline'); })); });
        if (R.tr && R.tr.train) R.tr.train.cars.forEach(c => c.rows.forEach(r => { if (r.t && !B.has(r.t)) out.push('selected path: ' + r.t.code + ' stale'); }));
        document.querySelectorAll('[data-rpdn]').forEach(e => { const i = RPDN[e.dataset.rpdn]; if (!i) { out.push('note ' + e.dataset.rpdn + ' missing'); return; }
          if (i.t && !B.has(i.t)) out.push('note ' + i.code + ': activity from a replaced update file');
          const a = inA(i.code); if (a && i.bf !== a.ef) out.push('note ' + i.code + ': baseline finish ' + i.bf + ' but the baseline file says ' + a.ef);
          if (!a && i.bf != null) out.push('note ' + i.code + ': shows a baseline the file does not have');
          const tip = rpDnTip(i, 1); if (!a && /on time/.test(tip)) out.push('note ' + i.code + ': "on time" without a baseline'); });
        return out; });
      assert.deepStrictEqual(bad, [], label + ' / ' + v + ':\n  ' + bad.join('\n  ')); n++;
    }
  };
  const paths = () => p.evaluate(() => rpPathTrains(S.rp).filter(x => x.T).length);
  await load('A', OLD_BL); await load('B', UPD1);
  assert.ok(await paths() >= 2, 'fixture should give at least two paths'); n++;
  await check('old baseline + update 1');
  await load('A', BL); await check('baseline replaced');
  await load('B', UPD2); await check('update replaced');
  await load('A', OLD_BL); await check('baseline replaced back');
  /* a missing baseline is never "on time" */
  const tip = await p.evaluate(() => rpDnTip({ t: null, code: 'X1', name: 'x', st: 'Not started', ef: 20000, bf: null, late: null, held: [], flow: [] }, 2));
  assert.ok(/not in baseline file/.test(tip) && !/on time/.test(tip), 'no baseline -> "not in baseline file"'); n++;
  assert.deepStrictEqual(errs, [], 'page errors: ' + errs.join(' | ')); n++;
  await b.close(); console.log('ui: ' + n + ' recovery-planner file checks passed');
})().catch(e => { console.error(e.message || e); process.exit(1); });
