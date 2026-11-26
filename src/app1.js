/* ===== APP PART 1: helpers, state, storage, libraries, PDF, AI ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = x => (x == null || x === '' || isNaN(x)) ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 2 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

const S = { cfg: E.defaultCfg(), M: null, out: null, step: 'setup', files: {}, history: [], commentNo: {}, ui: { filter: 'fail' }, raw: {} };
S.cfg.eid = LS.get('brt.eid', []);
(function () { const a = LS.get('brt.ai', null); if (a) { S.cfg.ai.on = !!a.on; S.cfg.ai.cmp = a.cmp === true; S.cfg.ai.rp = a.rp === true; S.cfg.ai.proxy = a.proxy !== false; S.cfg.ai.remember = !!a.remember; S.cfg.ai.key = a.remember ? (a.key || '') : ''; S.cfg.ai.models = a.models || {}; S.cfg.ai.modelAll = /^claude-(haiku|sonnet|opus)-5-5$/.test(a.modelAll || '') ? a.modelAll : ''; S.cfg.ai.prices = a.prices; } })();

function toast(msg, kind) {
  let t = $('#toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 4200);
}
function download(blob, name) { if (typeof canDo === 'function' && AUTH.mode === 'online') { if (!canDo('export')) { brtLog('blocked', 'export ' + name); toast('Exporting is not enabled for your account. Ask the admin.', 'bad'); return; } brtLog('export', name); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- lazy libraries ---------- */
const LIBS = {
  xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => window.XLSX],
  exceljs: ['https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', () => window.ExcelJS],
  pdfjs: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => window.pdfjsLib],
  docx: ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', () => window.docx],
  tesseract: ['https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js', () => window.Tesseract],
  jszip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', () => window.JSZip]
};
const _lp = {};
async function libEmbedded(name) {
  const b64 = typeof LIBDATA !== 'undefined' && LIBDATA[name]; if (!b64 || !('DecompressionStream' in window)) return null;
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function lib(name) {
  const [url, get] = LIBS[name]; if (get()) return Promise.resolve(get());
  if (_lp[name]) return _lp[name];
  return _lp[name] = (async () => {
    try {
      const txt = await libEmbedded(name);
      if (txt) {
        if (name === 'pdfjs') { const w = await libEmbedded('pdfworker'); window.__pdfWorkerUrl = URL.createObjectURL(new Blob([w], { type: 'text/javascript' })); }
        const s = document.createElement('script'); s.textContent = txt; document.head.appendChild(s);
        if (name === 'pdfjs' && window.pdfjsLib && window.__pdfWorkerUrl) window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.__pdfWorkerUrl;
        if (get()) return get();
      }
    } catch (e) { console.warn('embedded library failed, using the internet copy', e); }
    return await new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => { if (name === 'pdfjs') window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(get()); }; s.onerror = () => { delete _lp[name]; rej(new Error('Could not load ' + name + '. The bundled copy failed and the internet copy is not reachable.')); }; document.head.appendChild(s); });
  })();
}

/* ---------- progress bar for long steps (the page keeps painting between stages) ---------- */
function progress(label, pct) {
  let el = document.getElementById('prog'); if (label == null) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'prog'; el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99;background:#16243a;color:#fff;border-radius:10px;padding:10px 16px;min-width:300px;box-shadow:0 6px 20px rgba(0,0,0,.3);font-size:13px'; el.innerHTML = '<div id="prog-l"></div><div style="height:6px;background:#33465f;border-radius:3px;margin-top:7px;overflow:hidden"><div id="prog-b" style="height:6px;background:#35b3ab;width:0;transition:width .15s"></div></div>'; document.body.appendChild(el); }
  document.getElementById('prog-l').textContent = label; document.getElementById('prog-b').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
}
async function xerStage(file) {
  const nm = file.name.length > 40 ? file.name.slice(0, 38) + '…' : file.name;
  try {
    progress('Reading ' + nm, 10); await new Promise(r => setTimeout(r, 0));
    const txt = new TextDecoder('windows-1252').decode(await readBuf(file));
    progress('Parsing the XER tables (' + (txt.length / 1048576).toFixed(1) + ' MB)', 35); await new Promise(r => setTimeout(r, 0));
    const T = E.parseXER(txt); if (!T.TASK || !T.PROJECT) throw new Error(file.name + ' does not look like a P6 XER file');
    progress('Building the schedule model (' + T.TASK.r.length.toLocaleString('en-US') + ' activities)', 65); await new Promise(r => setTimeout(r, 0));
    const M = E.buildModel(T); progress('Done', 100); setTimeout(() => progress(null), 250); return { T, M };
  } catch (e) { progress(null); throw e; }
}

