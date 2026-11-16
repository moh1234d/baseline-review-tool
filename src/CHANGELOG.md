## v8.8 (2026-11-16)
- Menu notes: hovering a menu item (or keyboard focus, or touch and hold for half a second on a phone) shows a small dark note with 3 to 4 short points on what the section does, plus what goes in and what comes out. Covers all 14 items. Setup has a switch to turn the notes off and a delay setting (ms).

## v8.7 (2026-11-16)
- Recovery planner: the number of paths is now chosen by the user (box "Paths" next to the path list, 1 to 30; also a Setup field, default 3). The path list, Network, Parallel plots and Logic Gantt views all follow it. A message shows if fewer paths exist than asked.
- Parallel plots: a later path can now split from any higher path, not only from Path 1. It starts one step after the car holding the shared activity (dashed arrow), and a table lists, for each path, which path it splits from and at which activity. Lane titles are cut to the box width (full text on hover).
- Quality check (text, boxes and arrows) re-run for 1, 2, 3, 5, 6, 8, 12 and 30 paths on views A, B and D: clean.

## v8.6 (2026-11-16)
- Recovery planner views cleaned up and quality-checked: all box text is measured and wrapped (up to 3 lines) so nothing runs outside its box; the finish box no longer overlaps its date; in B · Parallel plots the lanes now run along one bus into the finish, so no arrow crosses another box or text. An automatic check (text vs text, text vs box, text outside its box or the chart, arrows through boxes or over text) ran clean on views A, B and D for paths 1 to 3, with the default levers and with every lever on.

## v8.5 (2026-11-16)
- Recovery planner, B · Parallel plots now shows where the paths interfere: the activities that paths 1 to 3 share are drawn once (blue box, with the junction activity), the lanes split from it, and all lanes meet again at the finish with the real link type. A short table under the chart states what is shared, where the paths split and how they meet again.
- Paths 2 and 3 are now traced exactly as in Delay analysis (they stop at the activity they share with a higher path) in all four views, so the origin, cars and levers of those paths start from the shared junction and carry its slip.

## v8.4 (2026-11-16)
- Recovery planner: the delay train can be shown in four switchable views (buttons above the train; the choice is remembered): Cards (as before), A · Network (boxes with the real driving links, type and lag; links changed by a switched-on lever are dashed green), B · Parallel plots (paths 1 to 3 side by side, shared start drawn once, "twin copy" marks where a lever also applies), D · Logic Gantt (baseline, current and with-levers bars on a date axis with the finish markers). All views follow the selected path and the lever switches.

## v8.3 (2026-11-16)
- Recovery planner: a "Path" drop-down at the top selects Path 1 (longest), Path 2 or Path 3 to the finish, each shown with its end activity, float and finish. The train, timeline, waterfall, levers, report and Excel table follow the selected path. Levers apply to identical copies as before.

## v8.2.1 (2026-11-16)
- Fixed: the float shown for the 2nd and 3rd critical paths (Delay analysis, network diagrams) was the half-day group used to find them, not the path's real float (−30.6 wd showed as −30.5). Each path now shows its true lowest total float.

## v8.2 (2026-11-16)
Recovery levers now respect construction logic.
- An overlap is offered only when the link is not a physical constraint and the work can really overlap. Every finish-to-start link inside a stage is checked:
  1. Never overlap: physical-constraint pairs (formwork → rebar → shuttering closure → pour → de-shuttering, post-tensioning → pour, pipes → waterproofing → flood test / screed / tiles, tests → ceiling closing, conduits → plaster, plaster → waterproofing / paint, floor drain → floor finishes, ceiling → final paint). Editable list in the settings.
  2. Never overlap: the sequence rules already marked "no overlap" (Order of the trades).
  3. Too short to split: the predecessor must have at least 10 working days left (setting).
  4. Allowed when the two activities are in a different building, floor or zone; or the contractor already links the same pair start-to-start elsewhere (precedent); or, in the same area, the predecessor is at least twice the minimum, so the next trade can start on finished parts (marked "check").
- Each overlap card shows how many links may overlap and why, and how many stay finish-to-start and why. Each example link has a "never overlap" button; marked pairs are remembered in the settings and never suggested again.
- Structural slab cycles are no longer overlapped; extra crews / second shift stays as the lever there.
- The report's corrective action for an overlap states how many links change and on what grounds; the appendix shows the reason for each changed link.
- Lever settings are now also on the Recovery planner page.
- Fixed: floors compared as objects, so two equal floors counted as different areas.

