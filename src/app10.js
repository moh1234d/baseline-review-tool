/* ===== APP PART 10: delay analysis (Option A: baseline vs update, Option B: windows) ===== */
S.dl = { base: null, ups: [], mode: 'A', target: '', n: 3, min: 3, upSel: '', res: null, tags: {}, open: {}, busy: false };
const DL_PARTY = ['Unassigned', 'Contractor', 'Employer', 'Neutral'];
const DL_PCOL = { Unassigned: '#9aa5b1', Contractor: '#c0392b', Employer: '#2b6cb0', Neutral: '#2e8b57' };
const dsg = n => (n > 0 ? '+' : '') + n;
const dsh = d => { if (d == null) return '–'; const x = new Date(d * 86400000); return String(x.getUTCDate()).padStart(2, '0') + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()] + ' ' + String(x.getUTCFullYear()).slice(2); };
const dtr = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

async function loadDl(kind, files) {
  for (const file of files) {
    toast('Reading ' + file.name + '…'); await sleep(30);
    try {
      const __x = await xerStage(file); const T = __x.T;
      if (!T.TASK || !T.PROJECT) throw new Error(file.name + ' does not look like a P6 XER file');
      const o = { M: __x.M, name: file.name, file };
      if (kind === 'base') S.dl.base = o; else { S.dl.ups = S.dl.ups.filter(u => u.name !== o.name); S.dl.ups.push(o); }
      toast(file.name + ': ' + o.M.tasks.length + ' activities', 'ok');
    } catch (e) { console.error(e); toast(e.message, 'bad'); }
  }
  S.dl.ups.sort((a, b) => (a.M.dataDate || 0) - (b.M.dataDate || 0)); runDl();
}
function dlModels() { return S.dl.base ? [S.dl.base, ...S.dl.ups] : S.dl.ups.slice(); }
function runDl() {
  S.dl.res = null; const all = dlModels(), last = all[all.length - 1];
  if (last && !S.dl.target) { const t = E.dlTargets(last.M)[0]; if (t) S.dl.target = t.code; }
  try {
    if (S.dl.mode === 'A' && S.dl.base && S.dl.ups.length) { const u = S.dl.ups.find(x => x.name === S.dl.upSel) || S.dl.ups[S.dl.ups.length - 1]; S.dl.upUsed = u; S.dl.res = E.delayA(S.dl.base.M, u.M, { targetCode: S.dl.target, n: S.dl.n, min: S.dl.min, nameE: S.dl.base.name, nameL: u.name }); }
    else if (S.dl.mode === 'B' && S.dl.base && S.dl.ups.length) S.dl.res = E.delayB(all.map(x => ({ M: x.M, name: x.name })), { targetCode: S.dl.target, n: S.dl.n, min: S.dl.min });
  } catch (e) { console.error(e); toast('Delay analysis failed: ' + e.message, 'bad'); }
  if (S.step === 'delay') viewDelay();
}

