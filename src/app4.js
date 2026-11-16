/* ===== APP PART 4: events & init ===== */
function convert(el) { const t = el.dataset.t; if (t === 'bool') return el.checked; if (t === 'num') { const v = parseFloat(el.value); return isNaN(v) ? null : v; } if (t === 'int') { const v = parseInt(el.value, 10); return isNaN(v) ? null : v; } return el.value; }
const RERENDER = new Set(['weights.engineering', 'weights.procurement', 'weights.construction', 'weights.handover', 'ai.on', 'durationValue', 'durationUnit', 'reportingPeriod']);
function bindAll() {
  document.addEventListener('click', async e => {
    const t = e.target, q = s => t.closest(s);
    let el;
    if ((el = q('[data-go]'))) { if (!el.disabled) go(el.dataset.go); return; }
    if ((el = q('[data-set]'))) { e.preventDefault(); setPath(S.cfg, el.dataset.set, +el.dataset.v); autosave(); viewSetup(); return; }
    if ((el = q('[data-tab]'))) { S.ui.tab = el.dataset.tab; viewReport(); return; }
    if ((el = q('[data-filter]'))) { S.ui.filter = el.dataset.filter; renderChecks(); return; }
    if ((el = q('[data-toggle]'))) { const id = el.dataset.toggle, b = $('#b-' + id); if (b.hidden) { if (!b.innerHTML) b.innerHTML = checkBody(S.out.results.find(r => r.id === id)); b.hidden = false; } else b.hidden = true; return; }
    if ((el = q('[data-more]'))) { e.preventDefault(); S.ui.limit = S.ui.limit || {}; S.ui.limit[el.dataset.more] = (S.ui.limit[el.dataset.more] || 40) + 200; $('#b-' + el.dataset.more).innerHTML = checkBody(S.out.results.find(r => r.id === el.dataset.more)); return; }
    if ((el = q('[data-ask]'))) { askAbout(el.dataset.ask); return; }
    if ((el = q('[data-msdel]'))) { S.cfg.milestones.splice(+el.dataset.msdel, 1); autosave(); viewConfirm(); return; }
    if ((el = q('[data-eiddel]'))) { const [y, ty] = el.dataset.eiddel.split('|'); S.cfg.eid = S.cfg.eid.filter(x => !(String(x.year) === y && x.type === ty)); LS.set('brt.eid', S.cfg.eid); viewConfirm(); return; }
    const id = t.id || (q('[id]') || {}).id;
    switch (q('button,label') && (q('button,label').id || '')) {
      case 'btn-contract-ai': return contractAI();
      case 'btn-boq-ai': return boqPdfAI();
      case 'btn-narr-ai': return narrativeAI();
      case 'btn-layout-ai': return layoutAI();
      case 'ap-sug': S.cfg.approvalIds = E.suggestApprovals(S.M, S.cfg.approvalExclude); renderApprovals(); autosave(); return;
      case 'ap-none': S.cfg.approvalIds = []; renderApprovals(); autosave(); return;
      case 'ap-ai': return approvalsAI();
      case 'ms-add': S.cfg.milestones.push({ name: '', days: null, date: '', actId: null }); viewConfirm(); return;
      case 'eid-save': {
        const need = E.run(S.M, S.cfg).needEid;
        need.forEach((n, i) => { const from = $(`[data-eid="${i}.from"]`).value, to = $(`[data-eid="${i}.to"]`).value, none = $(`[data-eid="${i}.none"]`).checked; if (from || none) S.cfg.eid.push({ year: n.year, type: n.type, from, to: to || from, none }); });
        LS.set('brt.eid', S.cfg.eid); autosave(); viewConfirm(); toast('Eid dates saved for all projects', 'ok'); return;
      }
      case 'open-proj-go': try { applyProfile(LS.get($('#open-proj').value)); toast('Project opened – now load its XER', 'ok'); go('files'); } catch (err) { toast(err.message, 'bad'); } return;
      case 'btn-run': return runAll();
      case 'dg-svg': download(new Blob([diagramSVG(S.ui.diagZones)], { type: 'image/svg+xml' }), (S.cfg.projectName || 'Project') + '_network.svg'); return;
      case 'dg-png': download(await svgToPng(diagramSVG(S.ui.diagZones), 2), (S.cfg.projectName || 'Project') + '_network.png'); return;
      case 'x-word': try { await exportDocx(); toast('Word report created', 'ok'); } catch (err) { console.error(err); toast(err.message, 'bad'); } return;
      case 'x-xlsx': try { await exportXlsx(); toast('Excel appendix created', 'ok'); } catch (err) { console.error(err); toast(err.message, 'bad'); } return;
      case 'x-both': try { await exportXlsx(); await exportDocx(); toast('Both files created', 'ok'); } catch (err) { console.error(err); toast(err.message, 'bad'); } return;
      case 'x-draft': return draftAll();
      case 'x-profile': download(new Blob([JSON.stringify(toProfile(), null, 1)], { type: 'application/json' }), (S.cfg.projectName || 'project') + '.review-profile.json'); return;
      case 'nav-save': download(new Blob([JSON.stringify(toProfile(), null, 1)], { type: 'application/json' }), (S.cfg.projectName || 'project') + '.review-profile.json'); return;
    }
  });
  const onFile = async (id, files) => {
    if (id === 'f-xer') return loadXER(files[0]); if (id === 'f-boq') return loadBoq(files[0]); if (id === 'f-contract') return loadContract([...files]);
    if (id === 'f-profile' || id === 'nav-load') { try { applyProfile(JSON.parse(await files[0].text())); toast('Project file loaded', 'ok'); go(S.step === 'report' ? 'setup' : S.step); } catch (e) { toast(e.message, 'bad'); } return; }
    if (id.startsWith('f-')) return loadSlot(id.slice(2), files[0]);
  };
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.type === 'file') { if (el.files.length) onFile(el.id, el.files); return; }
    if (el.dataset.p !== undefined) { const v = convert(el); setPath(S.cfg, el.dataset.p, v); autosave(); if (el.dataset.p === 'idRegex') idTest(); if (RERENDER.has(el.dataset.p)) viewSetup(); return; }
    if (el.dataset.aim) { S.cfg.ai.models[el.dataset.aim] = el.value; autosave(); return; }
    if (el.id === 'ocr-on') { S.ocr = el.checked; return; }
    if (el.dataset.boq) { S.raw.boqCol[el.dataset.boq] = +el.value; applyBoq(); return; }
    if (el.id === 'boq-sheet') { S.raw.boqSheet = el.value; S.raw.boqRows = S.raw.boqSheets[el.value]; S.raw.boqCol = E.guessBoqColumns(S.raw.boqRows); renderBoqMap(); return; }
    if (el.id === 'boq-hdr') { S.raw.boqCol.header = +el.value - 1; renderBoqMap(); return; }
    if (el.dataset.slot) { const k = el.dataset.slot, f = el.dataset.f, r = S.raw[k]; const v = el.type === 'checkbox' ? el.checked : el.value;
      if (f === 'sheet') { r.sheet = v; initSlot(k); return; } if (f === 'orient') { r.sel.orient = v; r.sel = Object.assign({ orient: v, dateRow: 0, valRow: 1, dateCol: 0, valCol: 1 }, r.sel); }
      else if (['dateRow', 'valRow', 'dateCol', 'valCol'].includes(f)) r.sel[f] = +v - 1; else if (f === 'unit') r.unit = v; else if (f === 'cumulative') r.cumulative = v; else if (f === 'hdr') r.hdr = +v - 1; else if (f.startsWith('map.')) r.map[f.slice(4)] = +v;
      applySlot(k); return; }
    if (el.dataset.layout) { S.cfg.docs.layout = S.cfg.docs.layout || { zones: [], roads: [] }; S.cfg.docs.layout[el.dataset.layout] = el.value.split('\n').map(x => x.trim()).filter(Boolean); return; }
    if (el.dataset.rs) { S.cfg.rsrc[el.dataset.rs] = el.value || null; autosave(); return; }
    if (el.dataset.wbs) { if (el.value) S.cfg.wbsMap[el.dataset.wbs] = el.value; else delete S.cfg.wbsMap[el.dataset.wbs]; E.applyCategories(S.M, S.cfg.wbsMap); autosave(); return; }
    if (el.dataset.ap) { const s = new Set(S.cfg.approvalIds || []); el.checked ? s.add(el.dataset.ap) : s.delete(el.dataset.ap); S.cfg.approvalIds = [...s]; $('#ap-count').textContent = s.size + ' selected'; autosave(); return; }
    if (el.dataset.fin) { S.cfg.projFinishId = el.value || null; autosave(); return; }
    if (el.dataset.ms) { const [i, f] = el.dataset.ms.split('.'); S.cfg.milestones[+i][f] = (f === 'days') ? (el.value === '' ? null : +el.value) : el.value; autosave(); return; }
    if (el.dataset.hcal) { const s = new Set(S.cfg.holidayCalsExclude || []); el.checked ? s.delete(el.dataset.hcal) : s.add(el.dataset.hcal); S.cfg.holidayCalsExclude = [...s]; autosave(); return; }
    if (el.dataset.dw) { try { S.cfg.disciplineWords = JSON.parse(el.value); el.style.outline = ''; autosave(); } catch (err) { el.style.outline = '2px solid var(--bad)'; toast('Discipline words must be valid JSON', 'bad'); } return; }
    if (el.dataset.edit) { const [id, f] = el.dataset.edit.split('.'); S.edits[id] = Object.assign(S.edits[id] || {}, { [f]: el.value }); return; }
    if (el.dataset.dz !== undefined) { const all = diagramModel().zones; const cur = new Set(S.ui.diagZones || (all.length > 9 ? all.slice(0, 9) : all)); el.checked ? cur.add(el.dataset.dz) : cur.delete(el.dataset.dz); S.ui.diagZones = all.filter(z => cur.has(z)); renderDiagram(); return; }
  });
  document.addEventListener('input', e => { if (e.target.id === 'ap-q') renderApprovals(); });
  ['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { const d = e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('over'); } }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { const d = e.target.closest('.drop'); if (d) { d.classList.remove('over'); if (ev === 'drop') { e.preventDefault(); const inp = d.querySelector('input'); if (e.dataTransfer.files.length) onFile(inp.id, e.dataTransfer.files); } } }));
}
window.addEventListener('DOMContentLoaded', () => { bindAll(); go('home'); });
