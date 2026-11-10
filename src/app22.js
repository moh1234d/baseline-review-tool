/* ===== APP PART 22 (v7.0): portfolio triage – many XERs, one ranked table ===== */
S.pf = { rows: [], busy: false };
function pfSummary(M, cfg, name) {
  E.applyCategories(M, cfg.wbsMap);
  const out = E.run(M, cfg), R = out.results, fails = R.filter(r => r.status === 'fail');
  const live = M.tasks.filter(t => t.type !== 'TT_LOE' && t.type !== 'TT_WBS' && t.status !== 'TK_Complete');
  const cnt = id => { const r = R.find(x => x.id === id); return r && r.status === 'fail' ? (r.count || 0) : 0; };
  const done = M.tasks.filter(t => t.status === 'TK_Complete').length;
  return {
    file: name, project: (M.proj.proj_short_name || name.replace(/\.xer$/i, '')), tasks: M.tasks.length, dataDate: E.fmtDate(M.dataDate),
    finish: out.finish && out.finish.ef != null ? E.fmtDate(out.finish.ef) : '', pct: M.tasks.length ? Math.round(100 * done / M.tasks.length) : 0,
    major: fails.filter(r => r.tier === 'major').length, other: fails.filter(r => r.tier !== 'major').length,
    negFloat: live.filter(t => t.tfWd != null && t.tfWd < 0).length, openEnds: cnt('L1'), zeroDur: cnt('L7'),
    top: fails.filter(r => r.tier === 'major').slice(0, 3).map(r => r.title).join('; '),
    score: fails.filter(r => r.tier === 'major').length * 3 + fails.filter(r => r.tier !== 'major').length
  };
}
async function pfRun(files) {
  S.pf.busy = true; S.pf.rows = []; pfView();
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; toast('Reviewing ' + (i + 1) + ' of ' + files.length + ': ' + f.name); await sleep(30);
    try {
      const { M } = await xerStage(f), cfg = Object.assign(E.defaultCfg(), { ai: S.cfg.ai });
      cfg.wbsMap = E.suggestWbsMap(M); cfg.rsrc = E.suggestResources(M); cfg.fileType = S.cfg.fileType;
      E.applyCategories(M, cfg.wbsMap); cfg.approvalIds = E.suggestApprovals(M, cfg.approvalExclude);
      S.pf.rows.push(pfSummary(M, cfg, f.name));
    } catch (e) { console.error(e); S.pf.rows.push({ file: f.name, error: e.message, score: -1 }); }
    S.pf.rows.sort((a, b) => b.score - a.score || (b.negFloat || 0) - (a.negFloat || 0)); pfView(); await sleep(30);
  }
  S.pf.busy = false; pfView(); toast('Portfolio review finished', 'ok');
}
function pfView() {
  const rows = S.pf.rows;
  $('#main').classList.add('wide'); $('#main').innerHTML = `<div class="split ${rows.length ? 'has-res' : ''}"><aside class="pane-in"><div class="lbl">XER FILES</div>${drop('pf-xer', '.xer,.txt', true, 'Choose several XER files')}
  <div class="lbl">ACTIONS</div><div class="actions stack" style="margin:0"><button class="btn primary" data-pf="xlsx" ${rows.length && !S.pf.busy ? '' : 'disabled'}>Download table (Excel)</button></div>
  <p class="hint">One project per XER. Each file gets the standard checks with default settings, one after another, and only the summary is kept. Nothing leaves your browser. Settings for a project are applied when you open it in Quick or Full review.</p></aside>
  <div class="pane-out">${rows.length ? `<div class="card"><h2>Projects, most findings first ${S.pf.busy ? '<span class="chip open">running…</span>' : ''}</h2><p class="hint">Priority = 3 × major findings + other findings; ties go to more negative-float activities. It ranks where to look first; it is not a quality grade.</p>
  <div class="scroll" style="max-height:640px"><table class="tbl"><thead><tr><th>#</th><th>Project</th><th class="n">Activities</th><th>Data date</th><th>Finish</th><th class="n">% done</th><th class="n">Major</th><th class="n">Other</th><th class="n">Neg. float</th><th class="n">Open ends</th><th>Main issues</th></tr></thead><tbody>${rows.map((r, i) => r.error ? `<tr><td>${i + 1}</td><td>${esc(r.file)}</td><td colspan="9"><span class="chip bad">${esc(r.error)}</span></td></tr>` : `<tr><td>${i + 1}</td><td><b>${esc(r.project)}</b><br><small>${esc(r.file)}</small></td><td class="n">${fmtN(r.tasks)}</td><td>${esc(r.dataDate)}</td><td>${esc(r.finish)}</td><td class="n">${r.pct}</td><td class="n">${r.major}</td><td class="n">${r.other}</td><td class="n">${fmtN(r.negFloat)}</td><td class="n">${fmtN(r.openEnds)}</td><td>${esc(r.top)}</td></tr>`).join('')}</tbody></table></div></div>`
    : `<div class="card"><h2>Portfolio triage</h2><p>Drop the XER files of all projects you must review this week. You get one table that ranks them by findings, so you know which to open first. Quick or Full review then goes deep on a single project.</p></div>`}</div></div>`;
}
function viewPortfolio() { pfView(); }
document.addEventListener('change', e => { const el = e.target; if (el.id === 'pf-xer' && el.files.length) pfRun([...el.files]); });
document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('.drop'); if (d && d.querySelector('#pf-xer') && e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); pfRun([...e.dataTransfer.files]); } });
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-pf]'); if (!b || !S.pf.rows.length) return;
  const X = await lib('exceljs'), wb = new X.Workbook(), ws = wb.addWorksheet('Portfolio');
  ws.columns = [['Rank', 7], ['Project', 22], ['File', 34], ['Activities', 11], ['Data date', 13], ['Finish', 13], ['% complete', 11], ['Major findings', 14], ['Other findings', 14], ['Negative float', 14], ['Open ends', 11], ['Main issues', 70]].map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  S.pf.rows.forEach((r, i) => ws.addRow(r.error ? [i + 1, '', r.file, '', '', '', '', '', '', '', '', r.error] : [i + 1, r.project, r.file, r.tasks, r.dataDate, r.finish, r.pct, r.major, r.other, r.negFloat, r.openEnds, r.top]));
  download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Portfolio_triage_v' + E.VERSION + '.xlsx'); toast('Table created', 'ok');
});
