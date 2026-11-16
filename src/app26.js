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
const rpNode = (c, x, y, w, h, D, N, onSet, endName) => {
  const end = c.phase === 'end', fill = end ? '#1B2A41' : c.isOrigin ? '#fdf3f2' : c.phase === 'done' ? '#f0f2f6' : c.phase === 'now' ? '#fdf0dc' : '#ffffff', st = c.isOrigin ? '#c0392b' : c.phase === 'now' ? '#e08a1e' : end ? '#1B2A41' : '#b9c2d0', d = end ? (N.tg.slip || 0) : c.delta, col = end ? '#ffb4a8' : d >= 1 ? '#c0392b' : d <= -1 ? '#2e8b57' : '#5e6a7d';
  const lines = rpWrapT(end ? (endName || N.tg.name) : rpShort(c.title, 80), w - 18, 10.5, true, end ? 2 : 3);
  let s = `<g data-rpcar="${c.idx}" style="cursor:pointer"><title>${esc(c.title)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${st}" stroke-width="${c.isOrigin || c.phase === 'now' ? 2.5 : 1.3}"/>`;
  if (c.isOrigin) s += `<rect x="${x}" y="${y - 15}" width="118" height="14" rx="7" fill="#c0392b"/><text x="${x + 8}" y="${y - 5}" font-size="9" font-weight="700" fill="#fff">DELAY STARTS HERE</text>`;
  lines.slice(0, 2).forEach((ln, j) => { s += `<text x="${x + 9}" y="${y + 17 + j * 12}" font-size="10.5" font-weight="700" fill="${end ? '#fff' : '#1d2433'}">${esc(ln)}</text>`; });
  s += `<text x="${x + 9}" y="${y + h - 12}" font-size="16" font-weight="800" fill="${col}">${rpDays(d)}</text>`;
  if (end && N.gain > 0) s += `<text x="${x + 9}" y="${y + h - 33}" font-size="9" fill="#c9d3e3">${esc(rpFit(RPD(N.tg.fB) + ' → ≈ ' + RPD(N.mit), w - 18, 9, false))}</text>`;
  if (!end && D.lev) { const ls = D.lev.levers.map((l, i) => [l, i]).filter(([l, i]) => l.car === c.idx && l.gain > 0 && (onSet === 'twin' ? false : true)); const on = ls.filter(([l, i]) => D.levOn.has(i)); const shown = (on.length ? on : ls.slice(0, 1)); shown.slice(0, 1).forEach(([l, i]) => { const t = l.label.split(' ')[0] + ' −' + l.gain + ' d', pw = rpTw(t, 9.5, true) + 14; s += rpPill(x + w - 8 - pw, y + h - 22, pw, t, D.levOn.has(i)); }); }
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
  const T = D.train, N = rpNums(D), cars = T.cars, per = 5, w = 205, h = 78, gx = 70, gy = 92, W = per * w + (per - 1) * gx + 20, rows = Math.ceil(cars.length / per), H = rows * (h + gy) + 8;
  const pos = cars.map((c, i) => { const r = Math.floor(i / per), k = i % per, col = r % 2 ? per - 1 - k : k; return [10 + col * (w + gx), 24 + r * (h + gy), r]; });
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:760px" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  for (let i = 0; i < cars.length - 1; i++) { const [x, y, r] = pos[i], [x2, y2, r2] = pos[i + 1], lk = rpCarLink(D, cars[i], cars[i + 1]), ch = lk && lk.now; let d, lx, ly, an = 'middle';
    if (r === r2) { const rt = r % 2 === 0; d = rt ? `M${x + w} ${y + h / 2} L${x2} ${y2 + h / 2}` : `M${x} ${y + h / 2} L${x2 + w} ${y2 + h / 2}`; lx = (x + (rt ? w : 0) + (rt ? x2 : x2 + w)) / 2; ly = y + h / 2 - 8; }
    else { d = `M${x + w / 2} ${y + h} L${x2 + w / 2} ${y2}`; lx = x + w / 2 + 8; ly = y + h + gy / 2 + 3; an = 'start'; }
    s += `<path d="${d}" fill="none" stroke="${ch ? '#2e8b57' : '#5e6a7d'}" stroke-width="${ch ? 2.8 : 1.6}" ${ch ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#${ch ? 'rpt' : 'rpa'})"/>`;
    if (lk) s += `<text x="${lx}" y="${ly}" font-size="10" font-weight="${ch ? 700 : 500}" fill="${ch ? '#2e8b57' : '#5e6a7d'}" text-anchor="${an}">${esc(ch ? lk.old + ' → ' + lk.now : lk.old)}</text>`; }
  cars.forEach((c, i) => { s += rpNode(c, pos[i][0], pos[i][1], w, h, D, N); });
  return s + '</svg>';
}
/* ---------- B: the longest paths as lanes; activities they share (the junction) are drawn once, and where they meet again ---------- */
function rpPathTrains(R) {
  const key = (R.paths || []).map(p => p.code).join('|') + '|' + JSON.stringify(S.cfg.train || {}) + '|' + (R.pathIdx || 0) + '|' + (R.tr && R.tr.train ? R.tr.train.target.code : ''); if (R.ptKey === key && R.pt) return R.pt;
  R.pt = (R.paths || []).map((p, i) => { if (i === (R.pathIdx || 0) && R.tr && R.tr.train) return { p, T: R.tr.train, sel: true }; try { return { p, T: E.delayTrain(R.A.M, R.B.M, { targetCode: p.code, cfg: trCfg(), chain: p.rank > 1 ? p.chain : null, joins: p.rank > 1 ? p.joins : null }), sel: false }; } catch (e) { return { p, T: null, err: e.message }; } }); R.ptKey = key; return R.pt;
}
/* what the paths share: the junction activity, the activities before it, and the link into the finish */
function rpInterfere(R) {
  const P = R.paths || [], L = rpPathTrains(R).filter(x => x.T), info = { lanes: L, joins: [], shared: [], ends: [] };
  const p1 = P[0]; if (!p1) return info;
  for (const x of L) if (x.p.joins) { const j = x.p.joins, ix = p1.chain.findIndex(t => t.id === j.id); info.joins.push({ lane: x, join: j, ix }); }
  const mx = info.joins.length ? Math.max(...info.joins.map(j => j.ix)) : -1; info.shared = mx >= 0 ? p1.chain.slice(0, mx + 1) : [];
  const tg = R.tr && R.tr.train ? null : null, M = R.B.M, t0 = L[0] && L[0].T ? M.tasks.find(t => t.code === L[0].T.target.code) : null;
  for (const x of L) { const last = x.T.cars[x.T.cars.length - 1].rows[x.T.cars[x.T.cars.length - 1].rows.length - 1].t; const lastC = x.T.cars[x.T.cars.length - 1], rr = lastC.rows.map(r => r.t), pr = last === t0 ? rr[rr.length - 2] : last, lk = t0 && pr ? (t0.pre.find(l => l.from === pr) || null) : null; info.ends.push({ lane: x, last: pr || last, link: lk ? rpLk(lk) : null, isFinish: last === t0 }); }
  return info;
}
function rpPlotsSvg(D, R) {
  const N = rpNums(D), I = rpInterfere(R), L = I.lanes; if (!L.length) return '<p class="hint">No path available.</p>';
  const w = 156, h = 84, gx = 30, gy = 58, selCars = new Set(D.train.cars.filter(c => D.lev && [...D.levOn].some(i => D.lev.levers[i].car === c.idx)).map(c => c.title));
  const p1 = (R.paths || [])[0], trunk = I.shared.length > 0 && L[0].T && I.joins.every(j => j.ix >= 0), startIx = p1 && L[0].T.rows.length ? p1.chain.findIndex(t => t.id === L[0].T.rows[0].t.id) : -1;
  const inside = trunk && startIx >= 0 && I.shared.length - 1 >= startIx;  /* junction lies inside lane 1's own cars */
  const lanesCars = L.map(x => x.T.cars.filter(c => !(c.phase === 'end' && (I.ends.find(e => e.lane === x) || {}).isFinish)));
  const k0 = trunk && !inside ? 1 : 0, maxLen = Math.max(...lanesCars.map(c => c.length)), nCol = k0 + maxLen + 1, busGap = 64, W = nCol * (w + gx) + busGap + 10, rowH = h + gy, H = L.length * rowH + 30;
  const px = i => 8 + i * (w + gx) + (i === nCol - 1 ? busGap : 0), py = r => 40 + r * rowH, mid = (L.length - 1) / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  const nd = (c, x, y, sel, lane) => { let g = rpNode(c, x, y, w, h, sel ? D : { lev: null, levOn: new Set() }, sel ? N : { tg: lane.T.target, gain: 0 }, null, c.phase === 'end' ? c.title : null); if (!sel && c.phase !== 'end' && selCars.has(c.title)) g = g.replace('</g>', rpPill(x + w - 70, y + h - 22, 62, 'twin copy', true) + '</g>'); return g; };
  /* shared start (blue box) */
  const tH = 108, tx = px(0), ty = py(mid) + h / 2 - tH / 2;
  if (k0) { const a = I.shared[0], z = I.shared[I.shared.length - 1], l1 = rpWrapT(rpShort(a.name, 40) + ' → ' + rpShort(z.name, 60), w - 18, 10, true, 3), cnt = I.shared.length + ' activities' + (I.shared.every(q => q.status === 'TK_Complete') ? ' · all complete' : '');
    s += `<g><rect x="${tx}" y="${ty}" width="${w}" height="${tH}" rx="8" fill="#eef3fb" stroke="#1B2A41" stroke-width="2"/><text x="${tx + 9}" y="${ty + 16}" font-size="9" font-weight="700" fill="#1B2A41">SHARED BY ${L.length} PATHS</text>${l1.map((ln, i) => `<text x="${tx + 9}" y="${ty + 32 + i * 12}" font-size="10" font-weight="700" fill="#1d2433">${esc(ln)}</text>`).join('')}<text x="${tx + 9}" y="${ty + tH - 24}" font-size="9" fill="#5e6a7d">${esc(rpFit(cnt, w - 18, 9, false))}</text><text x="${tx + 9}" y="${ty + tH - 11}" font-size="9" fill="#5e6a7d">${esc(rpFit('junction ' + z.code, w - 18, 9, false))}</text></g>`; }
  const finY = py(0) + h / 2, busX = px(nCol - 1) - busGap / 2 - 4;
  L.forEach((x, r) => { const y = py(r), cs = lanesCars[r]; s += `<text x="${px(k0)}" y="${y - 24}" font-size="11" font-weight="700" fill="#1d2433">${esc(rpFit('Path ' + x.p.rank + (x.sel ? ' · selected' : '') + ' — ' + x.p.name, 4 * (w + gx), 11, true))}</text>`;
    cs.forEach((c, i) => { const xx = px(k0 + i); s += nd(c, xx, y, x.sel, x); if (i) s += `<path d="M${px(k0 + i - 1) + w} ${y + h / 2} L${xx} ${y + h / 2}" stroke="#5e6a7d" stroke-width="1.6" marker-end="url(#rpa)"/>`; });
    if (k0 && cs.length) { const x1 = tx + w, y1 = ty + tH / 2, x2 = px(k0), y2 = y + h / 2, mx = x1 + (x2 - x1) / 2; s += `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="#1B2A41" stroke-width="2.2" marker-end="url(#rpt)"/>`; } });
  if (trunk && inside) { const jc = lanesCars[0].findIndex(c => c.rows.some(q => q.t.id === (I.joins[0].join || {}).id)); L.forEach((x, r) => { if (r && x.p.joins && jc >= 0 && lanesCars[r].length) s += `<path d="M${px(k0 + jc) + w / 2} ${py(0) + h} V${py(r) + h / 2} H${px(k0) - 2}" fill="none" stroke="#1B2A41" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#rpt)"/>`; }); }
  /* the finish: all lanes run along a bus into it (nothing crosses a box) */
  const fx = px(nCol - 1), fh = h, fy = finY - fh / 2, tg = N.tg;
  s += `<g><rect x="${fx}" y="${fy}" width="${w}" height="${fh}" rx="8" fill="#1B2A41"/><text x="${fx + 9}" y="${fy + 16}" font-size="9" font-weight="700" fill="#c9d3e3">ALL PATHS MEET</text>${rpWrapT(tg.name, w - 18, 10.5, true, 2).map((ln, i) => `<text x="${fx + 9}" y="${fy + 32 + i * 12}" font-size="10.5" font-weight="700" fill="#fff">${esc(ln)}</text>`).join('')}<text x="${fx + 9}" y="${fy + fh - 12}" font-size="16" font-weight="800" fill="#ffb4a8">${rpDays(tg.slip || 0)}</text></g>`;
  const ys = L.map((x, r) => py(r) + h / 2); let busTo = Math.max(...ys);
  L.forEach((x, r) => { const e = I.ends.find(q => q.lane === x), last = lanesCars[r].length - 1; if (last < 0) return; const xr = px(k0 + last) + w;
    if (r === 0) s += `<path d="M${xr} ${ys[0]} H${fx}" stroke="#5e6a7d" stroke-width="1.8" marker-end="url(#rpa)"/>`; else s += `<path d="M${xr} ${ys[r]} H${busX} V${ys[0]}" fill="none" stroke="#5e6a7d" stroke-width="1.8"/>`;
    if (e && e.link) s += `<text x="${busX - 6}" y="${ys[r] - 6}" font-size="9.5" font-weight="700" fill="#5e6a7d" text-anchor="end">${esc(e.link)}</text>`; });
  return s + '</svg>';
}
function rpInterfereHtml(R) {
  const I = rpInterfere(R); if (!I.lanes.length) return '';
  const j = I.joins, sh = I.shared, row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  let t = '';
  if (sh.length) t += row('Shared by all paths', `${sh.length} activit${sh.length === 1 ? 'y' : 'ies'}, from ${esc(rpShort(sh[0].name, 40))} (${esc(sh[0].code)}) to <b>${esc(rpShort(sh[sh.length - 1].name, 50))}</b> (${esc(sh[sh.length - 1].code)})${sh.every(a => a.status === 'TK_Complete') ? ' · all complete' : ''}`);
  const jn = [...new Set(j.map(x => x.join.code))]; if (j.length) t += row('Where the paths split', `Paths ${j.map(x => x.lane.p.rank).join(' and ')} stop being traced at <b>${esc(jn.join(', '))}</b>: it is already on Path 1, so they share it and everything before it`);
  else t += row('Where the paths split', 'No activity is shared between the paths shown.');
  const meet = I.ends.map(e => `Path ${e.lane.p.rank}${e.isFinish ? ' → finish' + (e.link ? ' by ' + esc(e.link) : '') : e.link ? ' → finish by ' + esc(e.link) : ' ends at ' + esc(e.last.code)}`).join(' · ');
  t += row('Where they meet again', esc(meet));
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
  const W = 1180, L = 232, R = 60, top = 44, rh = 40, H = top + (cars.length + 1) * rh + 70, X = d => L + (d - lo) * (W - L - R) / (hi - lo);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:820px" font-family="Segoe UI, Arial, sans-serif">${rpMark}`;
  const d0 = new Date(lo * 864e5), mon = Math.max(1, Math.round((hi - lo) / 30 / 9));
  for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1; ; m += mon) { const dd = Date.UTC(y, m, 1) / 864e5; if (dd > hi) break; if (dd < lo) continue; const x = X(dd); s += `<line x1="${x}" x2="${x}" y1="${top - 8}" y2="${H - 30}" stroke="#eef0f4"/><text x="${x}" y="${top - 14}" font-size="10" fill="#5e6a7d" text-anchor="middle">${new Date(dd * 864e5).toLocaleString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</text>`; }
  st.forEach((x, i) => { const c = x.c, y = top + i * rh;
    s += `<g data-rpcar="${c.idx}" style="cursor:pointer"><title>${esc(c.title)}</title><text x="${L - 8}" y="${y + 17}" font-size="11" font-weight="700" text-anchor="end" fill="#1d2433">${esc(rpFit(rpShort(c.title, 80), L - 16, 11, true))}</text><text x="${L - 8}" y="${y + 30}" font-size="9.5" text-anchor="end" fill="${c.delta >= 1 ? '#c0392b' : c.delta <= -1 ? '#2e8b57' : '#5e6a7d'}" font-weight="700">${rpDays(c.delta)}${c.isOrigin ? ' · origin' : ''}</text>`;
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
  return s + '</svg>';
}
function rpVisual(D, R, T, car) {
  const v = rpView(), bar = `<div class="rpv-bar">${RPV.map(([k, t]) => `<button type="button" class="btn sm ${v === k ? 'primary' : ''}" data-rpview="${k}">${t}</button>`).join('')}</div>`;
  if (D.levBusy && v !== 'cards') return bar + '<p class="hint">Testing the levers…</p>';
  try {
    if (v === 'net') return bar + `<div class="rpv-scroll">${rpNetSvg(D)}</div><p class="hint rpv-note">Boxes are the cars; arrows are the real driving links (type and lag). Dashed green = a link the switched-on levers change. Click a box for its activities.</p>`;
    if (v === 'plots') return bar + `<div class="rpv-scroll">${rpPlotsSvg(D, R)}</div>${rpInterfereHtml(R)}<p class="hint rpv-note">Activities that two or more paths run through are drawn once (blue box) and the arrows show where the paths split and meet again (scroll sideways for the finish). “Twin copy” = the same activity in another plot, which receives the lever too.</p>`;
    if (v === 'gantt') return bar + `<div class="rpv-scroll">${rpGanttSvg(D)}</div><p class="hint rpv-note">One bar per car from the real dates: hollow = baseline, grey = current, green = with the switched-on levers. Switch levers on or off at the right and the green bars and finish move.</p>`;
  } catch (e) { console.error(e); return bar + `<p class="hint">This view could not be drawn: ${esc(e.message)}. Switch to Cards.</p><div class="tr-train rp-row">${T.cars.map(car).join('')}</div>`; }
  return bar + `<div class="tr-train rp-row">${T.cars.map(car).join('')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rpview]'); if (!b) return; LS.set('brt.rpView', b.dataset.rpview); if (S.step === 'recovery') { const y = window.scrollY; viewRecovery(); window.scrollTo(0, y); } });
