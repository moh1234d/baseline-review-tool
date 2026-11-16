/* ===== APP PART 27 (v8.8): short note when hovering (or long-pressing on a phone) a menu item ===== */
const NAVTIP = {
  portfolio: ['Portfolio triage', ['Load many XER files at once', 'Ranks projects by major findings and negative float', 'Shows which project to open first', 'Exports the ranking to Excel'], 'several XERs', 'ranked list · Excel'],
  quick: ['Quick review · XER only', ['One XER, no setup needed', 'Runs the main checks in seconds', 'Lists the top issues to fix first', 'Good for a first look at a new update'], '1 XER', 'findings list'],
  setup: ['1 · Project setup', ['Project name, dates and contract rules', 'Calendars: 8-hour day, Friday rest day, Ramadan as normal days', 'Thresholds and wording per audience', 'Every setting can be changed'], 'project details', 'saved settings'],
  files: ['2 · Load files', ['Add the baseline XER and any contract files', 'Read in your browser, nothing is uploaded', 'Shows what was found: activities, calendars, codes'], 'XER (and contract files)', 'loaded schedule'],
  confirm: ['3 · Confirmations', ['Check the detected buildings, zones, floors and trades', 'Correct any wrong mapping', 'Set the sequence rules (trade order per floor)'], 'detected structure', 'confirmed mappings'],
  run: ['4 · Run checks', ['Time, logic, calendar, resource and cost checks', 'Findings ranked major or minor, with examples', 'Compares with the last review of the project'], 'confirmed schedule', 'findings'],
  report: ['5 · Report', ['Word report, short brief and Excel appendix', 'Wording for contractor, consultant or PMC', 'Items are “to check with the contractor”'], 'findings', 'Word · Excel'],
  compare: ['Schedule comparison', ['Previous vs current XER', 'Key-date movement, added and deleted activities', 'Logic and duration changes', 'Update checks: BEI, missed and out-of-sequence work'], '2 XER files', 'comparison · Word'],
  delay: ['Delay analysis', ['Traces the driving path to the finish', 'Splits each slip: late start, longer duration, logic change', 'Windows between updates, Gantt and a written narrative'], '2 XER files', 'narrative · Word'],
  recovery: ['Recovery planner', ['Finds where the delay started on the longest paths', 'Tests levers: overlap, extra crews, shorter lags', 'Shows the finish with the levers you switch on', 'Exports a Word report and an Excel sheet'], 'baseline + update XER', 'Word · Excel'],
  claims: ['Claim review', ['Organises the claim evidence in one place', 'Tests the notice period from the event date', 'Guides the review steps', 'Never concludes entitlement or EOT'], 'claim details', 'review notes'],
  builder: ['Baseline builder', ['Turns a BOQ into activities', 'Uses productivity rates for durations', 'Builds a structure you can check before P6'], 'BOQ', 'activity list'],
  roundtrip: ['P6 roundtrip check', ['Compares a schedule re-imported into P6 with its source', 'Lists what changed or was lost', 'Confirms the import before you rely on it'], 'source + re-imported XER', 'differences'],
  assess: ['Tool assessment', ['What this version does and does not do', 'Ideas to enhance it, ranked', 'Where AI could improve accuracy'], '', 'read-only page']
};
(function () {
  let tip, timer, cur;
  const on = () => !S || !S.cfg || S.cfg.navTips !== false, delay = () => Math.max(0, Math.min(3000, +(S.cfg && S.cfg.navTipDelay) || 0));
  function hide() { clearTimeout(timer); cur = null; if (tip) tip.style.display = 'none'; }
  function show(btn) {
    const d = NAVTIP[btn.dataset.go]; if (!d || !on()) return; cur = btn;
    if (!tip) { tip = document.createElement('div'); tip.id = 'navtip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.innerHTML = `<div class="nt-t">${esc(d[0].replace(/^\d · /, ''))}</div><ul>${d[1].map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="nt-c">${d[2] ? `<span>In: ${esc(d[2])}</span>` : ''}<span class="o">Out: ${esc(d[3])}</span></div>`;
    tip.style.display = 'block'; const r = btn.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = r.right + 12, y = r.top + r.height / 2 - 28; if (x + tw > vw - 8) x = Math.max(8, vw - tw - 8); y = Math.max(8, Math.min(y, vh - th - 8));
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.setProperty('--ay', Math.max(10, Math.min(th - 22, r.top + r.height / 2 - y - 6)) + 'px');
  }
  const item = e => e.target.closest && e.target.closest('#steps [data-go]');
  document.addEventListener('mouseover', e => { const b = item(e); if (!b || b === cur) return; hide(); timer = setTimeout(() => show(b), delay()); });
  document.addEventListener('mouseout', e => { const b = item(e); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', e => { const b = item(e); if (b) { hide(); timer = setTimeout(() => show(b), delay()); } });
  document.addEventListener('focusout', e => { if (item(e)) hide(); });
  document.addEventListener('click', hide, true); document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }); window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
  /* phone: touch and hold an item for half a second */
  let hold, held = false;
  document.addEventListener('touchstart', e => { const b = item(e); if (!b) return; held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; show(b); }, 500); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(t => document.addEventListener(t, e => { clearTimeout(hold); if (t === 'touchend' && held) { e.preventDefault(); setTimeout(hide, 2600); } }, { passive: false }));
})();
