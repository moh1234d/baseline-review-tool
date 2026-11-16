/* ===== APP PART 23 (v7.10): Tool assessment — what the tool does, what it does not, how to enhance it, and where AI helps ===== */
const ASSESS = {
  does: [
    ['Reads P6 XER files in the browser', 'Single and multi-project XERs up to about 35,000 activities; nothing is uploaded.'],
    ['Baseline quality checks', 'Contract/time rules (T), logic and hygiene (L: open ends, lags, constraints, float, durations, calendars, holidays), resources and cost loading.'],
    ['Calendar checks', 'Category calendars, holidays and Eid, 8-hour day, weekly hours, Friday rest day; Ramadan treated as normal working days.'],
    ['Calculation settings', 'Reports progress override, open-ended criticality, expected finish, critical-path definition and a missing baseline project.'],
    ['Structure detection', 'Building, unit, zone, floor, trade, contractor and stage from activity codes, WBS and names; all mappings editable.'],
    ['Sequence rules', 'Trade order per floor/zone (e.g. plaster → ceiling → paint), floor direction, same trade in parallel with no link.'],
    ['Schedule comparison', 'Previous vs current XER: key-date movement, added/deleted activities, logic and duration changes, update checks (BEI, CPLI, missed and out-of-sequence work, actuals after data date).'],
    ['Delay analysis', 'Driving-path trace, slip split per activity (late start, duration growth, logic change, recovery, carried), windows between updates, Gantt and Word narrative.'],
    ['Recovery what-if', 'Simplified forward pass honouring progress override, start constraints and expected finish.'],
    ['Claim review', 'Organises claim evidence, notice-period test from the event date, decision steps; never concludes entitlement.'],
    ['Portfolio triage', 'Many XERs at once, ranked by major findings and negative float, Excel export.'],
    ['Baseline builder and P6 roundtrip', 'BOQ to activities with productivity rates; checks a re-imported schedule against the source.'],
    ['Outputs and memory', 'Word report, brief, Excel appendix per audience (contractor, consultant, PMC); findings carried over between the last three reviews.']
  ],
  doesnt: [
    ['Prove why a delay happened', 'The XER shows what moved and where; the cause and responsibility need letters, RFIs, site records.'],
    ['Trace the root cause to one origin', 'Slip is tagged per activity, but not yet ranked by the project days each origin explains.'],
    ['Allocate responsibility', 'No owner map (contractor / employer / neutral) and no concurrency test yet.'],
    ['Full CPM like P6', 'Recalculation ignores resource levelling and finish constraints; results are indicative.'],
    ['Analyse a series of updates in one go', 'Comparison is one pair at a time; no completion-date trend across many updates.'],
    ['Separate progress from re-planning (half-step)', 'Delay from performance and delay from contractor revisions are not split yet.'],
    ['Detect hidden recovery', 'Shortened durations, removed logic, new constraints are listed, but not valued in days recovered on paper.'],
    ['Forecast realism', 'No earned schedule (SPI(t)), production-rate test against quantities, or P50/P80 range.'],
    ['Read contract documents deeply', 'Clauses are entered by hand; PDFs are only keyword-searched.'],
    ['Tested on real update pairs', 'Only one real XER so far; comparison and delay modes tested on synthetic pairs.'],
    ['Background loading', 'Loading and parsing a large XER still briefly freezes the page.']
  ],
  enhance: [
    ['High', 'S', 'Root-cause table', 'Walk back from completion to the first activity that slipped on its own; rank origins by project days explained.'],
    ['High', 'S', 'Cause type and owner map', 'Classify origins (design/approval, procurement, access, resources/productivity, scope change, authority, logic change) and map to an owner; editable in Setup.'],
    ['High', 'M', 'Windows over many updates', 'Load baseline + all updates; per window: driving path, critical-path change, origins; cumulative delay register.'],
    ['High', 'M', 'Half-step split', 'Apply progress only, then revisions, to show performance delay vs re-planning delay.'],
    ['High', 'S', 'Hidden-change valuation', 'Days of completion “recovered” by cut durations, deleted logic, constraints, calendar or lag changes.'],
    ['Medium', 'S', 'Completion trend and waterfall', 'Forecast finish across updates; waterfall from baseline finish through each cause to today.'],
    ['Medium', 'M', 'Performance and forecast', 'Planned vs actual durations by trade/contractor, approval and delivery cycle times, earned schedule, required vs achieved production.'],
    ['Medium', 'M', 'Time-impact fragments and concurrency', 'Insert an event and measure the shift; flag overlapping contractor and employer delay.'],
    ['Medium', 'S', 'Project profiles', 'Remember code mappings and aliases per client/contractor so weekly updates need no remapping.'],
    ['Medium', 'M', 'Background processing', 'Move XER parsing and checks into a worker so 35k files never freeze the page.'],
    ['Low', 'L', 'Risk range', 'P50/P80 finish from the duration spread already seen on the project.']
  ],
  ai: [
    ['Classify delay causes', 'Read activity names, WBS and codes of the origin activities and propose a cause type with a confidence; the reviewer confirms.', 'Activity names, codes, dates only'],
    ['Link schedule to correspondence', 'Match delay events from a register or letters to the activities they affect, and flag events with no schedule impact.', 'Event summaries you choose to share'],
    ['Write the narrative', 'Turn the root-cause table, windows and trend into a clear delay narrative per audience; every sentence tied to a number in the tool.', 'Tool results only'],
    ['Challenge the contractor’s story', 'Compare the contractor’s stated causes with what the schedule shows, and list the questions to ask.', 'Contractor statement + tool results'],
    ['Suggest structure mappings', 'Propose code/WBS mappings for a new contractor’s file so detection is right first time.', 'Code and WBS names'],
    ['Review the findings', 'Second opinion on each failed check: real issue, noise, or needs context.', 'Check results and examples'],
    ['Learn from your decisions', 'Use your accepted/rejected findings to tune thresholds and suppress repeat noise across updates.', 'Your decisions, kept locally']
  ],
  aiRules: [
    'AI stays optional and off by default; the tool works fully without it.',
    'Numbers come from the engine, never from the AI; AI explains, classifies and drafts.',
    'Every AI suggestion is marked as a suggestion and needs your confirmation.',
    'Only the minimum is sent; an anonymise switch replaces contractor names and WBS titles. No contract text is sent unless you choose to.',
    'Wording stays “to check with the contractor”; no entitlement or EOT conclusions.'
  ]
};
function viewAssess() {
  const tab = S.asTab || 'all', sec = (k, title, sub, body) => (tab === 'all' || tab === k) ? `<section class="card as-${k}"><h2>${title}</h2><p class="hint" style="margin-top:-4px">${sub}</p>${body}</section>` : '';
  const li = (a, chip) => `<li>${chip || ''}<b>${esc(a[0])}</b><span>${esc(a[1])}</span>${a[2] ? `<em>Sends: ${esc(a[2])}</em>` : ''}</li>`;
  const pri = { High: 'bad', Medium: 'info', Low: '' };
  const tabs = [['all', 'All'], ['does', 'Does'], ['doesnt', 'Does not'], ['enhance', 'Enhance'], ['ai', 'AI']];
  $('#main').classList.add('wide');
  $('#main').innerHTML = `<div class="as-wrap"><header class="ph"><h1>Tool assessment <span class="chip info">v${esc(E.VERSION)}</span></h1><p>What this version does, what it does not do yet, how to enhance it, and where AI can make the results more accurate. Kept in one place so it is easy to find.</p></header>
  <div class="as-tabs">${tabs.map(([k, t]) => `<button class="btn sm ${tab === k ? 'primary' : ''}" data-astab="${k}">${t}</button>`).join('')}</div>
  <div class="as-grid">
  ${sec('does', '✅ What the tool does', ASSESS.does.length + ' capabilities in this version', `<ul class="as-list">${ASSESS.does.map(a => li(a, '<span class="chip ok">Yes</span>')).join('')}</ul>`)}
  ${sec('doesnt', '⛔ What it does not do yet', ASSESS.doesnt.length + ' limits to keep in mind when reading results', `<ul class="as-list">${ASSESS.doesnt.map(a => li(a, '<span class="chip bad">Not yet</span>')).join('')}</ul>`)}
  ${sec('enhance', '🛠 How to enhance it', 'Ranked by value; effort S (days), M (1–2 weeks), L (more)', `<ul class="as-list">${ASSESS.enhance.map(([p, e, t, d]) => li([t, d], `<span class="chip ${pri[p]}">${p}</span><span class="chip">${e}</span>`)).join('')}</ul>`)}
  ${sec('ai', '🤖 How AI can improve accuracy', 'Where AI adds value, and what it would see', `<ul class="as-list">${ASSESS.ai.map(a => li(a, '<span class="chip new">AI</span>')).join('')}</ul><h3 class="as-h3">Rules for using AI</h3><ul class="as-rules">${ASSESS.aiRules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`)}
  </div></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-astab]'); if (!b) return; S.asTab = b.dataset.astab; viewAssess(); });