/* ---------- pictures ---------- */
function dlDiagram(p, kind) {
  const rows = p.rows; const keys = rows.map((r, i) => i === 0 || i === rows.length - 1 || (r.cause && Math.abs(r.own) >= 1) || r.flags.some(f => /constraint|should have|new link|removed|started/i.test(f)));
  const nodes = []; let gap = null;
  rows.forEach((r, i) => { if (keys[i]) { if (gap) { nodes.push(gap); gap = null; } nodes.push({ r }); } else { gap = gap || { gap: 0, carry: r.carry }; gap.gap++; gap.carry = r.carry; } });
  const W = 168, H = 98, G = 38, PER = 5, VW = PER * W + (PER - 1) * G + 20; const nr = Math.ceil(nodes.length / PER); const VH = nr * (H + 44) + 8;
  let s = `<svg viewBox="0 0 ${VW} ${VH}" style="width:100%;min-width:640px;height:auto;display:block;font-family:inherit"><defs><marker id="ar${p.rank}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7b8794"/></marker></defs>`;
  const pos = nodes.map((n, i) => ({ x: 10 + (i % PER) * (W + G), y: 6 + Math.floor(i / PER) * (H + 44) }));
  nodes.forEach((n, i) => {
    if (i === 0) return; const a = pos[i - 1], b = pos[i]; const aw = nodes[i - 1].gap ? 118 : W, bw = n.gap ? 118 : W;
    if (a.y === b.y) s += `<line x1="${a.x + aw}" y1="${a.y + H / 2}" x2="${b.x - 1}" y2="${b.y + H / 2}" stroke="#7b8794" stroke-width="1.6" marker-end="url(#ar${p.rank})"/>`;
    else s += `<path d="M${a.x + aw / 2} ${a.y + H} V${a.y + H + 20} H${b.x + bw / 2} V${b.y - 2}" fill="none" stroke="#7b8794" stroke-width="1.6" marker-end="url(#ar${p.rank})"/>`;
  });
  nodes.forEach((n, i) => {
    const { x, y } = pos[i];
    if (n.gap) { s += `<rect x="${x}" y="${y + 18}" width="118" height="${H - 36}" rx="10" fill="none" stroke="#9aa5b1" stroke-dasharray="5 4"/><text x="${x + 59}" y="${y + H / 2 - 4}" text-anchor="middle" font-size="11" fill="#5b6b7b">${n.gap} activit${n.gap === 1 ? 'y' : 'ies'}</text><text x="${x + 59}" y="${y + H / 2 + 12}" text-anchor="middle" font-size="11" fill="#5b6b7b">${dsg(n.carry || 0)} d carried</text>`; return; }
    const r = n.r, ev = r.cause && Math.abs(r.own) >= 1; const col = ev && r.own >= 1 ? ['#fde8e8', '#c0392b', 2.4] : ev ? ['#e8f6ee', '#2e8b57', 2.4] : (r.dF || 0) >= 1 ? ['#fff4e5', '#e08a1e', 1.4] : ['#eef6f1', '#7fb99a', 1.2];
    const dates = r.sE != null ? [dsh(r.sE) + ' → ' + dsh(r.fE), dsh(r.sL) + ' → ' + dsh(r.fL)] : [r.t.es != null ? dsh(r.t.es) + ' → ' + dsh(r.t.ef) : '', r.noMatch ? (r.noMatch === 'new' ? 'not in earlier file' : 'not in later file') : ''];
    s += `<g><title>${esc(r.code + ' – ' + r.name + (r.flags.length ? '\n' + r.flags.join('\n') : ''))}</title><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="9" fill="${col[0]}" stroke="${col[1]}" stroke-width="${col[2]}"/>
    <text x="${x + 8}" y="${y + 15}" font-size="10.5" font-weight="700" fill="#1b2a41">${esc(dtr(r.code, 26))}</text>
    <text x="${x + 8}" y="${y + 30}" font-size="10.5" fill="#334155">${esc(dtr(r.name, 30))}</text>
    <text x="${x + 8}" y="${y + 47}" font-size="9.5" fill="#6b7785">${kind === 'B' ? 'Before' : 'Earlier'}: ${esc(dates[0])}</text>
    <text x="${x + 8}" y="${y + 60}" font-size="9.5" fill="#1b2a41">${kind === 'B' ? 'After' : 'Current'}: ${esc(dates[1])}</text>
    <text x="${x + 8}" y="${y + 80}" font-size="12" font-weight="700" fill="${ev && r.own >= 1 ? '#c0392b' : (r.dF || 0) >= 1 ? '#c26a00' : '#2e8b57'}">${r.dF == null ? '' : 'Finish ' + dsg(r.dF) + ' d'}</text>
    ${r.status === 'TK_Complete' ? `<text x="${x + W - 8}" y="${y + 15}" text-anchor="end" font-size="10" fill="#2e8b57">✓ done</text>` : r.status === 'TK_Active' ? `<text x="${x + W - 8}" y="${y + 15}" text-anchor="end" font-size="10" fill="#2b6cb0">in progress</text>` : ''}
    ${ev ? `<text x="${x + W - 8}" y="${y + 80}" text-anchor="end" font-size="11" font-weight="700" fill="${r.own >= 1 ? '#c0392b' : '#2e8b57'}">${r.own >= 1 ? '⚑ ' : ''}${dsg(r.own)} d here</text>` : ''}</g>`;
  });
  return s + '</svg>';
}
function dlWaterfall(res, p) {
  const ev = p.events; const items = [{ l: 'Earlier finish', sub: E.fmtDate(res.target.fE), v: 0, cum: 0, kind: 'tot' }]; let cum = 0;
  ev.forEach(e => { items.push({ l: e.code + ' – ' + e.name, sub: e.cause, v: e.own, cum, kind: e.own >= 0 ? 'up' : 'dn' }); cum += e.own; });
  const resid = p.total - cum; if (Math.abs(resid) >= 1) { items.push({ l: 'Small movements (below the threshold)', sub: '', v: resid, cum, kind: resid >= 0 ? 'up' : 'dn' }); cum += resid; }
  items.push({ l: 'Current finish', sub: E.fmtDate(res.target.fL), v: cum, cum: 0, kind: 'tot' });
  const mx = Math.max(1, ...items.map(i => Math.max(Math.abs(i.cum), Math.abs(i.cum + i.v)))), L = 330, R = 170, BW = 360, RH = 28, VW = L + BW + R, VH = items.length * RH + 14;
  const X = d => L + (d / mx) * BW * 0.92; let s = `<svg viewBox="0 0 ${VW} ${VH}" style="width:100%;min-width:640px;height:auto;display:block;font-family:inherit"><line x1="${X(0)}" y1="2" x2="${X(0)}" y2="${VH - 8}" stroke="#cbd5e1"/>`;
  items.forEach((it, i) => {
    const y = 6 + i * RH, a = it.kind === 'tot' ? 0 : it.cum, b = it.kind === 'tot' ? it.v : it.cum + it.v, x1 = X(Math.min(a, b)), x2 = X(Math.max(a, b)), col = it.kind === 'tot' ? '#1b2a41' : it.kind === 'up' ? '#c0392b' : '#2e8b57';
    s += `<text x="${L - 8}" y="${y + 15}" text-anchor="end" font-size="11" fill="#334155">${esc(dtr(it.l, 46))}</text><rect x="${x1}" y="${y + 3}" width="${Math.max(3, x2 - x1)}" height="${RH - 9}" rx="3" fill="${col}"/>`;
    s += `<text x="${Math.max(x2, x1) + 7}" y="${y + 15}" font-size="11" font-weight="700" fill="${col}">${it.kind === 'tot' ? (i === 0 ? '' : dsg(it.v) + ' d') : dsg(it.v) + ' d'}${it.sub ? ' <tspan font-weight="400" fill="#6b7785">' + esc(dtr(it.sub, 24)) + '</tspan>' : ''}</text>`;
    if (i > 0 && i < items.length - 1) s += '';
  });
  return s + '</svg>';
}
function dlBarsByWindow(res) {
  const w = res.windows, mx = Math.max(1, ...w.map(x => Math.abs(x.target.slip))), BW = 70, G = 28, VW = Math.max(520, w.length * (BW + G) + 60), VH = 200, base = 128;
  let s = `<svg viewBox="0 0 ${VW} ${VH}" style="width:100%;min-width:${Math.min(VW, 520)}px;height:auto;display:block;font-family:inherit"><line x1="30" y1="${base}" x2="${VW - 10}" y2="${base}" stroke="#cbd5e1"/>`;
  w.forEach((x, i) => { const h = Math.abs(x.target.slip) / mx * 90, up = x.target.slip >= 0, X = 40 + i * (BW + G); s += `<rect x="${X}" y="${up ? base - h : base}" width="${BW}" height="${Math.max(2, h)}" rx="3" fill="${up ? '#c0392b' : '#2e8b57'}"/><text x="${X + BW / 2}" y="${up ? base - h - 6 : base + h + 14}" text-anchor="middle" font-size="12" font-weight="700" fill="${up ? '#c0392b' : '#2e8b57'}">${dsg(x.target.slip)} d</text><text x="${X + BW / 2}" y="${base + (up ? 18 : 32)}" text-anchor="middle" font-size="10.5" fill="#334155" ${!up ? 'transform="translate(0,12)"' : ''}>Window ${x.idx}</text><text x="${X + BW / 2}" y="${base + 46}" text-anchor="middle" font-size="9.5" fill="#6b7785">${esc(dsh(x.ddL))}</text>`; });
  return s + '</svg>';
}