## v8.1 (2026-11-16)
New page "Recovery planner" (Compare and analyse), wide screen:
- Top: baseline finish, current forecast, finish with the selected levers, remaining delay, where the delay started.
- Delay train of the longest path; a lever's chip on a car turns teal when the lever is switched on; click a car for its activities.
- Finish timeline (current vs with levers per stage still to come) and a waterfall of what each switched-on lever adds, in order (levers interact).
- Lever cards with a switch, owner, days alone and in the current combination, and real examples of the links or durations each lever changes (now vs with the lever). Every switch re-runs the what-if.
- "Generate recovery report (Word)": 2 pages — headline, delay train, waterfall + action table, finish timeline, corrective actions for the contractor (and items to agree with the employer/authority), appendix of changed links, assumptions.
- "Export lever table (Excel)": levers, every change of the switched-on levers, the delay train and the chain.
- Uses the files already loaded in Schedule comparison or Delay analysis, or its own two file slots.

## v8.0.1 (2026-11-16)
- Schedule comparison, section 3 (Delayed activities and the driving path): the delay train and the recovery levers now appear here too, above the lists. The long activity tables are behind a "Show the activity lists" button.

## v8.0 (2026-11-16)
Delay analysis: new "Delay train" section at the top of the results (Option A and B).
- The driving chain is traced back from the selected finish through completed work (actual dates) to the start, so the activity where the delay first entered is found even months before the data date. Predecessors that finished after an activity had already finished (out-of-sequence progress) are not taken as drivers.
- The chain is shown as cars: done (grey), in progress (amber), still to come (white), finish (navy). Each car shows the days it added or recovered; the car where the delay starts is flagged. A reading line names the origin, the largest single addition, what done work added and recovered, and the best lever ahead.
- Click a car: its activities with planned vs actual/current duration and the delay each added (origin card with planned vs actual bars for the origin car).
- Mitigation levers for the cars still to come, each tested with the what-if recalculation: overlap the trades, shorten long lags, extra crew or second shift, run approval/authority steps in parallel. Levers apply to identical copies (same activity and WBS leaf in other plots or blocks) and also show what the car alone would save. Tick levers to see the combined gain and the remaining delay.
- Settings in the section (phone and web): origin threshold, number of cars, overlap %, long-lag limits, crew %, minimum remaining duration, identical copies on/off, authority words.
- Engine: remaining duration is now stored on each activity, so the recalculation no longer depends on the raw file rows.

## v7.10.1 (2026-11-16)
- Schedule comparison: the "different project" warning no longer compares the P6 project ID (it changes with every revision or copy). It now warns only when fewer than 30% of activity IDs match between the two files (setting in Setup) and states how many matched.

## v7.10 (2026-11-16)
- New section "Tool assessment" (menu: About this tool): what the tool does, what it does not do yet, ranked enhancements with effort, and where AI can improve accuracy, with the rules for using AI. Filter tabs: All, Does, Does not, Enhance, AI.

## v7.9.1 (2026-11-16)
- Friday is the weekly rest day: check L10d now flags calendars that work Fridays (setting in Setup, on by default).
- Ramadan is treated as normal working days: reduced Ramadan hours are never flagged or counted (setting in Setup, on by default).

## v7.9 (2026-11-15)
Added after checking an outside AI review against the real 32k-activity XER. Several of its claims were already handled (progress override in the recalculation, top-down stage detection) or did not apply (no expected-finish dates in the file); the rest was added.
- New check L10d, Calendar working hours: flags calendars whose day is not the standard length, whose weekly hours exceed a limit, or whose stored weekly hours differ from the days actually worked. Two new settings in Setup: standard working day (default 8 h) and maximum weekly hours (default 60).
- New check L10e, Schedule calculation settings: reports progress override, open-ended activities not critical, expected finish in use, critical = total float, and a baseline project that is not in the file.
- Recalculation: Expected Finish dates are applied when the file's option is on (setting expectFinish: auto/on/off, default auto).
- Tests: 3 new checks (20 in total).

## v7.8
Detection on multi-contractor projects (from the same real-project comparison).
- "Stage 1" to "Stage 4" under "Typical Floors" are floor groups, not packages. WBS words are no longer read as packages when they sit under a node with floor, typical, podium, basement or level in its name. The list is a setting ("Do not read WBS words as packages when they sit under").
- Trade is suggested from a code type named Major Activities, Trade, Work package or Discipline, and zone from a code type named Zone or Rooms/Areas. Both stay "Automatic" in the detection table, so you can change or switch them off. On the test project this turns 26 keyword trades into 85 real ones and removes 4,000 "Other".
- Contractor names can be merged in a setting (one line per merge, old name = name to show) for spellings such as Kaaki / KAKI.

