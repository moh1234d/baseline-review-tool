/* ===== APP PART 26 (v8.4): Recovery planner — switchable views of the delay train: Cards, A network, B parallel plots, D logic Gantt ===== */
/* v8.6: text is measured (canvas) so nothing runs outside its box */
const rpCv = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
const rpTw = (t, size, bold) => { if (rpCv) { rpCv.font = (bold ? '700 ' : '400 ') + size + 'px "Segoe UI", Arial, sans-serif'; return rpCv.measureText(t).width * 1.05; } return String(t).length * size * (bold ? .68 : .6); };
const rpFit = (t, maxW, size, bold) => { t = String(t); if (rpTw(t, size, bold) <= maxW) return t; while (t.length > 1 && rpTw(t + '…', size, bold) > maxW) t = t.slice(0, -1); return t.trim() + '…'; };
function rpWrapT(t, maxW, size, bold, maxLines) { const words = String(t).split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (rpTw(n, size, bold) <= maxW) cur = n; else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur);
  if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
  return lines.map((l, i) => i === lines.length - 1 ? rpFit(l, maxW, size, bold) : rpFit(l, maxW, size, bold)); }
const RPV = [['cards', 'Cards'], ['net', 'A · Network'], ['plots', 'B · Parallel plots'], ['gantt', 'D · Logic Gantt']];
const rpView = () => { const v = LS.get('brt.rpView', 'cards'); return RPV.some(x => x[0] === v) ? v : 'cards'; };
const rpPill = (x, y, w, txt, on) => `<rect x="${x}" y="${y}" width="${w}" height="15" rx="7.5" fill="${on ? '#2e8b57' : '#fff'}" stroke="#2e8b57"/><text x="${x + w / 2}" y="${y + 11}" font-size="9.5" font-weight="700" fill="${on ? '#fff' : '#2e8b57'}" text-anchor="middle">${esc(txt)}</text>`;
const rpLk = l => l.type + (l.lagWd ? (l.lagWd > 0 ? '+' : '−') + Math.abs(Math.round(l.lagWd * 10) / 10) : '');
const rpMark = '<defs><marker id="rpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5e6a7d"/></marker><marker id="rpt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2e8b57"/></marker></defs>';
/* stage box figures: delay added here, duration (current, baseline), lowest total float (P6), slip at the end */
const rpCardD = () => { const v = String(S.cfg.rpCard || 'A').trim().toUpperCase(); return 'ABC'.includes(v) && v.length === 1 ? v : 'A'; };
const rpNodeH = () => ({ A: 124, B: 128, C: 96 })[rpCardD()];
function rpCarStats(c) { const cur = c.rows.map(r => r.t).filter(Boolean), bas = c.rows.map(r => r.a).filter(Boolean), span = ts => { const a = ts.map(t => t.es).filter(v => v != null), b = ts.map(t => t.ef).filter(v => v != null); return a.length && b.length ? Math.round(Math.max(...b) - Math.min(...a)) : null; };
  const open = cur.filter(t => t.status !== 'TK_Complete' && t.tfWd != null), tf = open.length ? Math.min(...open.map(t => t.tfWd)) : null;
  return { dur: span(cur), bDur: span(bas), tf: tf == null ? null : Math.round(tf * 10) / 10, slip: c.slip, done: c.phase === 'done' }; }
