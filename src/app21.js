/* ===== v6.9: carry-over of findings between reviews (activity level) ===== */
const CARRY_MAX = 20000;
function carryKeys(results) {
  const ks = []; for (const r of results) if (r.status === 'fail') for (const it of (r.items || [])) { ks.push(r.id + '|' + it.id + '|' + (it.field || '')); if (ks.length >= CARRY_MAX) return ks; }
  return ks;
}
function carryCompare() {
  if (!S.out) return null; const curRev = +S.cfg.reviewNo || S.history.length + 1;
  const earlier = S.history.filter(h => h.rev < curRev); if (!earlier.length) return null; const prev = earlier[earlier.length - 1];
  if (!prev.keys) return { prev, none: true };
  const cur = new Map(); for (const r of S.out.results) if (r.status === 'fail') for (const it of (r.items || [])) cur.set(r.id + '|' + it.id + '|' + (it.field || ''), { check: r.id, id: it.id, name: it.name || '', field: it.field || '', value: it.value || '' });
  const pk = new Set(prev.keys), older = new Set(); earlier.slice(0, -1).forEach(h => (h.keys || []).forEach(k => older.add(k)));
  const out = { prev, closed: [], still: [], fresh: [], reopened: [] };
  for (const k of pk) { const c = cur.get(k); if (c) out.still.push(c); else { const p = k.split('|'); out.closed.push({ check: p[0], id: p[1], name: '', field: p[2], value: '' }); } }
  for (const [k, c] of cur) if (!pk.has(k)) (older.has(k) ? out.reopened : out.fresh).push(c);
  return out;
}
function carryCard() {
  const c = carryCompare(); if (!c) return '';
  if (c.none) return `<div class="card"><b>Findings by activity:</b> <span class="hint">review ${c.prev.rev} was saved before activity-level records existed. They are kept from the next saved review.</span></div>`;
  return `<div class="card"><b>Findings by activity, compared with review ${c.prev.rev} (${esc(c.prev.date)}):</b> <span class="chip ok">${c.closed.length} closed</span> <span class="chip open">${c.still.length} still open</span> <span class="chip new">${c.fresh.length} new</span>${c.reopened.length ? ` <span class="chip new">${c.reopened.length} reopened</span>` : ''} <button class="btn" data-carry="xlsx" style="margin-left:10px">Download list (Excel)</button></div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-carry]'); if (!b) return; const c = carryCompare(); if (!c || c.none) return;
  const X = await lib('exceljs'), wb = new X.Workbook(); wb.creator = S.cfg.preparedBy || 'Baseline Review Tool'; wb.created = new Date();
  for (const [n, rows] of [['New', c.fresh], ['Reopened', c.reopened], ['Still open', c.still], ['Closed', c.closed]]) { const ws = wb.addWorksheet(n); ws.columns = [{ header: 'Check', width: 10 }, { header: 'Activity', width: 22 }, { header: 'Name', width: 56 }, { header: 'Finding', width: 30 }, { header: 'Value', width: 16 }]; ws.getRow(1).font = { bold: true }; rows.forEach(r => ws.addRow([r.check, r.id, r.name, r.field, r.value])); ws.views = [{ state: 'frozen', ySplit: 1 }]; }
  download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (S.cfg.projectName || 'Project') + '_Findings_carry_over_v' + E.VERSION + '.xlsx'); toast('Carry-over list created', 'ok');
});