## v7.7
Fixes from a comparison against an independent analysis of a real 32,393-activity project (multi-vendor hotel fit-out).
- Buildings: "B1" and "B2" in activity names were read as Building 1 and Building 2 (they are basements). Now only explicit words (Building, Block, Tower, Plot, Villa) count. A new setting, "B1, B2 in activity names mean", brings the old behaviour back for projects that really use B1/B2 as buildings.
- Contractor / vendor is now a detected dimension. The tool finds a code type named Contractor, Sub-contractor, Vendor or Supplier, lists its values in the detection table (you can pick another code type), and the floor-direction table groups by building, else by contractor, else by package. The table column is renamed and each row says what it groups by.
- Door leaves and joinery: engineering, procurement and delivery activities (submittals, approvals, deliveries) are no longer counted as installation in the sequence rules, and fire cabinets / extinguishers are not joinery.

## v7.6
Order of the trades on long projects.
- The month strip showed one cell per month, so a project of two years or more had overlapping labels. It now uses at most 12 cells: months up to a year, then 2-month cells, quarters (Q1 to Q4), half-years, or years, aligned to the calendar. The year appears under the first cell of each year. Hover a cell for its exact period. The cards view uses the same periods.

## v7.5
Order of the trades.
- The trade timeline bars were drawn over the table header and looked full for any trade that runs the whole project. They are replaced by two views you can switch between, saved with the project: a month strip (each cell shaded by how many of the trade's activities are in progress) and trade cards (a small activity curve per trade, easy on a phone). Dates stay on one line.
- Table headers now always stay above the rows in every table.

## v7.4
Layout.
- Claim review and Baseline builder now use the same two-pane layout as Quick review, Schedule comparison, Delay analysis and the P6 roundtrip check: file actions and the first inputs on the left, the rest on the right (stacked on a phone). The Full-review steps (setup, files, confirmations, run, report) keep their single-column layout because they are forms.

## v7.3
Background comparison.
- Schedule comparison of large files (over 3,000 activities) now runs in a background worker, so the page stays responsive. On a 35,000-activity pair the longest freeze fell from about 5 s to under 0.5 s, and the result is identical to the in-page calculation (checked).
- If the browser cannot start the worker, the comparison runs in the page as before.
- Loading and parsing the XER files still happens in the page. Peak memory is higher while the worker holds a copy of both schedules.

## v7.2
Claim review: notice period.
- The notice test counts from the event start, taken as the date the contractor became aware of the event. Whether awareness equals occurrence is a contractual point, so the new "Count the notice period from" setting lets you use the event end instead, and the finding says which date it used. The decision on validity stays with the authorized person.

## v7.1
Wording per client.
- Project setup has three new text fields: the name of the contract conditions used in citations, the calendar clause cited in the calendar checks, and the approving party named in the approval checks. The defaults are the previous wording (Particular Conditions, A8.2, KEC / authority), so existing projects read the same. They are saved with the project.

## v7.0
Portfolio triage.
- New screen under Review: drop the XER files of several projects at once. Each is checked with the standard settings, one after another (memory is released between files), and one ranked table shows activities, data date, finish, % complete, major and other findings, negative-float and open-end counts, and the main issues. Download as Excel.
- The ranking is 3 x major findings + other findings. It tells you which project to open first; it is not a quality grade. Project-specific settings (contract dates, WBS mapping) are not applied here.

## v6.9
Update checks and carry-over of findings.
- New "Update checks" section in the schedule comparison: baseline execution index (BEI), critical path length index (CPLI), missed activities, out-of-sequence progress, remaining duration against physical percent complete, and actual dates after the data date. These are indicators for the reviewer, not conclusions.
- Thresholds (BEI, CPLI, percent tolerance in % and working days) are in the Delay analysis settings.
- Full review: activity-level carry-over of findings between reviews. The report shows what was closed, still open, new and re-opened since the previous review, and an Excel file lists them by activity (sheets New, Reopened, Still open, Closed). The activity lists are kept for the last three reviews only.
- Tested on unit fixtures and one synthetic pair, not on a real P6 update pair.

## v6.8
- Project start and finish now come from real activities only. Level-of-effort and WBS-summary activities span the whole project and no longer stretch the finish date or the duration.
- Full-review checks L1 (open ends), L7 (zero duration), L8 (float) and L9 (long durations) now look at live work only: not level-of-effort, WBS-summary or completed activities. This removes false findings on updates.
- Tested with a 35,000-activity pair: load 1.3 s, comparison about 5 s (the page is busy during that time), delay analysis 1.3 s, about 900 MB peak memory in Chrome.

## v6.7
Driving path.
- One method for the driving path everywhere: a link drives when its gap, counted in working days on the predecessor's calendar, is within the allowed gap. The recovery path in the comparison used calendar days and a fixed tolerance; it now uses the same working-day relationship gap as Delay analysis.
- Lags are counted in working days on the predecessor's calendar (before: converted with a 7-over-working-days ratio).
- Milestone rule in the path: start milestones take no time, a finish milestone takes the finish day of its predecessor (same rule as the recalculation).
- New setting in Delay analysis settings: "A link drives when its gap is at most (working days)", default 5. Level-of-effort and WBS-summary activities are skipped.
- When the XER carries P6's driving-path flag, the Recovery options section shows how many path activities carry it.

## v6.6
- The online site now asks for a password (checked on the server by a Cloudflare Worker, not in the page). The password is a Cloudflare secret named BRT_PASSWORD and can be changed there without touching the code; any user name is accepted. If the secret is missing the site stays closed.

## v6.5
- Delay analysis and P6 roundtrip check now use the new layout (files and settings on the left, results on the right; stacked on a phone).
- Claim review, Baseline builder and the Full review steps keep their current inner layout for now (they are forms and long flows), with the new frame and styling.

## v6.4
Recalculation rules (recovery scenarios and recalculated gain), from the independent review.
- Start milestones take no time (the successor starts the same day); a finish milestone takes the finish day of its predecessor. Before, every milestone cost a day.
- In-progress activities keep their actual start, and their remaining work now waits for its predecessors (retained logic). Progress override is honoured when the XER says so (Schedule options). Before, in-progress work ignored its predecessors, so gains upstream never reached it.
- Automated checks added (npm test): milestones, in-progress logic, level of effort, constraints.

## v6.3
- New setting in Delay analysis settings: "The request is addressed to" - Contractor, Consultant or PMC (internal). It changes the section title, the intro, the requested actions, the draft wording, the next-step bullets, the executive brief ("We need" row) and the appendix sheet. The reservation line is added for Contractor and Consultant, not for the internal PMC version.

## v6.2
Wording that goes to contractors, from the independent review.
- Recovery request: the tool's options are now worded as options for the contractor to propose against, not instructions ("Propose how to finish ... sooner (for example about 50% more crews)").
- New editable reservation line in Delay analysis settings (without prejudice, not an instruction to accelerate, no statement of responsibility). It is added to the draft wording in the comparison and in the Word report.
- "Likely cause" is now "Indicator (not a finding)"; "these are delaying the project" is now "a delay on these is likely to move the finish"; "Parallel (concurrent) delays" is now "Other paths also slipping".
- The statement "float belongs to the Employer - GC 17.3" was hard-coded in check T2. It is now a setting (Project setup, "Contract clause on float ownership"), empty by default.
- The critical-activities tile is no longer coloured green or red (the count can fall because work completed).

## v6.1
Fixes from the independent review of v6.0.
- Phone: the menu button was hidden by a later style rule, so no other screen could be reached. Fixed.
- Updates: actual start and finish dates are now used for started and completed work (they were read only from early dates, which P6 may leave blank for completed work).
- XER with no resources, calendars, WBS or relationships now loads instead of failing.
- Recalculation: level-of-effort and WBS-summary activities no longer hold the finish; start constraints matched exactly (start on or before is no longer treated as a floor).
- If the delay and recovery sections cannot be built, a warning now says so instead of hiding them.
- The AI consent text and README now list everything the Full-review steps can send (contract text, BOQ rates, drawings, narrative).
- The Google font request was removed, so the tool makes no network call unless AI is used.

## v6.0
- New design: grouped sidebar (Review, Compare and analyse, Build and verify), top bar with the version number, project name and AI status always visible, new colours and type.
- Schedule comparison and Quick review use the new layout: inputs on the left, results on the right. Phone: stacked, with a menu button.
- Other screens use the new frame and styling; their layouts follow in later versions.

## v5.23
- Schedule comparison: Save comparison button (named with both schedules and the date; keeps the two XER files, delay settings and any Claude review) and Open saved comparison.

## v5.22
- AI switch moved to the top of the Schedule comparison page (visible before files are loaded) and now defaults to OFF.

## v5.21
- Schedule comparison: on/off switch for Claude AI on the AI card (remembered in this browser). Off hides the AI buttons and keeps AI text out of the report and appendix.

## v5.20
- Schedule comparison: optional Claude-assisted review and suggested corrective / mitigation actions (uses the Setup → AI key, consent and model settings; two new model tasks). Results can be edited (remove suggestions) and included in the Word report (section 7) and the Excel appendix (AI review, AI actions sheets), marked as AI-assisted.

## v5.19
- Executive brief: two layouts kept, Classic (2 pages) and Narrative (1 page); dashboard layout removed.

## v5.18
- Executive brief now has three layouts: A classic, B dashboard (chart-led), C narrative (where we are / what went wrong / drivers / recovery / what we need).

## v5.17
- Schedule comparison: 2-page executive brief (Word) for senior management: headline, tiles, delay and drivers, longest-path flow chart, recovery approach and scenario charts, decisions requested.

## v5.16
- Schedule comparison: management report (Word) with charts, a driving-path flow chart and time line, recovery flow chart and scenario chart; Excel appendix with delayed, critical, driving path, recovery, scenarios, request and key-change sheets plus a Charts sheet. New setting: rows per table.

## v5.15
- Schedule comparison, Recovery options: the effect of each scenario is now recalculated. A forward calculation of the remaining work on the activity calendars, from the data date, is run with and without the scenario (more crews, overlap and lag removal, splitting, best option per activity); the recalculated gain on the finish, the projected finish, the slip remaining and the number of activities that newly drive the finish are shown. A check line compares the tool's own finish with the XER finish. Constraints other than start-no-earlier-than and resource limits are ignored.
- New section "Recovery request for the contractor": the requested action for each driving-path activity (crews, start-to-start / finish-to-finish with lag, lag removal, split), the days recovered, and a draft wording.

## v5.14
- Schedule comparison: two new sections after "Changes to look at first".
- Delayed activities and the driving path: choose whether the previous file is the baseline (planned dates) or an earlier update (forecast dates). Two lists: activities that are critical (float zero or less) and delayed, which are delaying the project, and activities that are delayed but do not drive the finish. Each shows the finish and start slip, float and a likely cause (predecessor late, duration longer, logic changed, calendar changed, starts later). The driving path (longest path to the finish) is followed backwards with the delay added at each activity, compared with the path in the reference file, and the delay is grouped by trade, building or package and floor.
- Recovery options on the driving path: per activity, days saved by more crews, overlap or lag removal (checked against the sequence rules), splitting by zone or floor, and where crews could be taken from (same labour resource, activities with float). Four scenarios show the estimated gain on the finish, limited by the float gap to the next path. These are estimates, not a recalculation. Technical holds (approvals, procurement, curing, drying, testing) are never accelerated; the word list is a setting.
- All settings are in Delay analysis settings (mode, lateness tolerance, extra crews %, overlap %, split length, minimum remaining, hold words).

## v5.13
- Schedule comparison: new first section "Changes to look at first". It flags changes to relationships (links removed on work not complete, logic relaxed from finish-to-start to start-to-start / finish-to-finish or with less lag, links added to critical work), activities added and deleted (with budget, critical and not-complete first) and original duration changes (shortened on work not started, lengthened on critical work). Critical and near-critical work comes first; the near-critical limit is the existing setting.

## v5.12
- Build sequence: new card Sequence rules. 36 rules on the order of works (stages per package, structure, block work, MEP first fix, plaster, putty, ceiling, paint first and final coat, floor tiling, skirting, door leaves and joinery, final fixtures and devices, lifts, power, HVAC, fire, testing, handover), each compared per floor and zone, per building or per package.
- Findings are warnings to check, not errors: missing logic, date overlap, and relation (start-to-start without finish-to-finish, zero lag on both, negative finish-to-start lag). Each rule accepts finish-to-start only, or finish-to-start / start-to-start + finish-to-finish with lag for large predecessors (limit in working days is a setting, default 10).
- Direction through the floors per trade (warning only when inconsistent) and same trade in several plots at the same time with no link.
- Everything is a setting: each rule on/off and accepted relation in the table; the rule list and the step keywords are editable JSON and can be downloaded and re-applied per client; paint without a coat word counts as final or first coat; date tolerance; floor-direction limit.
- Rules come from the user's described practice, not from a published standard. Door leaves and joinery follow the final coat; timber skirting is not checked against carpet.

## v5.11
- Calendars (L10a): as-built approvals are now left out of the authority-approval suggestion too (the supervision consultant reviews them on site, 6-day week). The leave-out words gain "as-built"; saved projects with the previous default are migrated.
- Build sequence: new card Stages per package. For each building, plot, area or stage package it shows the start and finish of engineering, procurement, construction and close-out, and the overlap or gap between neighbouring stages, ordered by when construction starts. Descriptive only.

## v5.10
- Build sequence: detection now copes with the five sample layouts. Floors recognise level 14, L49, Basement 1, G.F, F.F, Sub-structure and Roof floor; values from a floor code that are not floors (for example Elv11 or El) are dropped, switchable in the new Detection settings.
- New dimension Package / area / stage, read from the WBS words (editable) or from one or more code types merged together; it is used with the building to tell where a link goes.
- New setting: a zone code can be marked as a system or trade zone, so it is not used for location logic (automatic suggestion shown).
- Stages: Shop Drawings and Procurement levels in the WBS are now separate stages even when the activities are classed as construction; the stage keywords are an editable list.
- Still descriptive only.

## v5.9
- Quick review: new tab Build sequence (step 1 of the build-sequence view). It reads where each activity is (building or plot, zone, floor) and what trade it is, from the activity codes first, then the WBS, then the names, and shows what was detected with coverage and the source used. A code type can be chosen or switched off per dimension.
- Shows the stages (engineering, procurement, construction, close-out) with dates, the order of the trades with a timeline, a building x floor grid and a building-and-zone x floor grid (start to finish of each floor's work), a trade-to-trade link matrix with link types and average lag, and where the links go (same floor, across floors, zones, buildings, from shared work).
- Trade keywords are a setting (editable list of name and keywords, saved with the project, reset to default available). Descriptive only: this version does not judge the sequence.

## v5.8
- Quick review: new Loading profile. From the budgeted cost spread over the activities' planned dates it says whether the baseline is Front-loaded, Balanced, Back-loaded or Mixed. It shows how much of the budget is earned at the front time point, how much remains after the back time point, the centre of gravity and the busiest month, with each test against its limit.
- All limits are settings (Quick review > Cash flow > Limits, and Setup). Back-loading limits are the same as the full review progress-curve check; new limits for front-loading: time point (30%), budget earned by it (35%), earliest centre of gravity (45%).
- The cash-flow chart now marks the two time points; the overview has a Loading profile tile; the quick-review Excel has a Loading profile sheet and a summary line.
- Which resource carries the budget is still chosen under Which resources make up the budget; the verdict follows that choice.

## v5.7
- Calendars (L10a): shop drawing and material approvals are no longer suggested as KEC/authority approvals, because the supervision consultant reviews them on site in a 6-day week. They now follow the engineering / procurement calendar (6-day). Authority approvals and NOCs keep the 5-day calendar.
- New setting "Leave out of the suggestion" (Setup, approval activities) holds the words that are kept out of the approvals list (default: shop draw, material, submittal, sample, mock-up, method statement). You can edit it, and still tick or untick any activity by hand.
- Saved projects from before this version are migrated: shop drawing and material approvals are removed from their approvals list when the project is opened.

## v5.6
- Fix: check R3 (and other progress/cost checks) failed every activity when the XER contained two resources with similar names, for example an old unused "Progress" resource next to the new "Progress Cost". The tool took the first name match. It now picks, among the matches, the resource that is really assigned to activities, and a saved project profile can no longer put back a resource with no assignments.
- R3 now names the resource it checked and the resources that do carry assignments, so a wrong pick is visible at once.

## v5.5
- Productivity library reads optional Low rate, High rate and Confidence columns (the new productivity bank v2.x has them). New setting "Rate used": Typical, Low (conservative, longer durations) or High (optimistic). Both fall back to Typical when a row has no Low/High.
- Hot-climate factor (default 0.9) multiplies output for outdoor disciplines; the factor and which disciplines count as outdoor are both settings in the productivity section. Reopened old project files now take the 0.9 default; set it to 1 to switch it off.
- Duration notes show the rate case, climate factor and confidence; a validation warning lists BOQ items that rely on Low-confidence library rates (single source or unsourced estimate).

## v4.3
- WBS follows the KEC layout: Milestones, Mobilization Work (preliminaries), Engineering Work (with submittals), Procurement Work, Construction Work, Testing and Commissioning, Project Closure (handover), with the bills under each phase. The old bill-then-stage layout stays as an option. Empty phases are left out.
- Cost resource gets its own ID (BOQ-COST) and stays a Material resource. P6 had matched the old ID COST to an existing Nonlabor resource in the database.

## v4.2.3
- Wording only: the builder now states that the XER imported successfully into P6 20.12 (30 Oct 2026); values still to be checked by the user.

## v4.2.2
- XER rewritten to mirror a real P6 20.12 export: same table order (project before calendar), full field lists copied from a real file, scheduling options, financial period template, resource rates table, a single global calendar, early/target dates from the preview, deterministic GUIDs. Replaces fields the first version invented (for example a checksum flag that P6 does not have).

## v4.2.1
- XER fix: the file had an end-of-data marker after every table, so P6 stopped reading after the first table and listed no project in the import window. Now one marker at the end. Also added the project export flag, a separate global calendar for the two resources, and plain ASCII dashes and arrows in the text.

## v4.2
- Baseline builder: milestones (project start and completion, a start and complete milestone per bill) tie every BOQ item into one network. Links between bills are a template suggestion (discipline order, SS+10d placeholder) that the engineer edits, accepts or removes; manual links can be added by activity ID. Open ends, disconnected groups and loops block export.
- Optional time-only stages: submittals and approvals, handover (switch per bill, preset defaults).
- Productivity library (Excel upload, nothing built in): duration = quantity / (output per crew per day x crews), rounded up, with the formula kept as provenance; manual duration override with a reason.
- Optional grouping of small BOQ lines per bill; optional Area / building column adds a WBS level.
- Schedule preview (forward/backward pass, FS/SS/FF with lag, one calendar): finish date, longest path, float, Gantt by bill and a bill network diagram. Preview only, not P6-equivalent.
- Save and reopen the builder (.brtb file with the BOQ, settings, overrides, links and library). Audit workbook adds Relationships, Reconciliation, Assumptions and a P6 import checklist.

## v4.1
- Baseline builder fixes: calendar now Sat-Thu working (Sunday was missing; generated from the chosen days and hours and checked on export); bill totals no longer multiply on rebuild; the cost resource now has price 0 so the budget is carried once, by the progress resource; earthworks and roads have no testing stage (utilities keep one).
- Export validation: blocks on negative or invalid percentages, splits not 100, duplicate IDs, missing predecessors, loops and calendar mismatch; warnings need acknowledgement; status label "Draft BOQ skeleton".
- Optional Claude double-check with selectable checkpoints (BOQ sanity, classification, stage split, logic, final review).

## v4.0
- New module: Baseline builder. Reads a BOQ (Excel, CSV, PDF text), splits each item across engineering, procurement, construction and testing/handover (project default, bill presets, item overrides), builds the mapping sheet (Excel), a progress resource (price per unit 1) and a cost resource (follows the BOQ), and exports an XER with WBS, activities, logic and resource assignments for P6.

## v3.5
- Quick review: every wrong-relationship finding now carries a "Suggested correct logic" (SF, SS/FF lag longer than the activity, negative lags, FS lags, duplicate/contradictory links, constraints, invalid links and loops, open ends and dangling). Shown in the table and in the Excel export.

## v3.4
- Quick review: the single 'open ends' test is split in two. Q1 Open ends = activities with no relationship at all (no predecessor and no successor). Q2 Dangling activities = linked on one side only, or driven only by FF predecessors / SS successors, with no start or finish constraint to fix the date (completed, LOE, start milestones and project finish excluded).

## v3.3
- Delay report rewritten in plain, human wording. New section 7: extension-of-time position (Employer / neutral / Contractor / unassigned days, recommended EOT and adjusted completion date, days the Contractor must recover), Employer-related delay, Contractor corrective and mitigation actions, points to settle before issue. Executive summary and tiles now state the extension due and the days to recover.

## v3.2
- Delay analysis: narrative report (Word) with executive summary, flow charts of how the delay reached the finish, method flow chart, waterfall, network diagrams, cause/party charts, event write-ups, parallel paths, reliability checks and recommended actions. Works for Option A and Option B.

## v3.1
- Delay analysis: ignore small movements (default under 3 days) so weekends/holidays do not create false events; delay inherited at the point where a path merges into a higher path is no longer counted again; late-start notes only on real events.

## v3.0
- New module: Delay analysis. Option A (baseline vs update) and Option B (windows analysis). Driving-path trace to a chosen activity, next 2-5 critical paths, slip split into late start / duration growth / logic change, network diagrams, delay waterfall, parallel (concurrent) delays, data-integrity checks, responsible-party tags, Excel export, save/open with the project file.

## v2.6
- Comparison: duration table now shows planned finish and a likely-cause column (placeholder finish dates such as 2030-01-01, calendar difference, rounding only, re-set duration) with summary counts.

# Baseline Review Tool – change log
- v2.5 – Comparison: duration table shows XER hours and calendar hours/day; durations longer than the project flagged.
- v2.4 – Save / open project (.brtq) for Quick review and comparison; new Schedule comparison (12 sections, Excel export).
- v2.3 – Menu: removed "PMC planning"; added "Prepared by Engr. Mohamed Hamdi".
- v2.2 – Quick review: Calendars tab redesigned (calendar cards, holiday tags, category bars).
- v2.1 – Quick review: value labels on cash-flow and manpower charts; cleaner axes.
- v2.0 – Quick review (XER only): cash flow, relationship rules, manpower, activity codes, calendars; Excel download.
- v1.x – Full review: checks, Word/Excel report, AI reviews, programme overview diagram, project bundle export/import.

## v4.4 (Plan A, stage 1)
- Builder: one 8-hour shift per day, no hours-per-day setting (removes the invalid 26:00 times). Path trace has no 500-activity cap. XER/ERMHDR dates come from the project start, so identical input gives an identical file; content hash shown.
- Claude key: kept for the session only unless 'Remember' is ticked; consent box required before any Claude step.
- Delay analysis: delay assessment only. New section 'Activities driving the finish' with three lists (driving now with the reason, delayed and driving, delayed but not driving with float), tie detection, provisional flags (out-of-sequence, mandatory constraints, non-zero-gap links, stale schedule, changed driving path). Windows analysis stops with an error if the target activity is missing. All entitlement / extension-of-time wording removed from screen, Word and Excel. Party tags kept as optional notes.

## v4.5 (Plan A, stage 2: Builder)
- BOQ rows not scheduled are listed on screen and in the audit workbook, with the reason (zero amount with a quantity is flagged as a possible missing price).
- Duplicate item numbers are checked per bill/section, not across the whole BOQ.
- Every warning needs a written reason before the XER can be downloaded; reasons go into the audit workbook.
- Holidays: entered in section 2, written to the XER calendar exceptions and excluded in the preview.
- 'Developed schedule' now also needs a confirmed project-wide logic review (cleared when any link changes).

## v5.0 (Plan B: claim workflows)
- New 'Claim review' module. Option 2: initial review of a Contractor EOT claim. Option 3: independent PMC review of an Engineer evaluation (three-way Contractor / Engineer / PMC days, suggested and chosen PMC action).
- Clause register (user-approved text only; 'contractual basis unverified' otherwise), notice check against a user-entered notice period, evidence matrix, overlap detection (days not summed), events checked against the loaded delay analysis (driving path, delay added).
- Status flow Pending Evidence > Reviewed > Proposed Assessment > Approved by Authorized Person, approval only in the named authorized person's name; decision log; save/open .brtc; Excel import/template; Excel and Word outputs. Preliminary review only: no entitlement is calculated.

## v5.1 (Plan C: bundled libraries, P6 roundtrip)
- Excel, Word, PDF reader and zip libraries are now inside the HTML (gzip, ~2 MB file). Exports and PDF reading work with no internet. OCR (Tesseract) is still loaded online when used.
- New 'P6 roundtrip check': compares the XER the tool generated with the project exported back from P6 (project dates, calendar, activity dates/durations/float/types, relationships and lags, resources, assignments and cost). Excel of differences.

## v5.2 (Plan C: productivity evidence library, AI gap-filling)
- Library columns: source, maximum crews, conditions (besides rate, crews, note). Duration notes show the source and conditions; warning when assumed crews exceed the library limit.
- Items with no library rate (lump sums excluded) are listed. Claude can suggest low / typical / high output per crew for them: only with AI on, key and consent; shows exactly what is sent; each figure is 'AI suggested, not confirmed' until the engineer accepts it (and can choose low/typical/high); your own library always has priority; saved in the .brtb.

## v5.3 (Plan C: network view, interactive Gantt, path comparison)
- Baseline builder: activity-level network for one package at a time (search, zoom, link rationale on hover, open ends in red, dashed neighbours from other packages, link colours by origin).
- Delay analysis: interactive Gantt of the driving path (find, only-moved filter, zoom, earlier vs current bars) and a driving-path comparison (activities that left / joined the path, % of the path unchanged) for Option A and for each window in Option B.

## v5.4 (Plan C: large-schedule handling)
- Loading an XER (full review, Quick review, Schedule comparison, Delay analysis) shows a progress bar with stages (reading, parsing, building the model) and lets the page paint between stages. Longest freeze at 35,000 activities dropped from about 0.35 s to about 0.25 s.
- Measured on synthetic 10,000 and 35,000 activity schedules: see the performance note. No web worker was added because no freeze was found (see message).