/* ---------- files ---------- */
const readBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });
async function readSheetRows(file) { const X = await lib('xlsx'); const wb = X.read(await readBuf(file), { type: 'array', cellDates: true }); const sheets = {}; wb.SheetNames.forEach(n => sheets[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })); return sheets; }
async function pdfPages(file, onProgress, opts) {
  opts = opts || {}; const P = await lib('pdfjs'); const doc = await P.getDocument({ data: await readBuf(file) }).promise; const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i); const tc = await pg.getTextContent();
    let text = ''; let lastY = null; for (const it of tc.items) { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'; else if (text && !text.endsWith(' ')) text += ' '; text += it.str; lastY = y; }
    let ocr = false;
    if (text.trim().length < 30 && opts.ocr) { try { const T = await lib('tesseract'); const vp = pg.getViewport({ scale: 2 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; const r = await T.recognize(cv, 'eng'); text = r.data.text; ocr = true; } catch (e) { text = ''; } }
    pages.push({ n: i, text, ocr, scanned: text.trim().length < 30 }); if (onProgress) onProgress(i, doc.numPages);
  }
  return pages;
}
async function pdfPageImage(file, n, scale) { const P = await lib('pdfjs'); const doc = await P.getDocument({ data: await readBuf(file) }).promise; const pg = await doc.getPage(n || 1); const vp = pg.getViewport({ scale: scale || 1.6 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; return cv.toDataURL('image/jpeg', 0.85).split(',')[1]; }
async function docxText(file) { const Z = await lib('jszip'); const z = await Z.loadAsync(await readBuf(file)); const x = await z.file('word/document.xml').async('string'); return x.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }

/* ---------- AI ---------- */
const AI_TASKS = [
  { id: 'read_contract', label: 'Read contract documents', def: 'claude-haiku-5-5' },
  { id: 'read_boq', label: 'Read BOQ from PDF', def: 'claude-haiku-5-5' },
  { id: 'read_layout', label: 'Read general layout (zones & roads)', def: 'claude-haiku-5-5' },
  { id: 'suggest_approvals', label: 'Suggest approval activities', def: 'claude-haiku-5-5' },
  { id: 'narrative', label: 'Extract statements from narrative', def: 'claude-haiku-5-5' },
  { id: 'sequence', label: 'Propose work sequence per trade', def: 'claude-sonnet-5-5' },
  { id: 'critpath', label: 'Review critical / near-critical paths', def: 'claude-sonnet-5-5' },
  { id: 'draft', label: 'Draft contractor comment wording', def: 'claude-sonnet-5-5' },
  { id: 'ask', label: 'Ask Claude about a finding', def: 'claude-sonnet-5-5' },
  { id: 'cmp_review', label: 'Schedule comparison – review the findings', def: 'claude-sonnet-5-5' },
  { id: 'cmp_actions', label: 'Schedule comparison – corrective and mitigation actions', def: 'claude-sonnet-5-5' },
  { id: 'bb_boq', label: 'Baseline builder – BOQ sanity', def: 'claude-haiku-5-5' },
  { id: 'bb_class', label: 'Baseline builder – classification', def: 'claude-haiku-5-5' },
  { id: 'bb_split', label: 'Baseline builder – stage split', def: 'claude-sonnet-5-5' },
  { id: 'bb_logic', label: 'Baseline builder – logic', def: 'claude-sonnet-5-5' },
  { id: 'bb_prod', label: 'Baseline builder – productivity rates for gaps', def: 'claude-sonnet-5-5' },
  { id: 'bb_final', label: 'Baseline builder – final review', def: 'claude-sonnet-5-5' }
];
const MODEL_LIST = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-2'];
const PRICE_DEF = { haiku: [1, 5], sonnet: [3, 15], opus: [5, 25], fable: [5, 25] }; // USD per million tokens (in/out) – editable
function modelFor(task) { return (S.cfg.ai.models && S.cfg.ai.models[task]) || S.cfg.ai.modelAll || AI_TASKS.find(t => t.id === task).def; }
function priceFor(model) { const p = S.cfg.ai.prices || PRICE_DEF; const k = Object.keys(p).find(k => model.includes(k)); return p[k] || [3, 15]; }
function estimateCost(task, chars, outTokens) { const m = modelFor(task), p = priceFor(m); return ((chars / 4) * p[0] + (outTokens || 1500) * p[1]) / 1e6; }
function aiReady() { if (!S.cfg.ai.on) { toast('AI is switched off for this project (Setup → AI).', 'warn'); return false; } if (!aiViaProxy() && !S.cfg.ai.key) { toast('Enter your Claude API key in Setup → AI (or set up the server proxy).', 'warn'); return false; } if (!S.cfg.ai.consent) { toast('Tick the consent box in Setup → AI first: it states what is sent to Anthropic.', 'warn'); return false; } return true; }
/* server proxy: the key stays in the Worker; used when the site offers it and the switch in Setup is on */
const aiViaProxy = () => S.cfg.ai.proxy !== false && S.aiProxy === true;
(function () { try { if (/^https?:/.test(location.protocol)) fetch('/api/claude-status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { S.aiProxy = !!(j && j.proxy); }).catch(() => { }); } catch (e) { } })();
async function callClaude(task, system, content, maxTokens) {
  if (!aiReady()) throw new Error('AI not available');
  const body = { model: modelFor(task), max_tokens: maxTokens || 2000, system, messages: [{ role: 'user', content }] };
  const r = aiViaProxy() ? await fetch('/api/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) : await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.cfg.ai.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
  if (!r.ok) { let t = ''; try { t = (await r.json()).error.message; } catch (e) { } throw new Error('Claude API ' + r.status + ': ' + t); }
  const j = await r.json(); S.aiUsage = S.aiUsage || { in: 0, out: 0 }; S.aiUsage.in += j.usage.input_tokens; S.aiUsage.out += j.usage.output_tokens;
  return j.content.map(c => c.text || '').join('');
}
function parseJson(txt) { const m = /```(?:json)?\s*([\s\S]*?)```/.exec(txt); const s = m ? m[1] : txt; const a = s.indexOf('{'), b = s.lastIndexOf('}'); const a2 = s.indexOf('['), b2 = s.lastIndexOf(']'); try { if (a2 >= 0 && (a < 0 || a2 < a)) return JSON.parse(s.slice(a2, b2 + 1)); return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error('Claude did not return valid JSON'); } }
function saveAiSettings() { LS.set('brt.ai', { on: S.cfg.ai.on, cmp: S.cfg.ai.cmp === true, rp: S.cfg.ai.rp === true, proxy: S.cfg.ai.proxy !== false, remember: !!S.cfg.ai.remember, key: S.cfg.ai.remember ? S.cfg.ai.key : '', models: S.cfg.ai.models, modelAll: S.cfg.ai.modelAll || '', prices: S.cfg.ai.prices }); }

/* ---------- profile (settings & confirmations per project) ---------- */
function toProfile() {
  const c = S.cfg, M = S.M; const byPath = {};
  if (M && c.wbsMap) for (const [id, v] of Object.entries(c.wbsMap)) if (M.wbs[id]) byPath[M.wbs[id].path.join('/')] = v;
  const clone = JSON.parse(JSON.stringify(c)); delete clone.ai; delete clone.docs; delete clone.boq; delete clone.mapping; delete clone.wbsMap; delete clone.approvalIds; delete clone.rsrc; delete clone.projFinishId; delete clone.eid;
  return {
    tool: 'baseline-review-tool', version: 1, saved: new Date().toISOString(), cfg: clone,
    wbsMapByPath: byPath, approvalCodes: (c.approvalIds || []).map(i => M && M.byId[i] && M.byId[i].code).filter(Boolean),
    rsrcNames: { progress: c.rsrc.progress && M ? M.rsrc[c.rsrc.progress].name : null, cost: c.rsrc.cost && M ? M.rsrc[c.rsrc.cost].name : null },
    milestoneCodes: c.milestones.map(m => m.actId && M && M.byId[m.actId] ? M.byId[m.actId].code : null), finishCode: c.projFinishId && M && M.byId[c.projFinishId] ? M.byId[c.projFinishId].code : null,
    eid: c.eid, history: S.history, commentNo: S.commentNo, held: S.held
  };
}
function applyProfile(p) {
  if (!p || p.tool !== 'baseline-review-tool') throw new Error('Not a profile file from this tool');
  const keepAi = S.cfg.ai, keepDocs = S.cfg.docs, keepBoq = S.cfg.boq, keepMap = S.cfg.mapping;
  const base = E.defaultCfg(); S.cfg = Object.assign(base, p.cfg); S.cfg.ai = keepAi; S.cfg.docs = keepDocs; S.cfg.boq = keepBoq; S.cfg.mapping = keepMap;
  S.cfg.eid = mergeEid(S.cfg.eid, p.eid || []); LS.set('brt.eid', S.cfg.eid);
  S.history = p.history || []; S.commentNo = p.commentNo || {}; S.held = p.held || {}; S.pendingProfile = p;
  if (S.M) resolveProfile();
}
function mergeEid(a, b) { const m = new Map(); [...(a || []), ...(b || [])].forEach(e => m.set(e.year + '|' + e.type, e)); return [...m.values()]; }
function resolveProfile() {
  const p = S.pendingProfile, M = S.M; if (!p || !M) return; const c = S.cfg;
  const byPath = {}; Object.values(M.wbs).forEach(w => byPath[w.path.join('/')] = w.id);
  const wm = {}; let hit = 0; for (const [path, v] of Object.entries(p.wbsMapByPath || {})) if (byPath[path]) { wm[byPath[path]] = v; hit++; }
  if (hit) c.wbsMap = wm;
  const byCode = {}; M.tasks.forEach(t => byCode[t.code] = t.id);
  if (p.approvalCodes && p.approvalCodes.length) { c.approvalIds = p.approvalCodes.map(k => byCode[k]).filter(Boolean); if (!p.cfg || p.cfg.approvalExclude === undefined) { const keep = new Set(E.suggestApprovals(M, c.approvalExclude)); c.approvalIds = c.approvalIds.filter(id => keep.has(id)); } }
  if (c.approvalExclude === 'shop ?draw|material|submittal|sample|mock-?up|method statement') { c.approvalExclude = E.APPROVAL_EXCLUDE_DEFAULT; if (c.approvalIds && c.approvalIds.length) { const keep2 = new Set(E.suggestApprovals(M, c.approvalExclude)); c.approvalIds = c.approvalIds.filter(id => keep2.has(id)); } }
  const rn = {}; Object.values(M.rsrc).forEach(r => rn[r.name] = r.id);
  if (p.rsrcNames) { const ok = id => id && E.rsrcUse(M, id) > 0; const pg = rn[p.rsrcNames.progress], ct = rn[p.rsrcNames.cost]; c.rsrc = { progress: ok(pg) ? pg : c.rsrc.progress, cost: ok(ct) ? ct : c.rsrc.cost }; }
  (p.milestoneCodes || []).forEach((k, i) => { if (k && byCode[k] && c.milestones[i]) c.milestones[i].actId = byCode[k]; });
  if (p.finishCode && byCode[p.finishCode]) c.projFinishId = byCode[p.finishCode];
  S.pendingProfile = null;
}
let _saveT; function autosave() { clearTimeout(_saveT); _saveT = setTimeout(() => { if (S.cfg.projectName) LS.set('brt.profile.' + S.cfg.projectName, toProfile()); LS.set('brt.eid', S.cfg.eid); saveAiSettings(); if (typeof sessionSaveSoon === 'function') sessionSaveSoon(); }, 400); }