/* ---------- tags / party ---------- */
const dlKey = (win, code) => (win ? 'W' + win + ':' : 'A:') + code;
const dlParty = k => (S.dl.tags[k] && S.dl.tags[k].party) || 'Unassigned';
function dlEventRows(res) {
  const out = [];
  if (res.mode === 'A') res.paths.forEach(p => p.events.forEach(e => out.push({ win: 0, path: p.rank, key: dlKey(0, e.code) + (p.rank > 1 ? '#' + p.rank : ''), e })));
  else res.windows.forEach(w => w.paths.forEach(p => p.events.forEach(e => out.push({ win: w.idx, path: p.rank, key: dlKey(w.idx, e.code) + (p.rank > 1 ? '#' + p.rank : ''), e }))));
  return out;
}
function dlTagCell(key) { const t = S.dl.tags[key] || {}; return `<select class="dsel" data-dtag="${esc(key)}">${DL_PARTY.map(p => `<option ${p === (t.party || 'Unassigned') ? 'selected' : ''}>${p}</option>`).join('')}</select>`; }
function dlNoteCell(key) { const t = S.dl.tags[key] || {}; return `<input class="dnote" data-dnote="${esc(key)}" value="${esc(t.note || '')}" placeholder="Evidence / reason (optional)">`; }
function dlSplit(rows) {
  const byC = {}, byP = {}; let pos = 0;
  rows.filter(x => x.path === 1 && x.e.own > 0).forEach(x => { byC[x.e.cause] = (byC[x.e.cause] || 0) + x.e.own; const p = dlParty(x.key); byP[p] = (byP[p] || 0) + x.e.own; pos += x.e.own; });
  return { byC, byP, pos };
}
const dlBars = (obj, colors, total) => { const k = Object.keys(obj).sort((a, b) => obj[b] - obj[a]); if (!k.length) return '<p class="none">No delay events on the driving path.</p>'; const pc = dlPct(obj, total); return k.map(n => `<div class="crow" style="display:flex;align-items:center;gap:10px;margin:7px 0;font-size:13px"><span style="width:170px">${esc(n)}</span><div style="flex:1;height:14px;background:rgba(120,130,145,.18);border-radius:7px;overflow:hidden"><div style="height:100%;width:${Math.max(3, obj[n] / total * 100)}%;background:${colors[n] || '#4a6fa5'}"></div></div><b style="width:96px;text-align:right">${dsg(Math.round(obj[n] * 10) / 10)} d · ${pc[n]}%</b></div>`).join(''); };
const DL_CCOL = { 'Late start / waiting': '#e08a1e', 'Duration growth': '#c0392b', 'Logic change': '#7b4fa5' };

/* ---------- screens ---------- */
function dlIntegrityHtml(list) {
  return list.map(g => `<div class="card" style="margin:0 0 12px"><h3 class="bt" style="margin-top:0">${esc(g.label)} ${g.sev === 'ok' ? qchip('No problems found', 'ok') : g.sev === 'bad' ? qchip('Results may be unreliable', 'bad') : qchip('Warnings', 'warn')} <small>${fmtN(g.tasks)} activities · ${fmtN(g.critical)} with float ≤ 0</small></h3>${g.issues.length ? '<ul class="dli">' + g.issues.map(i => `<li class="${i.sev}"><b>${fmtN(i.n)}</b> ${esc(i.title)}${i.ex && i.ex.length ? ` <small>e.g. ${esc(i.ex.join(', '))}</small>` : ''}</li>`).join('') + '</ul>' : '<p class="none">✓ The logic is clean enough to trust the driving path.</p>'}</div>`).join('');
}
function dlPathBlock(p, res, kind, win) {
  const lim = S.dl.open['t' + win + '.' + p.rank];
  const head = `<h3 class="bt">Path ${p.rank}${p.rank === 1 ? ' – the longest (driving) path' : ' – next most critical path'} <small>${p.len} activities · ends at ${esc(p.end.code)} ${esc(dtr(p.end.name, 50))}${p.tf != null && p.rank > 1 ? ' · total float ' + (Math.round(p.tf * 10) / 10) + ' wd' : ''}</small></h3>`;
  const note = `<p class="hint" style="margin:0 0 6px">${p.reason === 'Joins a higher path' ? 'This path merges into a higher-ranked path at ' + esc(p.joins ? p.joins.code : '') + '.' : 'Traced back to: ' + esc(p.reason) + '.'} Red boxes are where delay <b>entered</b> the path; amber boxes only carry delay from an earlier activity; green boxes are on time or recovered.</p>`;
  const tbl = qtbl(['ID', 'Activity', 'Earlier start', 'Earlier finish', kind === 'B' ? 'Start – end of window' : 'Current start', 'Current finish', 'Finish moved', 'Added here', 'Cause', 'Notes'], p.rows.slice(0, lim ? 2000 : 0).map(r => `<tr class="${r.cause && r.own >= 1 ? 'dlhl' : ''}"><td class="nw">${esc(r.code)}</td><td>${esc(r.name)}</td><td>${dsh(r.sE != null ? r.sE : r.t.es)}</td><td>${dsh(r.fE)}</td><td>${dsh(r.sL)}</td><td>${dsh(r.fL)}</td><td class="n">${r.dF == null ? '' : dsg(r.dF)}</td><td class="n"><b>${r.cause ? dsg(r.own) : ''}</b></td><td>${esc(r.cause || '')}</td><td><small>${esc(r.flags.join('; '))}</small></td></tr>`), { num: [6, 7], h: 420 });
  return `<div class="dlp">${head}${note}<div class="dldia">${dlDiagram(p, kind)}</div><div class="actions"><button class="btn sm" data-dopen="t${win}.${p.rank}">${lim ? 'Hide' : 'Show'} the full activity table</button></div>${lim ? tbl : ''}</div>`;
}
function dlEventsTable(rows, win) {
  const top = rows.filter(x => x.path === 1 && x.e.own >= 1).sort((a, b) => b.e.own - a.e.own).slice(0, 8);
  if (!top.length) return '<p class="none">No activity on the driving path added delay.</p>';
  return qtbl(['ID', 'Activity', 'Delay added', 'Cause', 'Party (optional note)', 'Evidence / reason'], top.map(x => `<tr><td class="nw">${esc(x.e.code)}</td><td>${esc(x.e.name)}<br><small>${esc(x.e.flags.join('; '))}</small></td><td class="n"><b>${dsg(x.e.own)} d</b></td><td>${esc(x.e.cause)}</td><td>${dlTagCell(x.key)}</td><td>${dlNoteCell(x.key)}</td></tr>`), { num: [2], h: 380 });
}
function dlConcurrentHtml(list) {
  if (!list.length) return '<p class="none">✓ No parallel path is slipping in this period – the driving path is the only one that moved the finish.</p>';
  return qtbl(['Path', 'Ends at', 'Finish moved', 'Delay events on that path'], list.map(c => `<tr><td class="nw">Path ${c.rank}</td><td>${esc(c.end.code)} ${esc(dtr(c.end.name, 50))}</td><td class="n"><b>${dsg(c.endSlip)} d</b></td><td><small>${c.events.slice(0, 4).map(e => esc(e.code + ' ' + dtr(e.name, 36) + ' (' + dsg(e.own) + ' d, ' + e.cause.toLowerCase() + ')')).join('<br>') || '–'}</small></td></tr>`), { num: [2], h: 260 }) + '<p class="hint">Delay on these paths happened at the same time as the driving path. Treat it as <b>concurrent delay</b> when assigning responsibility – the finish was not pushed by one cause alone.</p>';
}

