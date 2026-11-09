/* ===== APP PART 7: full project bundle (export / import) ===== */
S.orig = { xer: null, boq: null, slots: {} };
document.addEventListener('change', e => { // capture the original files as they are chosen
  const el = e.target; if (el.type !== 'file' || !el.files || !el.files.length) return; const id = el.id || '';
  if (id === 'f-xer') S.orig.xer = el.files[0]; else if (id === 'f-boq') S.orig.boq = el.files[0];
  else if (id.startsWith('f-') && typeof DOC_SLOTS !== 'undefined' && DOC_SLOTS.some(s => s.k === id.slice(2))) S.orig.slots[id.slice(2)] = el.files[0];
}, true);
const b64 = async f => { const u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { name: f.name, type: f.type, b64: btoa(s) }; };
const unb64 = o => { const s = atob(o.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new File([u], o.name, { type: o.type || '' }); };
async function gzipStr(str) { if (!('CompressionStream' in window)) return new Blob([str]); return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
async function readBundle(file) { const u = new Uint8Array(await file.slice(0, 2).arrayBuffer()); let txt; if (u[0] === 0x1f && u[1] === 0x8b) { if (!('DecompressionStream' in window)) throw new Error('This browser cannot open compressed project files. Use a current Chrome or Edge.'); txt = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text(); } else txt = await file.text(); return JSON.parse(txt); }
function exportDialog() {
  return new Promise(res => {
    const o = Object.assign({ key: false, xer: true, docs: true, contract: true }, LS.get('brt.exportOpts', {}));
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,35,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    const row = (k, t, hint) => `<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;cursor:pointer"><input type="checkbox" data-k="${k}" ${o[k] ? 'checked' : ''} style="margin-top:4px"><span><b>${t}</b><br><small style="color:#5b6b7b">${hint}</small></span></label>`;
    d.innerHTML = `<div style="background:#fff;color:#1b2a41;border-radius:14px;max-width:480px;width:100%;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35);font:15px/1.45 'Segoe UI',system-ui,sans-serif"><h2 style="margin:0 0 4px;font-size:19px">Export project – what to include</h2><p style="margin:0 0 6px;color:#5b6b7b;font-size:13.5px">Settings, confirmations, approvals, sequences, held-back comments and review history are always included.</p>
    ${row('key', 'Claude API key', 'Leave unticked to share the file safely. On import the key already saved in that browser is kept.')}${row('xer', 'The XER schedule file', 'Needed to restore the programme without uploading it again.')}${row('docs', 'BOQ and submitted documents', 'S-curve, cash flow, histogram, mapping, resource calc, narrative, layout.')}${row('contract', 'Contract text', 'The text read from the contract PDFs (not the PDFs themselves).')}
    <div id="xw" style="display:none;background:#fdecea;color:#7a2a1e;border-radius:8px;padding:8px 10px;font-size:13px;margin-top:6px"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button data-a="no" style="all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid #d5dce3">Cancel</button><button data-a="go" style="all:unset;cursor:pointer;padding:8px 16px;border-radius:8px;background:#0b7a75;color:#fff;font-weight:600">Export</button></div></div>`;
    const warn = () => { const k = d.querySelector('[data-k=key]').checked, x = d.querySelector('[data-k=xer]').checked, dc = d.querySelector('[data-k=docs]').checked, c = d.querySelector('[data-k=contract]').checked; const w = d.querySelector('#xw'); const m = []; if (k) m.push('The file will contain your API key – keep it private.'); if (x || dc || c) m.push('The file will contain project documents – do not share it outside the project team.'); w.style.display = m.length ? 'block' : 'none'; w.textContent = m.join(' '); };
    d.addEventListener('change', warn); d.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'go') { const r = {}; d.querySelectorAll('[data-k]').forEach(c => r[c.dataset.k] = c.checked); LS.set('brt.exportOpts', r); d.remove(); res(r); } else { d.remove(); res(null); } });
    document.body.appendChild(d); warn();
  });
}
async function exportBundle() {
  const o = await exportDialog(); if (!o) return;
  const b = { tool: 'baseline-review-tool-bundle', version: 3, saved: new Date().toISOString(), contents: o, profile: toProfile(), ai: { on: S.cfg.ai.on, key: o.key ? S.cfg.ai.key : null, models: S.cfg.ai.models, prices: S.cfg.ai.prices }, edits: S.edits, cpAi: S.cpAi || null, files: { xer: null, boq: null, slots: {} } };
  if (o.docs) { b.docs = S.cfg.docs; b.boq = S.cfg.boq; b.mapping = S.cfg.mapping; }
  if (o.contract) { b.contractFound = S.contractFound || null; b.contractPages = S.raw.contract || []; b.contractLabel = S.files.contract || null; }
  if (o.xer && S.orig.xer) b.files.xer = await b64(S.orig.xer);
  if (o.docs) { if (S.orig.boq) b.files.boq = await b64(S.orig.boq); for (const [k, f] of Object.entries(S.orig.slots)) b.files.slots[k] = await b64(f); }
  const blob = await gzipStr(JSON.stringify(b)); download(blob, (S.cfg.projectName || 'Project') + '_project.brt');
  toast('Project exported (' + (blob.size / 1048576).toFixed(1) + ' MB)' + (o.key ? ' – contains your API key, keep it private.' : '.'), 'ok');
}
async function importBundle(file) {
  try {
    const b = await readBundle(file); if (!b || b.tool !== 'baseline-review-tool-bundle') throw new Error('This is not a full project file from this tool.');
    toast('Restoring project…', 'ok'); go('files');
    S.cfg.ai = Object.assign(S.cfg.ai || {}, { on: b.ai.on, models: b.ai.models || {}, prices: b.ai.prices }); if (b.ai.key) S.cfg.ai.key = b.ai.key; saveAiSettings();
    S.M = null; S.out = null; S.files = {}; S.raw = {}; S.orig = { xer: null, boq: null, slots: {} }; S.cpAi = b.cpAi || null; S.contractFound = b.contractFound || null; S.seqProposal = null;
    applyProfile(b.profile);
    if (b.files.xer) { const f = unb64(b.files.xer); S.orig.xer = f; await loadXER(f); }
    if (b.files.boq) { const f = unb64(b.files.boq); S.orig.boq = f; await loadBoq(f); }
    for (const [k, o] of Object.entries(b.files.slots || {})) { const f = unb64(o); S.orig.slots[k] = f; await loadSlot(k, f); }
    if (b.contractPages) { S.raw.contract = b.contractPages; if (b.contractLabel) S.files.contract = b.contractLabel; }
    if (b.docs) S.cfg.docs = b.docs; if (b.boq) S.cfg.boq = b.boq; if (b.mapping) S.cfg.mapping = b.mapping; S.edits = b.edits || {}; S.held = (b.profile && b.profile.held) || {};
    autosave();
    if (S.M) { go('run'); await runAll(); toast('Project restored – checks re-run', 'ok'); } else { go('files'); toast('Settings and confirmations restored. This file has no XER – load it in Files.', 'ok'); }
  } catch (e) { console.error(e); toast(e.message, 'bad'); }
}
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && (b.id === 'nav-export' || b.id === 'x-bundle')) exportBundle(); });
document.addEventListener('change', e => { const el = e.target; if ((el.id === 'nav-import' || el.id === 'f-bundle') && el.files.length) { importBundle(el.files[0]); el.value = ''; } });
