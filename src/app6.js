/* ===== APP PART 6: programme overview diagram (stages x zones x trades) ===== */
const TRADE_NAMES = { sewer: 'Sewer', drainage: 'Drainage', potable: 'Potable water', irrigation: 'Irrigation', ict: 'ICT', electrical: 'Electrical', paving: 'Roads / paving', lighting: 'Street lighting', other: 'Other', chilled: 'Chilled water', water: 'Water' };
const tradeName = t => TRADE_NAMES[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
const zoneLabel = z => z === 'General' ? 'Project-wide' : z;
function diagramModel() {
  const M = S.M, o = S.out; const colOf = t => COLS.findIndex(c => c.cats.includes(t.cat));
  const trOf = new Map(); if (o.pk) o.pk.packages.forEach(p => p.tasks.forEach(t => trOf.set(t, p.trade)));
  const flagged = new Set(); o.results.filter(r => r.status === 'fail' && (r.tier === 'major' || ['L1', 'L14'].includes(r.id))).forEach(r => r.items.forEach(i => flagged.add(i.id)));
  const crit = o.critical || new Set(), critL = new Set(o.critLinks || []);
  const tasks = M.tasks.filter(t => !t.isMile && colOf(t) >= 0);
  const stat = new Map(); const sk = t => M.zoneOf(t) + '|' + colOf(t) + '|' + (colOf(t) === 2 ? (trOf.get(t) || 'other') : '');
  tasks.forEach(t => { const k = sk(t); const x = stat.get(k) || stat.set(k, { crit: 0 }).get(k); if (crit.has(t)) x.crit++; });
  const cellKey = t => { const z = M.zoneOf(t), c = colOf(t); if (c !== 2) return z + '|' + c; const tr = trOf.get(t) || 'other'; return stat.get(z + '|2|' + tr).crit > 0 ? z + '|2|' + tr : z + '|2|rest'; };
  const cells = new Map();
  tasks.forEach(t => { const k = cellKey(t), z = M.zoneOf(t), c = colOf(t); let b = cells.get(k); if (!b) { const tr = k.endsWith('|rest') ? 'rest' : (c === 2 ? k.split('|')[2] : ''); cells.set(k, b = { key: k, zone: z, col: c, trade: tr, n: 0, crit: 0, flag: 0, s: Infinity, f: -Infinity, tasks: [] }); } b.n++; b.s = Math.min(b.s, t.es ?? b.s); b.f = Math.max(b.f, t.ef ?? b.f); if (crit.has(t)) b.crit++; if (flagged.has(t.code)) b.flag++; b.tasks.push(t); });
  cells.forEach(b => { b.label = b.col === 2 ? (b.trade === 'rest' ? zoneLabel(b.zone) + ' · other trades · ' + b.n.toLocaleString() : zoneLabel(b.zone) + ' · ' + tradeName(b.trade) + ' · ' + b.crit + ' critical of ' + b.n.toLocaleString()) : zoneLabel(b.zone) + ' · ' + b.n.toLocaleString() + ' act.'; });
  const zones = [...new Set([...cells.values()].map(b => b.zone))].sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a < b ? -1 : 1);
  const links = new Map();
  for (const l of M.links) { if (l.from.isMile || l.to.isMile || colOf(l.from) < 0 || colOf(l.to) < 0) continue; const a = cells.get(cellKey(l.from)), b = cells.get(cellKey(l.to)); if (!a || !b || a === b || b.col <= a.col) continue; const k = a.key + '>' + b.key; const x = links.get(k) || { a, b, n: 0, crit: false }; x.n++; if (critL.has(l)) x.crit = true; links.set(k, x); }
  const main = ((o.chains && o.chains.critChains[0]) || []).filter(t => !t.isMile); const ph = []; const byTrade = {};
  main.forEach(t => { const lab = t.cat === 'construction' ? 'construction' : t.cat; if (ph[ph.length - 1] !== lab) ph.push(lab); if (t.cat === 'construction') { const tr = trOf.get(t) || 'other'; byTrade[tr] = (byTrade[tr] || 0) + 1; } });
  const pc = {}; main.forEach(t => { if (t.cat !== 'construction') pc[t.cat] = (pc[t.cat] || 0) + 1; });
  return { cells, zones, links, byTrade, phases: ph, phaseCount: pc };
}
function diagramSVG(sel) {
  const d = diagramModel(); let zones = d.zones; if (sel && sel.length) zones = zones.filter(z => sel.includes(z));
  const C = { ink: '#1b2a41', mut: '#5b6b7b', line: '#d5dce3', ok: '#0b7a75', bad: '#b4412f', grey: '#c9d2db', sum: '#2e9e5b', st: ['#8fa3b8', '#d9a441', '#6f8fd0', '#7bb08a'] };
  const W = 1240, L = 180, R = 300, TOP = 120, h = 16, gap = 5, sh = 18; const M = S.M, minD = M.minES, NW = Math.max(1, Math.ceil((M.maxEF - minD) / 7)); const x = dd => L + ((dd - minD) / 7) / NW * (W - L - R);
  const cellsAll = [...d.cells.values()].filter(b => zones.includes(b.zone));
  const order = (a, b) => (a.zone === b.zone ? 0 : (a.zone === 'General' ? -1 : b.zone === 'General' ? 1 : a.zone < b.zone ? -1 : 1)) || ((a.trade === 'rest') - (b.trade === 'rest')) || (b.crit - a.crit);
  const stages = COLS.map((c, i) => { const cs = cellsAll.filter(b => b.col === i).sort(order); return cs.length ? { i, name: c.t, cs, s: Math.min(...cs.map(b => b.s)), f: Math.max(...cs.map(b => b.f)), n: cs.reduce((a, b) => a + b.n, 0), flag: cs.reduce((a, b) => a + b.flag, 0) } : null; }).filter(Boolean);
  // journey strip (wrapped)
  const nm = { engineering: 'Engineering', procurement: 'Procurement', delivery: 'Delivery', mobilization: 'Mobilization', construction: 'Construction', closeout: 'Close-out', general: 'General' };
  const tw = (t, fs) => t.length * fs * 0.56; let sx = 30, sy = 96, strip = ''; const adv = (w, hh) => { if (sx + w > W - 30) { sx = 30; sy += hh + 8; } };
  const pill = (t, fill, color) => { const w = tw(t, 12) + 22; adv(w, 24); strip += `<rect x="${sx}" y="${sy - 16}" width="${w}" height="24" rx="12" fill="${fill}"/><text x="${sx + 11}" y="${sy}" font-size="12" font-weight="700" fill="${color}">${esc(t)}</text>`; sx += w + 6; };
  const box = t => { const w = tw(t, 12) + 22; adv(w, 24); strip += `<rect x="${sx}" y="${sy - 16}" width="${w}" height="24" rx="8" fill="#fff" stroke="${C.ok}" stroke-width="2"/><text x="${sx + 11}" y="${sy}" font-size="12" font-weight="600" fill="${C.ink}">${esc(t)}</text>`; sx += w + 6; };
  const arr = () => { adv(18, 24); strip += `<text x="${sx}" y="${sy}" font-size="13" fill="${C.mut}">→</text>`; sx += 18; };
  pill('START ' + E.fmtDate(M.minES), C.ink, '#fff');
  d.phases.forEach(p => { arr(); if (p === 'construction') { const tr = Object.entries(d.byTrade).sort((a, b) => b[1] - a[1]); box('Construction: ' + tr.map(([k, v]) => tradeName(k) + ' ' + v).join(' · ')); } else box((nm[p] || p) + ' ' + (d.phaseCount[p] || '')); });
  arr(); pill('FINISH ' + E.fmtDate(M.maxEF), C.ink, '#fff');
  const top = Math.max(TOP, sy + 44); let y = top; const rows = [];
  stages.forEach(st => { st.y0 = y; st.sy = y + 3; y += sh + gap + 4; st.cs.forEach(c => { c.y = y; c.ym = y + h / 2; y += h + gap; }); y += 8; st.y1 = y; });
  const H = y + 54; let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>
  <defs><marker id="mg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${C.mut}"/></marker><marker id="mc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${C.ok}"/></marker></defs>
  <text x="30" y="32" font-size="21" font-weight="700" fill="${C.ink}">${esc(S.cfg.projectName || 'Programme')} – programme overview</text><text x="30" y="52" font-size="12" fill="${C.mut}">Stages, zones and trades · critical path outlined · data date ${E.fmtDate(M.dataDate)}</text>
  <text x="30" y="72" font-size="11" font-weight="700" fill="${C.mut}" letter-spacing=".05em">CRITICAL PATH JOURNEY</text>${strip}`;
  const step = NW > 60 ? 8 : 4; s += `<text x="${L - 8}" y="${top - 8}" font-size="10.5" fill="${C.mut}" text-anchor="end">Week</text>`;
  for (let w = 0; w <= NW; w += step) { const xx = L + w / NW * (W - L - R); s += `<line x1="${xx}" x2="${xx}" y1="${top - 6}" y2="${y}" stroke="${C.line}"/><text x="${xx}" y="${top - 8}" font-size="10.5" fill="${C.mut}" text-anchor="middle">${w}</text>`; }
  stages.forEach(st => { s += `<rect x="24" y="${st.y0}" width="${L - 38}" height="${st.y1 - st.y0 - 6}" rx="8" fill="${C.st[st.i]}"/><text x="34" y="${st.y0 + 20}" font-size="12" font-weight="700" fill="#fff">${esc(st.name.split(' & ')[0])}</text>${st.name.includes(' & ') ? `<text x="34" y="${st.y0 + 34}" font-size="12" font-weight="700" fill="#fff">&amp; ${esc(st.name.split(' & ')[1])}</text>` : ''}${st.y1 - st.y0 > 70 ? `<text x="34" y="${st.y0 + 54}" font-size="11" fill="#fff" opacity=".92">${st.n.toLocaleString()} activities</text>` : ''}`; });
  // links first (under bars)
  const out = new Map(); [...d.links.values()].filter(l => l.crit && zones.includes(l.a.zone) && zones.includes(l.b.zone)).forEach(l => { const k = out.get(l.a.key) || 0; out.set(l.a.key, k + 1); const xs = x(l.a.f), xt = x(l.b.s); let p; if (xt > xs + 14) { const xm = Math.min(xt - 8, xs + 8 + k * 4); p = `M${xs},${l.a.ym} H${xm} V${l.b.ym} H${xt}`; } else { const g = Math.min(x(l.a.s), xt) - 8 - k * 4; p = `M${x(l.a.s)},${l.a.ym} H${g} V${l.b.ym} H${xt}`; } s += `<path d="${p}" fill="none" stroke="${C.ok}" stroke-width="2" marker-end="url(#mc)"/>`; });
  stages.forEach(st => {
    const x1 = x(st.s), x2 = Math.max(x(st.f), x1 + 30), wk = Math.max(1, Math.round((st.f - st.s) / 7));
    s += `<polygon points="${x1},${st.sy} ${x2 - 10},${st.sy} ${x2},${st.sy + sh / 2} ${x2 - 10},${st.sy + sh} ${x1},${st.sy + sh}" fill="${C.sum}"/><text x="${(x1 + x2) / 2}" y="${st.sy + sh / 2 + 4}" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle">${wk} weeks</text>`;
    if (st.flag) s += `<circle cx="${W - 24}" cy="${st.sy + sh / 2}" r="12" fill="${C.bad}"/><text x="${W - 24}" y="${st.sy + sh / 2 + 3.5}" font-size="9.5" font-weight="700" fill="#fff" text-anchor="middle">${st.flag > 999 ? '999+' : st.flag}</text>`;
    st.cs.forEach(c => { const a = x(c.s), b = Math.max(x(c.f), a + 8), w = b - a, wk2 = Math.max(1, Math.round((c.f - c.s) / 7));
      s += `<g class="dbar" data-cell="${esc(c.key)}" style="cursor:pointer"><title>${esc(c.label)} – ${E.fmtDate(c.s)} to ${E.fmtDate(c.f)}, ${c.flag} major findings</title><rect x="${a}" y="${c.y}" width="${w}" height="${h}" rx="4" fill="${C.grey}"/>${c.crit ? `<rect x="${a}" y="${c.y}" width="${Math.max(w * c.crit / c.n, 3)}" height="${h}" rx="4" fill="${C.ok}"/><rect x="${a}" y="${c.y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${C.ok}" stroke-width="2.4"/>` : ''}${w > 46 ? `<text x="${a + w / 2}" y="${c.y + h / 2 + 4}" font-size="11" font-weight="700" fill="${C.ink}" text-anchor="middle">${wk2}w</text>` : ''}<text x="${b + 8}" y="${c.y + h / 2 + 4}" font-size="12" fill="${C.ink}">${esc(c.label)}</text></g>`;
      if (c.flag) s += `<circle cx="${W - 24}" cy="${c.ym}" r="11" fill="${C.bad}"/><text x="${W - 24}" y="${c.ym + 3.5}" font-size="9.5" font-weight="700" fill="#fff" text-anchor="middle">${c.flag > 999 ? '999+' : c.flag}</text>`; });
  });
  const ly = H - 26; s += `<g font-size="11.5" fill="${C.mut}"><rect x="30" y="${ly - 8}" width="16" height="12" rx="3" fill="${C.sum}"/><text x="52" y="${ly + 2}">Stage summary (total weeks)</text><rect x="240" y="${ly - 8}" width="16" height="12" rx="3" fill="${C.ok}"/><text x="262" y="${ly + 2}">Critical share of the bar</text><line x1="440" x2="470" y1="${ly - 2}" y2="${ly - 2}" stroke="${C.ok}" stroke-width="2"/><text x="478" y="${ly + 2}">Critical link between stages</text><circle cx="680" cy="${ly - 2}" r="8" fill="${C.bad}"/><text x="694" y="${ly + 2}">Activities with a major finding</text>${zones.length < d.zones.length ? `<text x="${W - 30}" y="${ly + 2}" text-anchor="end">Showing ${zones.length} of ${d.zones.length} zones</text>` : ''}</g></svg>`;
  return s;
}
function diagDetail(key) {
  const b = diagramModel().cells.get(key); const el = $('#dg-detail'); if (!b || !el) return; const crit = S.out.critical || new Set();
  const flagged = new Set(); S.out.results.filter(r => r.status === 'fail' && (r.tier === 'major' || ['L1', 'L14'].includes(r.id))).forEach(r => r.items.forEach(i => flagged.add(i.id)));
  const ts = b.tasks.slice().sort((p, q) => (crit.has(q) - crit.has(p)) || (flagged.has(q.code) - flagged.has(p.code)) || (p.es - q.es)).slice(0, 25);
  el.innerHTML = `<div class="found"><b>${esc(b.label)}</b> · ${E.fmtDate(b.s)} – ${E.fmtDate(b.f)} · ${b.n} activities · ${b.crit} critical · ${b.flag} with a major finding<table class="tbl compact"><thead><tr><th>ID</th><th>Activity</th><th>Float (d)</th><th>Critical</th><th>Major finding</th></tr></thead><tbody>${ts.map(t => `<tr><td>${esc(t.code)}</td><td>${esc(t.name)}</td><td>${t.tfCal != null ? Math.round(t.tfCal) : ''}</td><td>${crit.has(t) ? 'yes' : ''}</td><td>${flagged.has(t.code) ? 'yes' : ''}</td></tr>`).join('')}</tbody></table><small class="hint">Showing the first ${ts.length}, critical first.</small></div>`;
}
document.addEventListener('click', e => { const g = e.target.closest('.dbar'); if (g) diagDetail(g.dataset.cell); });