/* ---------- the three driving lists ---------- */
function dlDrivingHtml(L, win) {
  if (!L) return '';
  const k = 'dv' + win, lim = S.dl.open[k] ? 500 : 12, k2 = 'do' + win, lim2 = S.dl.open[k2] ? 200 : 15;
  const prov = L.prov.length ? `<div class="warnbox"><b>Result is provisional.</b> ${L.prov.map(esc).join('<br>')}</div>` : '<p class="hint" style="margin:0 0 8px">No data problem found on the driving path itself.</p>';
  const ties = L.now.filter(x => x.tie.length);
  const t1 = qtbl(['#', 'ID', 'Activity', 'Start', 'Finish', 'Why this activity is driving'], L.now.slice(0, lim).map((x, i) => `<tr><td class="n">${i + 1}</td><td class="nw">${esc(x.code)}</td><td>${esc(dtr(x.name, 70))}</td><td class="nw">${dsh(x.sL)}</td><td class="nw">${dsh(x.fL)}</td><td><small>${esc(x.why)}${x.tie.length ? ' <b>· tie with ' + esc(x.tie.join(', ')) + '</b>' : ''}</small></td></tr>`));
  const t2 = L.drv.length ? qtbl(['ID', 'Activity', 'Finish moved', 'Added here', 'What happened'], L.drv.map(x => `<tr class="${x.carried ? '' : 'dlhl'}"><td class="nw">${esc(x.code)}</td><td>${esc(dtr(x.name, 70))}</td><td class="n"><b>${dsg(x.dF)} d</b></td><td class="n">${x.carried ? '–' : '<b>' + dsg(x.added) + ' d</b>'}</td><td><small>${x.carried ? 'Carries delay from an earlier activity on the path' : esc(x.cause || '')}${x.flags && x.flags.length ? '; ' + esc(x.flags.join('; ')) : ''}</small></td></tr>`)) : '<p class="none">No activity on the driving path finishes later than before.</p>';
  const t3 = L.off.length ? qtbl(['ID', 'Activity', 'Finish moved', 'Total float (wd)', 'Status'], L.off.slice(0, lim2).map(x => `<tr><td class="nw">${esc(x.code)}</td><td>${esc(dtr(x.name, 70))}</td><td class="n">${dsg(x.dF)} d</td><td class="n">${x.tf == null ? '–' : Math.round(x.tf * 10) / 10}</td><td><small>${x.crit ? '<b>Critical but not on this driving path</b> (parallel or tied path)' : x.tf != null && x.tf < 10 ? 'Near-critical: little float left' : 'Has float: not moving the finish yet'}</small></td></tr>`)) : '<p class="none">No other activity slipped by the threshold.</p>';
  return `<div class="dlp"><p class="hint" style="margin:0 0 8px"><b>Delay assessment only. No entitlement assessed.</b> An activity is <i>driving</i> when a one-day delay to it would move the finish by a day: it sits on the longest path and the link into it has no gap.</p>${prov}
  <h3 class="bt">A. Driving now <small>${L.now.length} activities, from the start of the path to the finish</small></h3>${t1}${L.now.length > 12 ? `<div class="actions"><button class="btn sm" data-dopen="${k}">${S.dl.open[k] ? 'Show fewer' : 'Show all ' + L.now.length}</button></div>` : ''}
  <h3 class="bt">B. Delayed and driving <small>${L.drv.length} of the driving activities now finish later than before; red = the delay entered here</small></h3>${t2}
  <h3 class="bt">C. Delayed but not driving <small>${L.offTotal} activities slipped but are not on the driving path</small></h3>${t3}${L.off.length > 15 ? `<div class="actions"><button class="btn sm" data-dopen="${k2}">${S.dl.open[k2] ? 'Show fewer' : 'Show more'}</button></div>` : ''}</div>`;
}
function viewDelay() {
  const D = S.dl, r = D.res, all = dlModels(), last = all[all.length - 1];
  let h = `<header class="ph"><h1>Delay analysis</h1><p>Find which activities are driving the finish and which are delayed, on the longest path and on the next most critical paths. Delay assessment only: no entitlement or extension of time is assessed. Load the baseline and the progress update(s).</p></header>
  <div class="actions" style="margin-top:0"><label class="btn" for="q-open">Open saved project</label><input type="file" id="q-open" accept=".brtq,.brt,.json" hidden>${all.length ? '<button class="btn" data-qsave="1">Save project</button>' : ''}${r ? '<button class="btn primary" data-dr="1">Download narrative report (Word)</button><button class="btn" data-dx="1">Download findings (Excel)</button>' : ''}</div>
  <section class="card"><h2>Method</h2><div class="seg2"><button class="${D.mode === 'A' ? 'on' : ''}" data-dmode="A"><b>Option A · Baseline vs update</b><small>Simple. Traces the driving path in the update and measures how far each activity moved from the baseline.</small></button><button class="${D.mode === 'B' ? 'on' : ''}" data-dmode="B"><b>Option B · Windows analysis</b><small>Professional. Load the baseline and several updates in order. Each period (window) is analysed on its own, with the critical path as it stood at its start.</small></button></div></section>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-bottom:18px">
  <div class="card" style="margin:0"><h2>Baseline ${D.base ? qchip('Loaded', 'ok') : ''}</h2><p class="hint" style="margin-top:0">The approved baseline XER (or the earliest schedule you want to measure from).</p>${D.base ? `<div class="kv" style="margin:0 0 12px"><span>File <b style="font-size:14px">${esc(D.base.name)}</b></span><span>Data date <b style="font-size:14px">${esc(E.fmtDate(D.base.M.dataDate))}</b></span><span>Finish <b style="font-size:14px">${esc(E.fmtDate(D.base.M.maxEF))}</b></span></div>` : ''}${drop('d-base', '.xer,.txt', false, D.base ? 'Replace the baseline' : 'Choose the baseline XER')}</div>
  <div class="card" style="margin:0"><h2>Progress update${D.mode === 'B' ? 's' : ''} ${D.ups.length ? qchip(D.ups.length + ' loaded', 'ok') : ''}</h2><p class="hint" style="margin-top:0">${D.mode === 'B' ? 'Add every update in the period. They are sorted by data date automatically.' : 'The current progress update. Several can be loaded – pick the one to analyse below.'}</p>${D.ups.length ? `<div class="dlist">${D.ups.map((u, i) => `<div><b>${i + 1}.</b> <span>${esc(u.name)}</span><small>data date ${esc(E.fmtDate(u.M.dataDate))} · finish ${esc(E.fmtDate(u.M.maxEF))}</small><button class="btn sm" data-drm="${i}">Remove</button></div>`).join('')}</div>` : ''}${drop('d-ups', '.xer,.txt', true, D.ups.length ? 'Add more updates' : 'Choose the update XER' + (D.mode === 'B' ? 's' : ''))}</div></div>`;
  if (last) {
    const tg = E.dlTargets(last.M);
    h += `<section class="card"><h2>What to analyse</h2><div class="dlset"><label>Delay to <select id="d-target">${tg.map(t => `<option value="${esc(t.code)}" ${t.code === D.target ? 'selected' : ''}>${esc(t.code)} – ${esc(dtr(t.name, 60))} (${E.fmtDate(t.ef)})</option>`).join('')}</select></label><label>Ignore movements under <select id="d-min">${[1, 2, 3, 5, 7].map(n => `<option value="${n}" ${n === D.min ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}</select></label><label>Paths to analyse <select id="d-n">${[1, 2, 3, 4, 5].map(n => `<option ${n === D.n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${D.mode === 'A' && D.ups.length > 1 ? `<label>Update to analyse <select id="d-up">${D.ups.map(u => `<option value="${esc(u.name)}" ${D.upUsed && u.name === D.upUsed.name ? 'selected' : ''}>${esc(u.name)} (${esc(E.fmtDate(u.M.dataDate))})</option>`).join('')}</select></label>` : ''}</div><p class="hint">Small movements (a day or two caused by weekends and holidays) are ignored so only real delay events show. Path 1 is the longest (driving) path to the chosen activity. Paths 2 to ${D.n} are the next most critical paths, found from the lowest total float.</p></section>`;
  }
  if (!r) { $('#main').innerHTML = h + `<p class="hint">${!D.base ? 'Load the baseline to start.' : !D.ups.length ? 'Load at least one progress update.' : ''}</p>`; return; }
  const wy = window.scrollY;
  const warnAll = (r.baseWarn || []).map(w => `<div class="warnbox">${esc(w)}</div>`).join('');
  if (r.mode === 'A') {
    const rows = dlEventRows(r), sp = dlSplit(rows), T = r.target, p1 = r.paths[0], bad = r.integrity.some(x => x.sev === 'bad');
    h += warnAll + `<section class="card"><h2>Management summary <small>${esc(r.from.name)} → ${esc(r.to.name)}</small></h2><p class="dlhead">${esc(r.headline)}</p>
    <div class="verd"><div class="vt info"><span>Earlier finish</span><b>${esc(E.fmtDate(T.fE))}</b><small>data date ${esc(E.fmtDate(r.from.dd))}</small></div><div class="vt ${T.slip > 0 ? 'bad' : T.slip < 0 ? 'ok' : 'info'}"><span>Current finish</span><b>${esc(E.fmtDate(T.fL))}</b><small>${T.slip ? dsg(T.slip) + ' days' : 'no change'}</small></div><div class="vt info"><span>Delay events on path 1</span><b>${fmtN(rows.filter(x => x.path === 1 && x.e.own >= 1).length)}</b><small>activities that added delay</small></div><div class="vt ${bad ? 'bad' : 'ok'}"><span>Reliability of the logic</span><b>${bad ? 'Check first' : 'Good'}</b><small>${bad ? 'see data checks below' : 'no major problems'}</small></div></div></section>
    <section class="card"><h2>1. Activities driving the finish</h2>${dlDrivingHtml(r.lists, 0)}</section>
    <section class="card"><h2>1b. Gantt and driving-path comparison</h2>${dlGanttBlock(p1.rows, 'A', 'A')}${dlCmpHtml(r.cmp)}</section>
    <section class="card"><h2>2. How the finish moved</h2><p class="hint" style="margin-top:0">Each bar is one activity on the driving path and the days of delay it added. Together they explain the whole movement of the finish.</p><div class="dldia">${dlWaterfall(r, p1)}</div></section>
    <section class="card"><h2>3. Top delay events and optional party notes</h2>${dlEventsTable(rows)}<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px;margin-top:16px"><div><h3 class="bt" style="margin-top:0">By cause</h3>${dlBars(sp.byC, DL_CCOL, sp.pos || 1)}</div><div><h3 class="bt" style="margin-top:0">By responsible party <small>from your tags</small></h3>${dlBars(sp.byP, DL_PCOL, sp.pos || 1)}</div></div></section>
    <section class="card"><h2>4. Network diagrams – the driving path and the next critical paths</h2>${r.paths.map(p => dlPathBlock(p, r, 'A', 0)).join('')}</section>
    <section class="card"><h2>5. Parallel (concurrent) delays</h2>${dlConcurrentHtml(r.concurrent)}</section>
    <section class="card"><h2>6. Data checks before you trust the result</h2>${dlIntegrityHtml(r.integrity)}</section>`;
  } else {
    const rows = dlEventsAll(r), sp = dlSplit(rows), T = r.target;
    h += warnAll + `<section class="card"><h2>Management summary <small>${r.models.length - 1} window${r.models.length - 1 === 1 ? '' : 's'} · ${esc(r.models[0].name)} → ${esc(r.models[r.models.length - 1].name)}</small></h2><p class="dlhead">Over the whole period the finish of “${esc(T.name)}” moved ${T.slip ? (T.slip > 0 ? 'later by ' + T.slip : 'earlier by ' + (-T.slip)) + ' days (' + esc(E.fmtDate(T.fE)) + ' → ' + esc(E.fmtDate(T.fL)) + ')' : 'by 0 days'}. ${r.windows.length ? 'The biggest movement was in window ' + r.windows.slice().sort((a, b) => Math.abs(b.target.slip) - Math.abs(a.target.slip))[0].idx + ' (' + dsg(r.windows.slice().sort((a, b) => Math.abs(b.target.slip) - Math.abs(a.target.slip))[0].target.slip) + ' days).' : ''}</p>
    <div class="verd"><div class="vt info"><span>First finish</span><b>${esc(E.fmtDate(T.fE))}</b><small>${esc(r.models[0].name)}</small></div><div class="vt ${T.slip > 0 ? 'bad' : T.slip < 0 ? 'ok' : 'info'}"><span>Latest finish</span><b>${esc(E.fmtDate(T.fL))}</b><small>${T.slip ? dsg(T.slip) + ' days' : 'no change'}</small></div><div class="vt info"><span>Windows</span><b>${r.windows.length}</b><small>update-to-update periods</small></div><div class="vt ${r.integrity.some(x => x.sev === 'bad') ? 'bad' : 'ok'}"><span>Schedules with logic problems</span><b>${r.integrity.filter(x => x.sev === 'bad').length}</b><small>of ${r.integrity.length}</small></div></div></section>
    <section class="card"><h2>1. Finish movement by window</h2><div class="dldia">${dlBarsByWindow(r)}</div>${qtbl(['Window', 'Period (data dates)', 'Finish before', 'Finish after', 'Movement', 'Critical path still driving', 'Parallel paths slipping', 'Largest delay event'], r.windows.map(w => { const top = w.paths[0].events.filter(e => e.own > 0).sort((a, b) => b.own - a.own)[0]; return `<tr><td class="nw">${w.idx}</td><td>${esc(dsh(w.ddE))} → ${esc(dsh(w.ddL))}</td><td>${esc(E.fmtDate(w.target.fE))}</td><td>${esc(E.fmtDate(w.target.fL))}</td><td class="n"><b class="${w.target.slip > 0 ? 't-bad' : w.target.slip < 0 ? 't-ok' : ''}">${dsg(w.target.slip)} d</b></td><td class="n">${w.overlap == null ? '–' : w.overlap + '%'}</td><td class="n">${w.concurrent.length}</td><td><small>${top ? esc(top.code + ' ' + dtr(top.name, 40) + ' (' + dsg(top.own) + ' d)') : '–'}</small></td></tr>`; }), { num: [4, 5, 6], h: 340 })}</section>
    <section class="card"><h2>2. Cause and responsibility across all windows</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px"><div><h3 class="bt" style="margin-top:0">By cause</h3>${dlBars(sp.byC, DL_CCOL, sp.pos || 1)}</div><div><h3 class="bt" style="margin-top:0">By responsible party <small>from your tags</small></h3>${dlBars(sp.byP, DL_PCOL, sp.pos || 1)}</div></div></section>`;
    r.windows.forEach(w => {
      const wr = dlEventRows({ mode: 'B', windows: [w] });
      h += `<section class="card"><h2>Window ${w.idx} <small>${esc(w.from)} → ${esc(w.to)}</small> ${w.target.slip > 0 ? qchip(dsg(w.target.slip) + ' days', 'bad') : w.target.slip < 0 ? qchip(dsg(w.target.slip) + ' days', 'ok') : qchip('No movement', '')}</h2><p class="dlhead">${esc(w.headline)}</p>${w.overlap != null && w.overlap < 60 ? `<div class="warnbox">The critical path changed during this window – only ${w.overlap}% of the path now driving the finish was on the path at the start of the window.</div>` : ''}
      ${w.paths[0].events.length ? `<div class="dldia">${dlWaterfall({ target: w.target }, w.paths[0])}</div>` : ''}${dlEventsTable(wr.map(x => Object.assign({}, x, { path: x.path })), w.idx)}
      <h3 class="bt">Activities driving the finish in this window</h3>${dlDrivingHtml(w.lists, w.idx)}${dlGanttBlock(w.paths[0].rows, 'W' + w.idx, 'B')}${dlCmpHtml(w.cmp)}<h3 class="bt">Parallel paths</h3>${dlConcurrentHtml(w.concurrent)}${w.paths.map(p => dlPathBlock(p, { target: w.target }, 'B', w.idx)).join('')}</section>`;
    });
    h += `<section class="card"><h2>Data checks</h2>${dlIntegrityHtml(r.integrity)}</section>`;
  }
  $('#main').innerHTML = h; window.scrollTo(0, wy);
}
function dlEventsAll(r) { return dlEventRows(r); }

/* ---------- Excel ---------- */
async function dlExport() {
  const r = S.dl.res; if (!r) return; const X = await lib('exceljs'); const wb = new X.Workbook(); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool'; wb.created = new Date();
  const NAVY = 'FF1B2A41', hdr = (ws, n) => { const row = ws.getRow(n); row.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', wrapText: true }; }); row.height = 22; };
  const title = (ws, t, sub, nc) => { ws.mergeCells(1, 1, 1, nc || 6); ws.getCell('A1').value = t; ws.getCell('A1').font = { size: 15, bold: true, color: { argb: NAVY } }; ws.getCell('A2').value = sub; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6B7B' } }; };
  const T = r.target; const sub = r.mode === 'A' ? 'Baseline: ' + r.from.name + ' | Update: ' + r.to.name + ' (data date ' + E.fmtDate(r.to.dd) + ')' : r.models.map(m => m.name).join('  →  ');
  const sm = wb.addWorksheet('Summary'); title(sm, 'Delay analysis – ' + (r.mode === 'A' ? 'Option A: baseline vs update' : 'Option B: windows analysis'), sub, 4); sm.columns = [{ width: 34 }, { width: 30 }, { width: 22 }, { width: 70 }];
  const kv = [['Analysed activity', T.code + ' – ' + T.name], ['Earlier finish', E.fmtDate(T.fE)], ['Latest finish', E.fmtDate(T.fL)], ['Movement (days)', T.slip]]; kv.forEach((k, i) => { sm.getRow(4 + i).values = k; sm.getRow(4 + i).getCell(1).font = { bold: true }; });
  sm.getCell('A9').value = 'Headline'; sm.getCell('A9').font = { bold: true }; sm.mergeCells('B9:D9'); sm.getCell('B9').value = r.mode === 'A' ? r.headline : r.windows.map(w => 'Window ' + w.idx + ': ' + w.headline).join('  '); sm.getCell('B9').alignment = { wrapText: true, vertical: 'top' }; sm.getRow(9).height = Math.min(200, 30 + 15 * (r.mode === 'B' ? r.windows.length : 2));
  (r.baseWarn || []).forEach((w, i) => { sm.getCell('A' + (11 + i)).value = 'Warning'; sm.mergeCells('B' + (11 + i) + ':D' + (11 + i)); sm.getCell('B' + (11 + i)).value = w; sm.getCell('B' + (11 + i)).alignment = { wrapText: true }; });
  const rows = dlEventRows(r), sp = dlSplit(rows); let ro = 14 + (r.baseWarn || []).length; sm.getRow(ro).values = ['Delay by cause (path 1, days)', 'Days', 'Share']; hdr(sm, ro++); Object.keys(sp.byC).forEach(k => { sm.getRow(ro++).values = [k, Math.round(sp.byC[k] * 10) / 10, sp.pos ? dlPct(sp.byC, sp.pos)[k] + '%' : '']; });
  ro++; sm.getRow(ro).values = ['Delay by responsible party (path 1, days)', 'Days', 'Share']; hdr(sm, ro++); Object.keys(sp.byP).forEach(k => { sm.getRow(ro++).values = [k, Math.round(sp.byP[k] * 10) / 10, sp.pos ? dlPct(sp.byP, sp.pos)[k] + '%' : '']; });
  sm.getCell('A3').value = 'Delay assessment only. No entitlement assessed.'; sm.getCell('A3').font = { bold: true, color: { argb: 'FFC0392B' } };
  const drvSheet = (name, L, sb) => { if (!L) return; const ws = wb.addWorksheet(name.slice(0, 31)); title(ws, name + ' - activities driving the finish', sb, 7); ws.columns = [{ width: 8 }, { width: 24 }, { width: 58 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 70 }];
    let rr = 4; const sec = (t, head) => { ws.getRow(rr).values = [t]; ws.getRow(rr).font = { bold: true }; rr++; ws.getRow(rr).values = head; hdr(ws, rr); rr++; };
    if (L.prov.length) { ws.getRow(rr).values = ['RESULT IS PROVISIONAL']; ws.getRow(rr).font = { bold: true, color: { argb: 'FFC0392B' } }; rr++; L.prov.forEach(p => { ws.mergeCells(rr, 1, rr, 7); ws.getCell(rr, 1).value = p; ws.getCell(rr, 1).alignment = { wrapText: true }; ws.getRow(rr).height = 30; rr++; }); rr++; }
    sec('A. Driving now', ['#', 'ID', 'Activity', 'Start', 'Finish', 'Total float (wd)', 'Why this activity is driving']); L.now.forEach((x, i) => ws.getRow(rr++).values = [i + 1, x.code, x.name, E.fmtDate(x.sL), E.fmtDate(x.fL), x.tf == null ? '' : x.tf, x.why + (x.tie.length ? ' | tie with ' + x.tie.join(', ') : '')]); rr++;
    sec('B. Delayed and driving', ['', 'ID', 'Activity', 'Finish moved (d)', 'Added here (d)', 'Delay entered here?', 'What happened']); L.drv.forEach(x => ws.getRow(rr++).values = ['', x.code, x.name, x.dF, x.carried ? '' : x.added, x.carried ? 'No, carried' : 'Yes', (x.carried ? 'Carries delay from an earlier activity' : x.cause) + (x.flags && x.flags.length ? '; ' + x.flags.join('; ') : '')]); rr++;
    sec('C. Delayed but not driving (' + L.offTotal + ' in total' + (L.offTotal > L.off.length ? ', first ' + L.off.length + ' shown' : '') + ')', ['', 'ID', 'Activity', 'Finish moved (d)', 'Total float (wd)', 'Status', 'Note']); L.off.forEach(x => ws.getRow(rr++).values = ['', x.code, x.name, x.dF, x.tf == null ? '' : x.tf, x.status, x.crit ? 'Critical but not on this driving path (parallel or tied path)' : x.tf != null && x.tf < 10 ? 'Near-critical' : 'Has float']); };
  if (r.mode === 'A') drvSheet('Driving activities', r.lists, sub); else r.windows.forEach(w => drvSheet('W' + w.idx + ' Driving', w.lists, 'Window ' + w.idx + ': ' + w.from + ' -> ' + w.to));
  const ev = wb.addWorksheet('Delay events', { views: [{ state: 'frozen', ySplit: 4 }] }); title(ev, 'Delay events (activities that added or recovered time)', sub, 10);
  ev.getRow(4).values = ['Window', 'Path', 'ID', 'Activity', 'WBS', 'Days added (+) / recovered (−)', 'Cause', 'Notes from the schedules', 'Responsible party', 'Evidence / reason']; hdr(ev, 4); ev.columns = [{ width: 9 }, { width: 7 }, { width: 24 }, { width: 56 }, { width: 40 }, { width: 16 }, { width: 22 }, { width: 50 }, { width: 18 }, { width: 50 }];
  rows.forEach(x => { const t = S.dl.tags[x.key] || {}; ev.addRow([x.win || '–', x.path, x.e.code, x.e.name, x.e.wbs, x.e.own, x.e.cause, x.e.flags.join('; '), t.party || 'Unassigned', t.note || '']); }); if (rows.length) ev.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: 10 } };
  const pathSheet = (name, p, sb) => { const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] }); title(ws, name + ' – ' + p.len + ' activities, ends at ' + p.end.code + ' ' + p.end.name, sb, 12); ws.getRow(4).values = ['Seq', 'ID', 'Activity', 'WBS', 'Status', 'Earlier start', 'Earlier finish', 'Later start', 'Later finish', 'Finish moved (d)', 'Added here (d)', 'Cause', 'Notes']; hdr(ws, 4); ws.columns = [{ width: 6 }, { width: 24 }, { width: 56 }, { width: 38 }, { width: 12 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 50 }]; p.rows.forEach((x, i) => ws.addRow([i + 1, x.code, x.name, x.wbs, (x.status || '').replace('TK_', ''), x.sE != null ? E.fmtDate(x.sE) : '', x.fE != null ? E.fmtDate(x.fE) : '', x.sL != null ? E.fmtDate(x.sL) : '', x.fL != null ? E.fmtDate(x.fL) : '', x.dF, x.cause ? x.own : '', x.cause || '', x.flags.join('; ')])); };
  if (r.mode === 'A') r.paths.forEach(p => pathSheet('Path ' + p.rank, p, sub));
  else {
    const ws = wb.addWorksheet('Windows'); title(ws, 'Windows analysis', sub, 9); ws.getRow(4).values = ['Window', 'From', 'To', 'Data date from', 'Data date to', 'Finish before', 'Finish after', 'Movement (d)', 'Critical path still driving (%)', 'Parallel paths slipping']; hdr(ws, 4); ws.columns = [{ width: 9 }, { width: 40 }, { width: 40 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }];
    r.windows.forEach(w => ws.addRow([w.idx, w.from, w.to, E.fmtDate(w.ddE), E.fmtDate(w.ddL), E.fmtDate(w.target.fE), E.fmtDate(w.target.fL), w.target.slip, w.overlap == null ? '' : w.overlap, w.concurrent.length]));
    r.windows.forEach(w => w.paths.forEach(p => pathSheet('W' + w.idx + ' Path ' + p.rank, p, 'Window ' + w.idx + ': ' + w.from + ' → ' + w.to)));
  }
  const ig = wb.addWorksheet('Data checks'); title(ig, 'Schedule data checks', sub, 4); ig.columns = [{ width: 36 }, { width: 10 }, { width: 12 }, { width: 90 }]; ig.getRow(4).values = ['Schedule', 'Severity', 'Count', 'Check']; hdr(ig, 4);
  (r.integrity || []).forEach(g => { if (!g.issues.length) ig.addRow([g.label, 'OK', 0, 'No problems found']); g.issues.forEach(i => ig.addRow([g.label, i.sev, i.n, i.title + (i.ex && i.ex.length ? '  (e.g. ' + i.ex.join(', ') + ')' : '')])); });
  const buf = await wb.xlsx.writeBuffer(); download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (S.cfg.projectName || (dlModels()[0] ? dlModels()[0].M.proj.proj_short_name : 'Project')) + '_Delay_Analysis.xlsx');
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target; let el;
  if (S.step !== 'delay') return;
  if ((el = t.closest('[data-dmode]'))) { S.dl.mode = el.dataset.dmode; runDl(); viewDelay(); return; }
  if ((el = t.closest('[data-drm]'))) { S.dl.ups.splice(+el.dataset.drm, 1); runDl(); viewDelay(); return; }
  if ((el = t.closest('[data-dopen]'))) { const k = el.dataset.dopen; S.dl.open[k] = !S.dl.open[k]; viewDelay(); return; }
  if (t.closest('[data-dx]')) { dlExport().then(() => toast('Delay analysis Excel created', 'ok')).catch(err => { console.error(err); toast(err.message, 'bad'); }); return; }
});
document.addEventListener('change', e => {
  const el = e.target; if (S.step !== 'delay') return;
  if (el.type === 'file' && el.files.length) { if (el.id === 'd-base') loadDl('base', [el.files[0]]); else if (el.id === 'd-ups') loadDl('up', [...el.files]); return; }
  if (el.id === 'd-target') { S.dl.target = el.value; runDl(); } else if (el.id === 'd-min') { S.dl.min = +el.value; runDl(); } else if (el.id === 'd-n') { S.dl.n = +el.value; runDl(); } else if (el.id === 'd-up') { S.dl.upSel = el.value; runDl(); }
  else if (el.dataset && el.dataset.dtag) { (S.dl.tags[el.dataset.dtag] = S.dl.tags[el.dataset.dtag] || {}).party = el.value; viewDelay(); }
  else if (el.dataset && el.dataset.dnote) { (S.dl.tags[el.dataset.dnote] = S.dl.tags[el.dataset.dnote] || {}).note = el.value; }
});
document.addEventListener('drop', e => { if (S.step !== 'delay') return; const d = e.target.closest('.drop'); if (!d || !e.dataTransfer || !e.dataTransfer.files.length) return; if (d.querySelector('#d-base')) { e.preventDefault(); loadDl('base', [e.dataTransfer.files[0]]); } else if (d.querySelector('#d-ups')) { e.preventDefault(); loadDl('up', [...e.dataTransfer.files]); } });