const rpTfTxt = st => st.done ? 'done' : st.tf == null ? '–' : (st.tf < 0 ? '−' : '') + Math.abs(st.tf) + ' wd';
const rpTfCol = st => st.done || st.tf == null ? '#5e6a7d' : st.tf < 0 ? '#c0392b' : st.tf === 0 ? '#e08a1e' : '#2e8b57';
const rpCap = d => d >= 1 ? 'added here' : d <= -1 ? 'recovered here' : 'no change here';
const rpDcol = d => d >= 1 ? '#c0392b' : d <= -1 ? '#2e8b57' : '#5e6a7d';
const rpNode = (c, x, y, w, h, D, N, onSet, endName) => {
  const end = c.phase === 'end', fill = end ? '#1B2A41' : c.isOrigin ? '#fdf3f2' : c.phase === 'done' ? '#f0f2f6' : c.phase === 'now' ? '#fdf0dc' : '#ffffff', st = c.isOrigin ? '#c0392b' : c.phase === 'now' ? '#e08a1e' : end ? '#1B2A41' : '#b9c2d0', d = end ? (N.tg.slip || 0) : c.delta, col = end ? '#ffb4a8' : rpDcol(d), K = rpCardD();
  let s = `<g data-rpcar="${c.idx}" style="cursor:pointer"><title>${esc(c.title)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${st}" stroke-width="${c.isOrigin || c.phase === 'now' ? 2.5 : 1.3}"/>`;
  if (c.isOrigin) s += `<rect x="${x}" y="${y - 15}" width="118" height="14" rx="7" fill="#c0392b"/><text x="${x + 8}" y="${y - 5}" font-size="9" font-weight="700" fill="#fff">DELAY STARTS HERE</text>`;
  if (end) { rpWrapT(endName || N.tg.name, w - 18, 10.5, true, 2).forEach((ln, j) => { s += `<text x="${x + 9}" y="${y + 17 + j * 12}" font-size="10.5" font-weight="700" fill="#fff">${esc(ln)}</text>`; });
    s += `<text x="${x + 9}" y="${y + h - 12}" font-size="16" font-weight="800" fill="${col}">${rpDays(d)}</text>`;
    if (N.gain > 0) s += `<text x="${x + 9}" y="${y + h - 33}" font-size="9" fill="#c9d3e3">${esc(rpFit(RPD(N.tg.fB) + ' → ≈ ' + RPD(N.mit), w - 18, 9, false))}</text>`;
    return s + '</g>'; }
  const S2 = rpCarStats(c), dur = S2.dur == null ? '–' : S2.dur + ' d', tl = (t, mw, n) => rpWrapT(rpShort(c.title, 80), mw || w - 18, 10.5, true, n || 2);
  if (K === 'A') { tl().slice(0, 2).forEach((ln, j) => { s += `<text x="${x + 9}" y="${y + 16 + j * 12}" font-size="10.5" font-weight="700" fill="#1d2433">${esc(ln)}</text>`; });
    s += `<text x="${x + 9}" y="${y + 58}" font-size="19" font-weight="800" fill="${col}">${rpDays(d)}</text><text x="${x + 9}" y="${y + 70}" font-size="9" fill="#5e6a7d">${rpCap(d)}</text>`;
    const tw = (w - 18 - 8) / 3, tile = (i, lab, val, vc) => { const tx = x + 9 + i * (tw + 4); return `<rect x="${tx}" y="${y + 78}" width="${tw}" height="36" rx="6" fill="${c.isOrigin ? '#ffffff' : '#f1f4f8'}"/><text x="${tx + 6}" y="${y + 91}" font-size="7.5" letter-spacing=".4" fill="#5e6a7d">${lab}</text><text x="${tx + 6}" y="${y + 106}" font-size="11" font-weight="700" fill="${vc}">${esc(rpFit(val, tw - 8, 11, true))}</text>`; };
    s += tile(0, 'DURATION', dur, '#1d2433') + tile(1, 'TOTAL FLOAT', rpTfTxt(S2), rpTfCol(S2)) + tile(2, 'SLIP AT END', rpDays(S2.slip), rpDcol(S2.slip)); }
  else if (K === 'B') { tl().slice(0, 2).forEach((ln, j) => { s += `<text x="${x + 9}" y="${y + 16 + j * 12}" font-size="10.5" font-weight="700" fill="#1d2433">${esc(ln)}</text>`; });
    const rows = [[d <= -1 ? 'Recovered here' : 'Delay added here', rpDays(d), col], ['Duration (baseline → now)', (S2.bDur == null ? '–' : S2.bDur) + ' → ' + dur, '#1d2433'], ['Total float', rpTfTxt(S2), rpTfCol(S2)], ['Slip at end of stage', rpDays(S2.slip), rpDcol(S2.slip)]];
    rows.forEach(([l, v, vc], i) => { const yy = y + 42 + i * 21; s += `<line x1="${x + 9}" x2="${x + w - 9}" y1="${yy}" y2="${yy}" stroke="#e3e8ef"/><text x="${x + 9}" y="${yy + 14}" font-size="9.5" fill="#1d2433">${esc(rpFit(l, w - 90, 9.5, false))}</text><text x="${x + w - 9}" y="${yy + 14}" font-size="10.5" font-weight="700" fill="${vc}" text-anchor="end">${esc(v)}</text>`; }); }
  else { const bw = Math.max(54, rpTw(rpDays(d), 18, true), rpTw(rpCap(d).toUpperCase(), 7.5, false) * 1.08) + 8; tl(0, w - 18 - bw - 4, 3).slice(0, 3).forEach((ln, j) => { s += `<text x="${x + 9}" y="${y + 16 + j * 12}" font-size="10.5" font-weight="700" fill="#1d2433">${esc(ln)}</text>`; });
    s += `<text x="${x + w - 9}" y="${y + 24}" font-size="18" font-weight="800" fill="${col}" text-anchor="end">${rpDays(d)}</text><text x="${x + w - 9}" y="${y + 36}" font-size="7.5" letter-spacing=".4" fill="#5e6a7d" text-anchor="end">${rpCap(d).toUpperCase()}</text>`;
    const fy = y + h - 24, cw = w / 3; s += `<path d="M${x + 1} ${fy} H${x + w - 1} V${y + h - 8} a7 7 0 0 1 -7 7 H${x + 8} a7 7 0 0 1 -7 -7z" fill="${c.isOrigin ? '#fbe6e3' : '#f1f4f8'}"/><line x1="${x + 1}" x2="${x + w - 1}" y1="${fy}" y2="${fy}" stroke="#e3e8ef"/>`;
    [['Dur', dur, '#1d2433'], ['TF', rpTfTxt(S2), rpTfCol(S2)], ['Slip', rpDays(S2.slip), rpDcol(S2.slip)]].forEach(([l, v, vc], i) => { const cx = x + i * cw; if (i) s += `<line x1="${cx}" x2="${cx}" y1="${fy}" y2="${y + h - 1}" stroke="#e3e8ef"/>`; s += `<text x="${cx + 7}" y="${fy + 15}" font-size="9.5" fill="#1d2433">${l} <tspan font-weight="700" fill="${vc}">${esc(v)}</tspan></text>`; }); }
  if (D.lev) { const ls = D.lev.levers.map((l, i) => [l, i]).filter(([l, i]) => l.car === c.idx && l.gain > 0 && onSet !== 'twin'); const on = ls.filter(([l, i]) => D.levOn.has(i)); (on.length ? on : ls.slice(0, 1)).slice(0, 1).forEach(([l, i]) => { const t = l.label.split(' ')[0] + ' −' + l.gain + ' d', pw = rpTw(t, 9.5, true) + 14; s += rpPill(x + w - 8 - pw, y - 8, pw, t, D.levOn.has(i)); }); }
  return s + '</g>';
};
/* the link between two cars (the lever-changed one is preferred) */
function rpCarLink(D, a, b) {
  const ids = new Set(a.rows.map(r => r.t.id)); let found = null, changed = null;
  const chg = new Map(); if (D.lev) for (const i of D.levOn) for (const [l, nl] of D.lev.levers[i].ch.links) chg.set(l, nl);
  for (const r of b.rows) for (const l of (r.t.pre || [])) if (ids.has(l.from.id)) { if (chg.has(l)) { changed = changed || { old: rpLk(l), now: chg.get(l).map(rpLk).join(' & ') }; } else if (!found) found = { old: rpLk(l) }; }
  return changed || found || null;
}
/* ---------- A: precedence network (snake) ---------- */
function rpNetSvg(D) {
  const T = D.train, N = rpNums(D), cars = T.cars, per = 5, w = 205, h = rpNodeH(), gx = 70, gy = 92, W = per * w + (per - 1) * gx + 20, rows = Math.ceil(cars.length / per), H = rows * (h + gy) + 8;
  const pos = cars.map((c, i) => { const r = Math.floor(i / per), k = i % per, col = r % 2 ? per - 1 - k : k; return [10 + col * (w + gx), 24 + r * (h + gy), r]; });
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:760px" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  for (let i = 0; i < cars.length - 1; i++) { const [x, y, r] = pos[i], [x2, y2, r2] = pos[i + 1], lk = rpCarLink(D, cars[i], cars[i + 1]), ch = lk && lk.now; let d, lx, ly, an = 'middle';
    if (r === r2) { const rt = r % 2 === 0; d = rt ? `M${x + w} ${y + h / 2} L${x2} ${y2 + h / 2}` : `M${x} ${y + h / 2} L${x2 + w} ${y2 + h / 2}`; lx = (x + (rt ? w : 0) + (rt ? x2 : x2 + w)) / 2; ly = y + h / 2 - 8; }
    else { d = `M${x + w / 2} ${y + h} L${x2 + w / 2} ${y2}`; lx = x + w / 2 + 8; ly = y + h + gy / 2 + 3; an = 'start'; }
    s += `<path d="${d}" fill="none" stroke="${ch ? '#2e8b57' : '#5e6a7d'}" stroke-width="${ch ? 2.8 : 1.6}" ${ch ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#${ch ? 'rpt' : 'rpa'})"/>`;
    if (lk) s += `<text x="${lx}" y="${ly}" font-size="10" font-weight="${ch ? 700 : 500}" fill="${ch ? '#2e8b57' : '#5e6a7d'}" text-anchor="${an}">${esc(ch ? lk.old + ' → ' + lk.now : lk.old)}</text>`; }
  const rk = ((S.rp.paths || [])[S.rp.pathIdx || 0] || { rank: 1 }).rank;
  cars.forEach((c, i) => { s += rpNode(c, pos[i][0], pos[i][1], w, h, D, N).replace('<g data-rpcar=', `<g data-rpopen="${rk}:${c.idx}" data-rpcar=`); if (D.rpOpen && D.rpOpen.rank === rk && D.rpOpen.idx === c.idx) s += `<rect x="${pos[i][0] - 5}" y="${pos[i][1] - 5}" width="${w + 10}" height="${h + 10}" rx="11" fill="none" stroke="${RP_DD}" stroke-width="2.5" stroke-dasharray="7 4" pointer-events="none"/>`; });
  s += '</svg>';
  const oi = D.rpOpen && D.rpOpen.rank === rk ? cars.findIndex(c => c.idx === D.rpOpen.idx && c.phase !== 'end') : -1;
  if (oi >= 0) { const F = rpOpenFrame(cars[oi], cars[oi - 1], cars[oi + 1]); s += `<div class="rpv-scroll" style="margin-top:10px"><svg viewBox="0 0 ${F.w + 20} ${F.h + 20}" width="${F.w + 20}" style="width:calc(${F.w + 20}px * var(--rpz,100) / 100) !important" font-family="Segoe UI, Arial, sans-serif">${rpMark}${F.draw(10, 10, F.h > 140 ? 124 : F.h)}</svg></div>`; }
  return s;
}
/* ---------- B: the longest paths as lanes; activities they share (the junction) are drawn once, and where they meet again ---------- */
function rpPathTrains(R) {
  const key = (R.paths || []).map(p => p.code).join('|') + '|' + JSON.stringify(S.cfg.train || {}) + '|' + (R.pathIdx || 0) + '|' + (R.tr && R.tr.train ? R.tr.train.target.code : ''); if (R.ptKey === key && R.pt) return R.pt;
  R.pt = (R.paths || []).map((p, i) => { if (i === (R.pathIdx || 0) && R.tr && R.tr.train) return { p, T: R.tr.train, sel: true }; try { return { p, T: E.delayTrain(R.A.M, R.B.M, { targetCode: p.code, cfg: trCfg(), chain: p.rank > 1 ? p.chain : null, joins: p.rank > 1 ? p.joins : null }), sel: false }; } catch (e) { return { p, T: null, err: e.message }; } }); R.ptKey = key; return R.pt;
}
/* what the paths share: where each later path joins a higher one, the activities shared before the first car, and the link into the finish */
function rpInterfere(R) {
  const P = R.paths || [], L = rpPathTrains(R).filter(x => x.T), info = { lanes: L, joins: [], shared: [], ends: [] };
  if (!L.length) return info;
  L.forEach((x, r) => { if (!r || !x.p.joins) return; const jn = x.p.joins; let j = -1; for (let q = 0; q < r; q++) if (L[q].p.chain.some(t => t.id === jn.id)) { j = q; break; }
    if (j < 0) return; const car = L[j].T.cars.findIndex(c => c.rows.some(q => q.t.id === jn.id)), ix = L[j].p.chain.findIndex(t => t.id === jn.id); info.joins.push({ r, j, lane: x, parent: L[j], join: jn, car, carTitle: car >= 0 ? L[j].T.cars[car].title : null, ix }); });
  const top = info.joins.filter(q => q.j === 0 && q.car < 0), mx = top.length ? Math.max(...top.map(q => q.ix)) : -1; info.shared = mx >= 0 ? L[0].p.chain.slice(0, mx + 1) : [];
  const M = R.B.M, t0 = L[0].T ? M.tasks.find(t => t.code === L[0].T.target.code) : null;
  for (const x of L) { const lastC = x.T.cars[x.T.cars.length - 1], rr = lastC.rows.map(r => r.t), last = rr[rr.length - 1], pr = last === t0 ? rr[rr.length - 2] : last, lk = t0 && pr ? (t0.pre.find(l => l.from === pr) || null) : null; info.ends.push({ lane: x, last: pr || last, link: lk ? rpLk(lk) : null, isFinish: last === t0 }); }
  return info;
}
/* data date line: one look in every view - violet (used nowhere else), solid, white halo so it shows over boxes and bars */
const RP_DD = '#6d28d9';
const rpDDTag = (x, y, dd, W) => { const t = 'DATA DATE ' + dd, lw = rpTw(t, 9.5, true) + 18, lx = Math.max(2, Math.min(W - lw - 2, x - lw / 2)); return `<rect x="${lx}" y="${y}" width="${lw}" height="18" rx="9" fill="${RP_DD}" stroke="#fff" stroke-width="1.5"/><text x="${lx + 9}" y="${y + 12.5}" font-size="9.5" font-weight="800" fill="#fff">${esc(t)}</text>`; };
const rpDDLine = pts => { const p = pts.map(q => q.join(',')).join(' '); return `<polyline points="${p}" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" opacity=".9"/><polyline points="${p}" fill="none" stroke="${RP_DD}" stroke-width="3" stroke-linejoin="round"/>`; };
const rpDDMode = () => { const v = String(S.cfg.rpDDMode || 'align').trim().toLowerCase(); return ['align', 'mark', 'step', 'none'].includes(v) ? v : 'align'; };
const rpDDOf = () => { const M = S.rp && S.rp.B && S.rp.B.M; return M && M.dataDate != null ? M.dataDate : null; };
/* ---------- an opened card: its activities as small boxes, with the links between them and in / out ---------- */
const rpOpenPer = () => rpClamp(S.cfg.rpOpenPer, 3, 30, 12);
const rpLkTxt = ls => ls.map(l => l.type + (l.lagWd ? (l.lagWd > 0 ? '+' : '') + Math.round(l.lagWd * 10) / 10 : '')).join(' · ');
function rpOpenFrame(c, prev, next) {
  const rows = c.rows, n = rows.length, per = Math.min(n, rpOpenPer()), lines = Math.ceil(n / per), mw = 150, mh = 108, mg = 66, lg = 54, L0 = 50, R0 = 50, head = 46, bot = 56;
  const FW = L0 + per * mw + (per - 1) * mg + R0, FH = head + lines * mh + (lines - 1) * lg + bot, st = rpCarStats(c);
  const pos = rows.map((r, i) => [L0 + (i % per) * (mw + mg), head + Math.floor(i / per) * (mh + lg)]);
  const ids = new Map(rows.map((r, i) => [r.t, i]));
  const draw = (x, y, h) => { let s = `<g class="rp-open"><rect x="${x}" y="${y}" width="${FW}" height="${FH}" rx="12" fill="#f5f3ff" stroke="${RP_DD}" stroke-width="1.6" stroke-dasharray="7 4"/>`;
    s += `<text x="${x + 14}" y="${y + 19}" font-size="12" font-weight="800" fill="#4c1d95">${esc(rpFit('▾ ' + c.title + ' — ' + n + ' activit' + (n === 1 ? 'y' : 'ies'), FW - 140, 12, true))}</text>`;
    s += `<text x="${x + 14}" y="${y + 35}" font-size="10" fill="#5e6a7d">${esc('card total: ' + rpDays(c.delta) + ' ' + (c.delta <= -1 ? 'recovered' : c.delta >= 1 ? 'added' : 'no change') + ' · slip at end ' + rpDays(c.slip) + ' · lowest total float ' + rpTfTxt(st))}</text>`;
    s += `<g data-rpopen="close" style="cursor:pointer"><title>Close this card</title><rect x="${x + FW - 106}" y="${y + 9}" width="92" height="22" rx="11" fill="${RP_DD}"/><text x="${x + FW - 60}" y="${y + 24}" font-size="10.5" font-weight="700" fill="#fff" text-anchor="middle">Collapse ▴</text></g>`;
    rows.forEach((r, i) => { const t = r.t, [ax, ay] = pos[i], bx = x + ax, by = y + ay, ms = t.type === 'TT_Mile' || t.type === 'TT_FinMile', dur = t.es != null && t.ef != null ? Math.round(t.ef - t.es) : null, tf = t.status === 'TK_Complete' ? 'done' : t.tfWd == null ? '–' : (t.tfWd < 0 ? '−' : '') + Math.abs(Math.round(t.tfWd * 10) / 10) + ' wd', tfc = t.status === 'TK_Complete' || t.tfWd == null ? '#5e6a7d' : t.tfWd < 0 ? '#c0392b' : t.tfWd === 0 ? '#e08a1e' : '#2e8b57';
      const fill = t.status === 'TK_Complete' ? '#f0f2f6' : t.status === 'TK_Active' ? '#fdf0dc' : '#fff', stc = t.status === 'TK_Active' ? '#e08a1e' : '#b9c2d0';
      s += `<g><title>${esc(t.code + ' — ' + t.name)}</title><rect x="${bx}" y="${by}" width="${mw}" height="${mh}" rx="7" fill="${fill}" stroke="${stc}" stroke-width="${t.status === 'TK_Active' ? 2 : 1.2}"/><text x="${bx + 8}" y="${by + 13}" font-size="8" font-weight="700" fill="${RP_DD}">${esc(rpFit((ms ? '◆ ' : '') + t.code, mw - 16, 8, true))}</text>`;
      rpWrapT(t.name, mw - 16, 9.5, true, 3).forEach((ln, j) => { s += `<text x="${bx + 8}" y="${by + 26 + j * 11}" font-size="9.5" font-weight="700" fill="#1d2433">${esc(ln)}</text>`; });
      s += `<text x="${bx + 8}" y="${by + 66}" font-size="9" fill="#5e6a7d">${esc(rpFit(RPD(t.es) + (ms ? '' : ' → ' + RPD(t.ef)), mw - 16, 9, false))}</text><line x1="${bx + 6}" x2="${bx + mw - 6}" y1="${by + 74}" y2="${by + 74}" stroke="#e3e8ef"/>`;
      [['Dur', dur == null ? '–' : dur + ' d', '#1d2433'], ['TF', tf, tfc], ['Own', rpDays(r.own || 0), rpDcol(r.own || 0)]].forEach(([l, v, vc], k) => { const tx = bx + 8 + k * (mw - 16) / 3; s += `<text x="${tx}" y="${by + 88}" font-size="7.5" fill="#5e6a7d">${l}</text><text x="${tx}" y="${by + 100}" font-size="10" font-weight="700" fill="${vc}">${esc(v)}</text>`; });
      s += '</g>';
      if (i) { const [px0, py0] = pos[i - 1], ls = t.pre.filter(l => l.from === rows[i - 1].t), lab = rpLkTxt(ls);
        if (py0 === ay) { const x1 = x + px0 + mw, x2 = bx, yy = by + mh / 2; s += `<path d="M${x1} ${yy} L${x2 - 1} ${yy}" stroke="#1d2433" stroke-width="1.8" marker-end="url(#rpa)"/>${lab ? `<text x="${(x1 + x2) / 2}" y="${yy - 6}" font-size="9" font-weight="700" fill="#1d2433" text-anchor="middle">${esc(lab)}</text>` : ''}`; }
        else { const x1 = x + px0 + mw / 2, y1 = y + py0 + mh, ym = y1 + lg / 2, x2 = bx + mw / 2; s += `<path d="M${x1} ${y1} V${ym} H${x2} V${by - 1}" fill="none" stroke="#1d2433" stroke-width="1.8" marker-end="url(#rpa)"/>${lab ? `<text x="${x1 + 6}" y="${ym - 5}" font-size="9" font-weight="700" fill="#1d2433">${esc(lab)}</text>` : ''}`; } } });
    /* other links between activities of this card that are not the driving one (same line only, max 8) */
    let k = 0, more = 0; rows.forEach((r, j) => r.t.pre.forEach(l => { const i = ids.get(l.from); if (i == null || i === j - 1) return; if (pos[i][1] !== pos[j][1] || k >= 8) { more++; return; } k++;
      const a = x + pos[i][0] + mw / 2, b = x + pos[j][0] + mw / 2, yb = y + pos[i][1] + mh, dy = 22 + 8 * (k % 3); s += `<path d="M${a} ${yb} C${a} ${yb + dy} ${b} ${yb + dy} ${b} ${yb + 2}" fill="none" stroke="#8793a6" stroke-width="1.2" stroke-dasharray="4 4" marker-end="url(#rpa)"/><text x="${(a + b) / 2}" y="${yb + dy - 4}" font-size="8.5" fill="#5e6a7d" text-anchor="middle">${esc(rpLkTxt([l]))} · not driving</text>`; }));
    if (more) s += `<text x="${x + 14}" y="${y + FH - 8}" font-size="9" fill="#5e6a7d">+ ${more} other link${more === 1 ? '' : 's'} between these activities not drawn</text>`;
    /* in from the previous card, out to the next one */
    const f0 = rows[0].t, lin = prev ? f0.pre.filter(l => prev.rows.some(q => q.t === l.from)) : [], ym = y + h / 2, fy = y + pos[0][1] + mh / 2;
    s += `<path d="M${x} ${ym} H${x + L0 / 2} V${fy} H${x + L0 - 1}" fill="none" stroke="#c0392b" stroke-width="1.8" marker-end="url(#rpa)"/>`;
    if (lin.length) s += `<text x="${x + 4}" y="${Math.min(ym, fy) - 6}" font-size="9" font-weight="700" fill="#c0392b">${esc(rpLkTxt(lin))}<title>from ${esc(lin[0].from.code + ' — ' + lin[0].from.name)}</title></text>`;
    const lst = rows[n - 1].t, [lx, ly] = pos[n - 1], lout = next ? next.rows[0].t.pre.filter(l => l.from === lst) : [], ox = x + lx + mw, oy = y + ly + mh / 2;
    if (next) { s += `<path d="M${ox} ${oy} H${x + FW - R0 / 2} V${ym} H${x + FW}" fill="none" stroke="#1d2433" stroke-width="1.8"/>`; if (lout.length) s += `<text x="${ox + 6}" y="${oy - 6}" font-size="9" font-weight="700" fill="#1d2433">${esc(rpLkTxt(lout))}</text>`; }
    return s + '</g>'; };
  return { w: FW, h: FH, draw };
}
function rpPlotsSvg(D, R) {
  const N = rpNums(D), I = rpInterfere(R), L = I.lanes; if (!L.length) return '<p class="hint">No path available.</p>';
  const w = 196, h = rpNodeH(), gx = 30, gy = 58, selCars = new Set(D.train.cars.filter(c => D.lev && [...D.levOn].some(i => D.lev.levers[i].car === c.idx)).map(c => c.title));
  const lanesCars = L.map(x => x.T.cars.filter(c => !(c.phase === 'end' && (I.ends.find(e => e.lane === x) || {}).isFinish)));
  const trunk = I.shared.length > 0, k0 = trunk ? 1 : 0, off = L.map(() => k0), jOf = L.map((x, r) => I.joins.find(q => q.r === r) || null);
  L.forEach((x, r) => { const jn = jOf[r]; if (r && jn && jn.car >= 0) off[r] = off[jn.j] + jn.car + 1; });
  /* 'align' mode: shift each path sideways so its data date sits under Path 1's -> one straight data date line.
     Position in column units: inside the in-progress stage = its middle; otherwise the gap before the first stage to come. */
  const ddMode = rpDDMode(), U = w + gx, ddCol = r => { const cs = lanesCars[r]; if (!cs.length) return null; let k = cs.findIndex(c => c.phase === 'next' || c.phase === 'end'); if (k < 0) k = cs.length; return k > 0 && cs[k - 1].phase === 'now' ? off[r] + k - 1 + w / 2 / U : off[r] + k - gx / 2 / U; };
  const isBr = r => { const jn = jOf[r]; return !!(r && jn && jn.car >= 0); };
  if (ddMode === 'align') { const c0 = ddCol(0); if (c0 != null) { const dl = L.map((x, r) => !r || isBr(r) ? 0 : (ddCol(r) == null ? 0 : c0 - ddCol(r))), m = Math.min(0, ...dl);
      L.forEach((x, r) => { if (!isBr(r)) off[r] += dl[r] - m; }); L.forEach((x, r) => { const jn = jOf[r]; if (isBr(r)) off[r] = off[jn.j] + jn.car + 1; }); } }
  /* an opened card widens its column and makes its row taller; everything right of it / below it moves along */
  const OP = D.rpOpen && D.rpOpen.rank != null ? (() => { const r = L.findIndex(x => x.p.rank === D.rpOpen.rank); if (r < 0) return null; const i = lanesCars[r].findIndex(c => c.idx === D.rpOpen.idx); if (i < 0 || lanesCars[r][i].phase === 'end') return null; return { r, i, C: off[r] + i }; })() : null;
  const FR = OP ? rpOpenFrame(lanesCars[OP.r][OP.i], lanesCars[OP.r][OP.i - 1], lanesCars[OP.r][OP.i + 1]) : null, extH = FR ? Math.max(0, FR.h - h) : 0, Cw = w / U;
  const shR = new Set(OP ? [OP.r] : []); if (OP) L.forEach((x, r) => { const jn = jOf[r]; if (isBr(r) && shR.has(jn.j) && (jn.j !== OP.r || jn.car >= OP.i)) shR.add(r); });
  /* only the opened path (and paths branching off it after the box) move right; the finish column moves for all */
  const X = (c, r) => { if (!FR || c <= OP.C + 1e-6 || (r !== undefined && !shR.has(r))) return 8 + c * U; if (c < OP.C + 1) return 8 + OP.C * U + (c - OP.C) * (FR.w + gx); return 8 + c * U + (FR.w - w); };
  const cw = (r, i) => OP && r === OP.r && i === OP.i ? FR.w : w;
  const nCol = Math.ceil(Math.max(...lanesCars.map((c, r) => off[r] + c.length))) + 1, busGap = 64, W = Math.ceil(X(nCol)) + busGap + 2, rowH = h + gy, H = L.length * rowH + extH + 30;
  const px = (i, r) => X(i, r) + (i === nCol - 1 ? busGap : 0), py = r => 40 + r * rowH + (OP && r > OP.r ? extH : 0);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="width:calc(${W}px * var(--rpz,100) / 100) !important" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  const flo = p => (Math.round(Math.max(0, p.rel || 0) * 10) / 10) + ' wd';
  const endBox = (c, x, y, lane) => { const p = lane.p, sl = lane.T.target.slip || 0, z = !(p.rel > 0);
    return `<g data-rpcar="${c.idx}"><title>${esc(c.title)} — last activity of Path ${p.rank}. Its own slip (${rpDays(sl)}) is not a project delay while the path has float.</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f4f7fb" stroke="#1B2A41" stroke-width="1.4" stroke-dasharray="5 3"/><text x="${x + 9}" y="${y + 13}" font-size="8.5" font-weight="700" fill="#5e6a7d">END OF PATH ${p.rank}</text>${rpWrapT(c.title, w - 18, 10, true, 2).map((ln, i) => `<text x="${x + 9}" y="${y + 27 + i * 12}" font-size="10" font-weight="700" fill="#1d2433">${esc(ln)}</text>`).join('')}<text x="${x + 9}" y="${y + h - 21}" font-size="13.5" font-weight="800" fill="${z ? '#c0392b' : '#1B2A41'}">${z ? 'no float left' : esc(flo(p)) + ' float left'}</text><text x="${x + 9}" y="${y + h - 8}" font-size="9" fill="#5e6a7d">${esc(rpFit('own slip ' + rpDays(sl) + (z ? '' : ' · not a project delay'), w - 16, 9, false))}</text></g>`; };
  const nd = (c, x, y, sel, lane) => { if (c.phase === 'end' && lane.p.rank !== 1) return endBox(c, x, y, lane); let g = rpNode(c, x, y, w, h, sel ? D : { lev: null, levOn: new Set() }, sel ? N : { tg: lane.T.target, gain: 0 }, null, c.phase === 'end' ? c.title : null); if (!sel && c.phase !== 'end' && selCars.has(c.title)) g = g.replace('</g>', rpPill(x + w - 70, y - 8, 62, 'twin copy', true) + '</g>'); return g; };
  const tH = 108, tx = px(0), trunkRows = I.joins.filter(q => q.j === 0 && q.car < 0).map(q => q.r), ty = trunk ? (py(trunkRows[0]) + py(trunkRows[trunkRows.length - 1])) / 2 + h / 2 - tH / 2 : 0;
  if (trunk) { const a = I.shared[0], z = I.shared[I.shared.length - 1], l1 = rpWrapT(rpShort(a.name, 40) + ' → ' + rpShort(z.name, 60), w - 18, 10, true, 3), cnt = I.shared.length + ' activities' + (I.shared.every(q => q.status === 'TK_Complete') ? ' · all complete' : '');
    s += `<g><rect x="${tx}" y="${ty}" width="${w}" height="${tH}" rx="8" fill="#eef3fb" stroke="#1B2A41" stroke-width="2"/><text x="${tx + 9}" y="${ty + 16}" font-size="9" font-weight="700" fill="#1B2A41">SHARED BY ${1 + trunkRows.length} PATHS</text>${l1.map((ln, i) => `<text x="${tx + 9}" y="${ty + 32 + i * 12}" font-size="10" font-weight="700" fill="#1d2433">${esc(ln)}</text>`).join('')}<text x="${tx + 9}" y="${ty + tH - 24}" font-size="9" fill="#5e6a7d">${esc(rpFit(cnt, w - 18, 9, false))}</text><text x="${tx + 9}" y="${ty + tH - 11}" font-size="9" fill="#5e6a7d">${esc(rpFit('junction ' + z.code, w - 18, 9, false))}</text></g>`; }
  const finY = py(0) + h / 2, busX = px(nCol - 1) - busGap / 2 - 4;
  L.forEach((x, r) => { const y = py(r), cs = lanesCars[r]; const lp = x.p.rank === 1, ttl = lp ? 'Path 1 · no float · sets the finish date (' + rpDays(N.tg.slip || 0) + ')' + (x.sel ? '' : '') : 'Path ' + x.p.rank + (x.sel ? ' (selected)' : '') + (x.p.rel > 0 ? ' · not driving · can slip ' + flo(x.p) + ' more before it delays the finish' : ' · no float left · any further slip delays the finish') + ' · ends at ' + x.p.name, hx = px(off[r], r);
    if (lp) s += `<rect x="3" y="${y - 40}" width="${W - 6}" height="${h + 52 + (OP && r === OP.r ? extH : 0)}" rx="10" fill="#fdf3f2" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="6 4"/><rect x="${hx}" y="${y - 36}" width="96" height="16" rx="8" fill="#c0392b"/><text x="${hx + 8}" y="${y - 24.5}" font-size="9.5" font-weight="800" fill="#fff">LONGEST PATH</text>`;
    s += `<text x="${hx + (lp ? 104 : 0)}" y="${y - 24}" font-size="11" font-weight="700" fill="${lp ? '#c0392b' : '#1d2433'}"><title>${esc(ttl)}</title>${esc(rpFit(ttl, Math.max(w, W - hx - (lp ? 120 : 16)), 11, true))}</text>`;
    cs.forEach((c, i) => { const xx = px(off[r] + i, r); s += OP && r === OP.r && i === OP.i ? FR.draw(xx, y, h) : nd(c, xx, y, x.sel, x).replace('<g data-rpcar=', `<g data-rpopen="${x.p.rank}:${c.idx}" data-rpcar=`); if (i) s += `<path d="M${px(off[r] + i - 1, r) + cw(r, i - 1)} ${y + h / 2} L${xx} ${y + h / 2}" stroke="#5e6a7d" stroke-width="1.6" marker-end="url(#rpa)"/>`; });
    const jn = jOf[r]; if (r && cs.length && jn) {
      if (jn.car >= 0) { const x1 = px(off[jn.j] + jn.car, jn.j) + cw(jn.j, jn.car), y1 = py(jn.j) + h * 0.8, gxm = x1 + gx / 2, x2 = px(off[r], r), y2 = y + h / 2; s += `<path d="M${x1} ${y1} H${gxm} V${y2} H${x2}" fill="none" stroke="#1B2A41" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#rpt)"/>`; }
      else if (trunk) { const x1 = tx + w, y1 = ty + tH / 2, x2 = px(off[r], r), y2 = y + h / 2, mx = x1 + (x2 - x1) / 2; s += `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="#1B2A41" stroke-width="2.2" marker-end="url(#rpt)"/>`; } }
    else if (!r && trunk && cs.length) { const x1 = tx + w, y1 = ty + tH / 2, x2 = px(off[0], 0), y2 = y + h / 2, mx = x1 + (x2 - x1) / 2; s += `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="#1B2A41" stroke-width="2.2" marker-end="url(#rpt)"/>`; } });
  const fx = px(nCol - 1), fh = h, fy = finY - fh / 2, tg = N.tg;
  s += `<g><rect x="${fx}" y="${fy}" width="${w}" height="${fh}" rx="8" fill="#1B2A41"/><text x="${fx + 9}" y="${fy + 16}" font-size="9" font-weight="700" fill="#c9d3e3">PROJECT FINISH</text>${rpWrapT(tg.name, w - 18, 10.5, true, 2).map((ln, i) => `<text x="${fx + 9}" y="${fy + 32 + i * 12}" font-size="10.5" font-weight="700" fill="#fff">${esc(ln)}</text>`).join('')}<text x="${fx + 9}" y="${fy + fh - 12}" font-size="16" font-weight="800" fill="#ffb4a8">${rpDays(tg.slip || 0)}</text></g>`;
  const ys = L.map((x, r) => py(r) + h / 2);
  L.forEach((x, r) => { const e = I.ends.find(q => q.lane === x), last = lanesCars[r].length - 1; if (last < 0) return; const xr = px(off[r] + last, r) + cw(r, last);
    if (x.p.rank === 1) s += `<path d="M${xr} ${ys[r]} H${r === 0 ? fx : busX}${r === 0 ? '' : ' V' + ys[0]}" fill="none" stroke="#c0392b" stroke-width="2.4" ${r === 0 ? 'marker-end="url(#rpa)"' : ''}/>`; else { s += `<path d="M${xr} ${ys[r]} H${busX} V${ys[0]}" fill="none" stroke="#8793a6" stroke-width="1.4" stroke-dasharray="5 4"/>`; const jt = (x.p.rel > 0 ? flo(x.p) + ' float' : 'no float') + (x.p.into ? ' · joins at ' + x.p.into.code : ''); s += `<text x="${xr + 10}" y="${ys[r] - 6}" font-size="9.5" font-weight="700" fill="#5e6a7d">${esc(rpFit(jt, Math.max(60, busX - xr - 60), 9.5, true))}</text>`; }
    if (e && e.link) s += `<text x="${busX - 6}" y="${ys[r] - 6}" font-size="9.5" font-weight="700" fill="#5e6a7d" text-anchor="end">${esc(e.link)}</text>`; });
  /* data date line: columns are stages, so it steps from row to row, P6 progress-line style.
     In-progress stage -> through its middle; otherwise in the gap before the first stage still to come. */
  { const mode = rpDDMode(), dd = rpDDOf() != null ? RPD(rpDDOf()) : '';
    if (mode === 'mark') L.forEach((x, r) => { const cs = lanesCars[r]; if (!cs.length) return; let k = cs.findIndex(c => c.phase === 'next' || c.phase === 'end'); if (k < 0) k = cs.length; const y = py(r), jn = jOf[r];
      if (k === 0 && r && jn && jn.car >= 0) { const t = 'ALL TO COME · data date is on Path ' + jn.parent.p.rank, tw = rpTw(t, 8.5, true) + 14, x0 = px(off[r], r); s += `<g pointer-events="none"><rect x="${x0}" y="${y + h + 4}" width="${tw}" height="15" rx="7.5" fill="#fff" stroke="${RP_DD}" stroke-width="1.2"/><text x="${x0 + 7}" y="${y + h + 14.5}" font-size="8.5" font-weight="800" fill="${RP_DD}">${esc(t)}</text></g>`; return; }
      const xx = Math.max(4, k > 0 && cs[k - 1].phase === 'now' ? X(off[r] + k - 1 + w / 2 / U, r) : px(off[r] + k, r) - gx / 2);
      s += `<g pointer-events="none">${rpDDLine([[xx, y - 10], [xx, y + h + 6]])}${rpDDTag(xx, y + h + 4, dd, W)}</g>`; });
    else if (mode === 'align') { const c0 = ddCol(0); if (c0 != null) { const xx = X(c0, 0), y0 = py(0) - 30, y1 = py(L.length - 1) + h + (OP && OP.r === L.length - 1 ? extH : 0) + 10; s += `<g pointer-events="none">${rpDDLine([[xx, y0], [xx, y1]])}${rpDDTag(xx, y1 + 2, dd, W)}</g>`; } }
    else if (mode === 'step') { const pts = []; L.forEach((x, r) => { const cs = lanesCars[r]; if (!cs.length) return; let k = cs.findIndex(c => c.phase === 'next' || c.phase === 'end'); if (k < 0) k = cs.length; const y = py(r);
      const xx = k > 0 && cs[k - 1].phase === 'now' ? X(off[r] + k - 1 + w / 2 / U, r) : px(off[r] + k, r) - gx / 2; const xc = Math.max(4, xx); if (pts.length) pts.push([xc, pts[pts.length - 1][1]]); pts.push([xc, y - 10], [xc, y + h + 14]); });
      if (pts.length) s += `<g pointer-events="none">${rpDDLine(pts)}${rpDDTag(pts[pts.length - 1][0], pts[pts.length - 1][1] + 4, dd, W)}</g>`; } }
  return s + '</svg>';
}
function rpInterfereHtml(R) {
  const I = rpInterfere(R); if (!I.lanes.length) return '';
  const j = I.joins, sh = I.shared, row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  let t = '';
  if (sh.length) t += row('Shared start', `${sh.length} activit${sh.length === 1 ? 'y' : 'ies'}, from ${esc(rpShort(sh[0].name, 40))} (${esc(sh[0].code)}) to <b>${esc(rpShort(sh[sh.length - 1].name, 50))}</b> (${esc(sh[sh.length - 1].code)})${sh.every(a => a.status === 'TK_Complete') ? ' · all complete' : ''}`);
  if (j.length) j.forEach(q => { t += row(`Path ${q.lane.p.rank} splits`, `from Path ${q.parent.p.rank} at <b>${esc(q.join.code)}</b> — ${esc(rpShort(q.join.name, 60))}${q.car >= 0 ? ` (inside “${esc(rpShort(q.carTitle, 50))}”)` : ''}`); });
  else if (I.lanes.length > 1) t += row('Where the paths split', 'No activity is shared between the paths shown.');
  if (I.lanes.length > 1) t += row('Where they meet again', esc(I.ends.map(e => `Path ${e.lane.p.rank}${e.isFinish ? ' → finish' + (e.link ? ' by ' + e.link : '') : e.link ? ' → finish by ' + e.link : ' ends at ' + e.last.code}`).join(' · ')));
  t += row('How the paths are traced', 'Each later path is traced back through the driving links until it reaches an activity of a higher path (as in Delay analysis), so the activities shown in each lane do not repeat. Other, non-driving links between the plots are not drawn.');
  return `<table class="tbl rpv-int"><tbody>${t}</tbody></table>`;
}
/* ---------- D: logic Gantt — baseline, current and with-levers bars ---------- */
function rpGanttSvg(D) {
  const T = D.train, N = rpNums(D), r0 = D.comb && D.comb.r0, r1 = D.comb && D.comb.r1, cars = T.cars.filter(c => c.phase !== 'end');
  const sh = (t, w) => { const d = w === 's' ? t.es : t.ef; if (d == null || !r0 || !r1) return d; const a = (w === 's' ? r0.es : r0.ef).get(t.id), b = (w === 's' ? r1.es : r1.ef).get(t.id); return a == null || b == null ? d : d + (b - a); };
  const mm = (arr) => { const v = arr.filter(x => x != null); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
  const st = cars.map(c => { const ts = c.rows.map(r => r.t), bs = c.rows.map(r => r.a).filter(Boolean); const cur = mm(ts.flatMap(t => [t.es, t.ef])), bas = mm(bs.flatMap(t => [t.es, t.ef])), lv = mm(ts.flatMap(t => [sh(t, 's'), sh(t, 'f')])); return { c, cur, bas, lv, moved: lv && cur && (Math.abs(lv[1] - cur[1]) >= 1 || Math.abs(lv[0] - cur[0]) >= 1) }; });
  const all = st.flatMap(x => [x.cur, x.bas, x.lv]).filter(Boolean).flat().concat([N.tg.fB, N.tg.fA || N.tg.fB, N.mit]), lo = Math.min(...all) - 8, hi = Math.max(...all) + 14;
  const W = Math.max(820, rpLay().f || 1180), L = Math.min(rpLabW() + 62, Math.floor(W * 0.5)), R = 60, top = 44, rh = 44, H = top + (cars.length + 1) * rh + 70, X = d => L + (d - lo) * (W - L - R) / (hi - lo);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:820px" data-rplo="62" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  const d0 = new Date(lo * 864e5), mon = Math.max(1, Math.round((hi - lo) / 30 / 9));
  for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1; ; m += mon) { const dd = Date.UTC(y, m, 1) / 864e5; if (dd > hi) break; if (dd < lo) continue; const x = X(dd); s += `<line x1="${x}" x2="${x}" y1="${top - 8}" y2="${H - 30}" stroke="#eef0f4"/><text x="${x}" y="${top - 14}" font-size="10" fill="#5e6a7d" text-anchor="middle">${new Date(dd * 864e5).toLocaleString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</text>`; }
  st.forEach((x, i) => { const c = x.c, y = top + i * rh;
    s += `<g data-rpcar="${c.idx}" style="cursor:pointer"><title>${esc(c.title)}</title>${(() => { const ln = rpWrapT(rpShort(c.title, 160), L - 16, 11, true, 2), y0 = ln.length > 1 ? y + 13 : y + 17; return ln.map((t, j) => `<text x="${L - 8}" y="${y0 + j * 12}" font-size="11" font-weight="700" text-anchor="end" fill="#1d2433">${esc(t)}</text>`).join('') + `<text x="${L - 8}" y="${y0 + ln.length * 12 + 1}" font-size="9.5" text-anchor="end" fill="${c.delta >= 1 ? '#c0392b' : c.delta <= -1 ? '#2e8b57' : '#5e6a7d'}" font-weight="700">${rpDays(c.delta)}${c.isOrigin ? ' · origin' : ''}</text>`; })()}`;
    if (x.bas) s += `<rect x="${X(x.bas[0])}" y="${y + 3}" width="${Math.max(3, X(x.bas[1]) - X(x.bas[0]))}" height="7" rx="2" fill="#fff" stroke="#8793a6"/>`;
    if (x.cur) { const f = c.isOrigin ? '#c0392b' : c.phase === 'done' ? '#9aa6b8' : c.phase === 'now' ? '#e08a1e' : '#cfd6e2'; s += `<rect x="${X(x.cur[0])}" y="${y + 13}" width="${Math.max(3, X(x.cur[1]) - X(x.cur[0]))}" height="${x.moved ? 9 : 15}" rx="3" fill="${x.moved ? 'none' : f}" stroke="${x.moved ? '#8793a6' : '#5e6a7d'}" ${x.moved ? 'stroke-dasharray="4 3"' : ''}/>`; }
    if (x.moved) s += `<rect x="${X(x.lv[0])}" y="${y + 22}" width="${Math.max(3, X(x.lv[1]) - X(x.lv[0]))}" height="10" rx="3" fill="#2e8b57"/>`;
    s += '</g>';
    if (i < st.length - 1 && x.cur && st[i + 1].cur) { const a = x.moved ? x.lv[1] : x.cur[1], b = st[i + 1].moved ? st[i + 1].lv[0] : st[i + 1].cur[0], y1 = y + (x.moved ? 27 : 20), y2 = top + (i + 1) * rh + (st[i + 1].moved ? 27 : 20), ch = x.moved || st[i + 1].moved;
      s += `<path d="M${X(a)} ${y1} H${X(a) + 7} V${y2} H${Math.max(X(b), X(a) + 8)}" fill="none" stroke="${ch ? '#2e8b57' : '#8793a6'}" stroke-width="1.2" ${ch ? 'stroke-dasharray="4 3"' : ''} marker-end="url(#${ch ? 'rpt' : 'rpa'})"/>`; } });
  const y = top + st.length * rh; s += `<text x="${L - 8}" y="${y + 20}" font-size="11" font-weight="700" text-anchor="end">${esc(dtr(N.tg.name, 30))}</text>`;
  const dia = (d, col, fill) => `<path d="M${X(d)} ${y + 8} l8 9 l-8 9 l-8 -9z" fill="${fill}" stroke="${col}" stroke-width="2"/>`;
  if (N.tg.fA != null) s += dia(N.tg.fA, '#1B2A41', '#fff') + `<text x="${X(N.tg.fA)}" y="${y + 42}" font-size="10" text-anchor="end" fill="#1B2A41">baseline ${esc(RPD(N.tg.fA))}</text>`;
  s += dia(N.tg.fB, '#c0392b', '#c0392b') + `<text x="${X(N.tg.fB)}" y="${y + 66}" font-size="10" font-weight="700" text-anchor="end" fill="#c0392b">now ${esc(RPD(N.tg.fB))}</text>`;
  if (N.gain > 0) s += dia(N.mit, '#2e8b57', '#2e8b57') + `<text x="${X(N.mit)}" y="${y + 54}" font-size="10" font-weight="700" text-anchor="end" fill="#2e8b57">levers ${esc(RPD(N.mit))}</text><path d="M${X(N.tg.fB) - 12} ${y + 17} H${X(N.mit) + 12}" stroke="#2e8b57" stroke-width="2.5" marker-end="url(#rpt)"/>`;
  s += `<rect x="${L}" y="${H - 18}" width="14" height="6" fill="#fff" stroke="#8793a6"/><text x="${L + 19}" y="${H - 11}" font-size="10" fill="#5e6a7d">baseline</text><rect x="${L + 80}" y="${H - 19}" width="14" height="8" fill="#cfd6e2" stroke="#5e6a7d"/><text x="${L + 99}" y="${H - 11}" font-size="10" fill="#5e6a7d">current (dashed when a lever moves it)</text><rect x="${L + 300}" y="${H - 19}" width="14" height="8" fill="#2e8b57"/><text x="${L + 319}" y="${H - 11}" font-size="10" fill="#5e6a7d">with the switched-on levers</text>`;
  { const dv = rpDDOf(); if (dv != null && dv >= lo && dv <= hi) { const x = X(dv); s += `<g pointer-events="none">${rpDDLine([[x, top - 6], [x, H - 34]])}${rpDDTag(x, H - 32, RPD(dv), W)}</g>`; } }
  return s + rpLabH(L, H - 24, 62, top - 10) + '</svg>';
}
function rpVisual(D, R, T, car) {
  const v = rpView(), K = rpCardD(), bar = `<div class="rpv-bar">${RPV.map(([k, t]) => `<button type="button" class="btn sm ${v === k ? 'primary' : ''}" data-rpview="${k}">${t}</button>`).join('')}${v !== 'gantt' ? `<span class="rpv-sep" title="Card design: A = big number with tiles · B = labelled rows · C = compact with footer strip">Card</span>${['A', 'B', 'C'].map(k => `<button type="button" class="btn sm ${K === k ? 'primary' : ''}" data-rpcard="${k}" title="${{ A: 'Big number with three tiles', B: 'Labelled rows', C: 'Compact with footer strip' }[k]}">${k}</button>`).join('')}` : ''}<button type="button" class="btn sm rpv-full" data-rpfull="1" title="${rpFull ? 'Back to the normal size (Esc)' : 'Fill the page with this chart'}">${rpFull ? '⤡ Collapse' : '⤢ Expand'}</button></div>`;
  if (D.levBusy && v !== 'cards') return bar + '<p class="hint">Testing the levers…</p>';
  try {
    if (v === 'net') return bar + `<div class="rpv-scroll">${rpNetSvg(D)}</div><p class="hint rpv-note">Boxes are the cars; arrows are the real driving links (type and lag). Dashed green = a link the switched-on levers change. Click a box for its activities.</p>`;
    if (v === 'plots') return bar + `<div class="rpv-scroll">${rpPlotsSvg(D, R)}</div>${rpInterfereHtml(R)}<p class="hint rpv-note"><b>The longest path is the one with no float to the finish, not the one with the biggest slip.</b> It is the red band. ${(rpDDMode()) === 'none' ? 'The data date is shown in the Logic Gantt, which has a time scale.' : (rpDDMode()) === 'align' ? 'The violet line is the data date. Each path is shifted sideways so its data date sits on the same line as Path 1: left of the line = done, a box it crosses = in progress, right of it = to come. Columns are stages, not equal lengths of time.' : 'The violet mark is the data date on each path (left of it = done, a box it crosses = in progress). A path that branches off another with all its own stages still to come has no mark: its data date is on the path it branches from.'} Every other path shows the float it still has; the slip of its last activity delays the project only after that float is used. Activities that two or more paths run through are drawn once (blue box) and the arrows show where the paths split and meet again (scroll sideways for the finish). “Twin copy” = the same activity in another plot, which receives the lever too. Click a box to open it into its activities and links; Collapse closes it.</p>`;
    if (v === 'gantt') return bar + `<div class="rpv-scroll">${rpGanttSvg(D)}</div><p class="hint rpv-note">One bar per car from the real dates: hollow = baseline, grey = current, green = with the switched-on levers. Switch levers on or off at the right and the green bars and finish move.</p>`;
  } catch (e) { console.error(e); return bar + `<p class="hint">This view could not be drawn: ${esc(e.message)}. Switch to Cards.</p><div class="tr-train rp-row">${T.cars.map(car).join('')}</div>`; }
  return bar + `<div class="tr-train rp-row">${T.cars.map(car).join('')}</div>`;
}
document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('[data-rpopen]'); if (!g) return; e.stopPropagation(); const D = trSt('rp'), v = g.dataset.rpopen;
  if (v === 'close') D.rpOpen = null; else { const [rank, idx] = v.split(':').map(Number); D.rpOpen = D.rpOpen && D.rpOpen.rank === rank && D.rpOpen.idx === idx ? null : { rank, idx }; }
  const sc = document.querySelector('.rpv-scroll'), sl = sc ? sc.scrollLeft : 0; trRender('rp'); const sc2 = document.querySelector('.rpv-scroll'); if (sc2) sc2.scrollLeft = sl; }, true);
let rpFull = false;
const rpFullSet = on => { rpFull = !!on; document.body.classList.toggle('rp-noscroll', rpFull); if (S.step === 'recovery') { const y = window.scrollY; viewRecovery(); if (!rpFull) window.scrollTo(0, y); } };
document.addEventListener('click', e => { const f = e.target.closest && e.target.closest('[data-rpfull]'); if (f) { rpFullSet(!rpFull); return; } const k = e.target.closest && e.target.closest('[data-rpcard]'); if (k) { S.cfg.rpCard = k.dataset.rpcard; try { autosave(); } catch (x) { } const sc = document.querySelector('.rp-full'), st = sc ? sc.scrollTop : 0, y = window.scrollY; viewRecovery(); window.scrollTo(0, y); const sc2 = document.querySelector('.rp-full'); if (sc2) sc2.scrollTop = st; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && rpFull) rpFullSet(false); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpview]'); if (!b) return; LS.set('brt.rpView', b.dataset.rpview); if (S.step === 'recovery') { const y = window.scrollY; viewRecovery(); window.scrollTo(0, y); } });
