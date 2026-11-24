# Baseline Review Tool

Single-file P6 schedule review tool (schedule comparison, delay analysis, baseline builder, claim review, P6 roundtrip).
The tool runs entirely in the browser: schedules and documents are processed on the user's device and are not uploaded to the host.
The only network call is the optional Claude AI step, only when the user switches AI on and gives consent. Schedule comparison sends codes, names, dates and days. Full-review steps can also send contract text, BOQ pages (with rates and amounts), a layout drawing and the narrative; the consent text in Setup lists this. Check the Employer allows it before using those steps.

## Do not commit project data
No XER, BOQ, contract, report or saved-project files belong in this repository (`.gitignore` blocks the common types).

## Build
    npm ci
    python3 build.py      # writes dist/index.html

## Deploy (Cloudflare Workers static assets, built from this repo)
- Build command: `npm ci && python3 build.py`
- Deploy command: `npx wrangler deploy` (reads `wrangler.jsonc`, serves `dist`)
- Protect the site with Cloudflare Access (Zero Trust) so only named users can open it.

Source is in `src/` (engine*.js = calculations, app*.js = screens). Version is in `src/VERSION`; add a line to `src/CHANGELOG.md` for every change.

## Password
The hosted site is protected by a Worker (`worker/index.js`) that checks HTTP Basic auth. The password is the Worker secret `BRT_PASSWORD` (Cloudflare dashboard > Workers > baseline-review-tool > Settings > Variables and Secrets). Never commit it. `npm test` covers the check.


## Before publishing

Publishing = pushing to `main` (Cloudflare builds and deploys it). Run `sh tools/install-hooks.sh` once per clone: from then on every push to `main` runs `npm test` first and is stopped if anything fails. `npm test` covers the scheduling engine, the worker, and (with Playwright) the Recovery planner file-swap check in `tests/recovery-files.test.js`: it loads an old baseline, replaces the baseline and then the update, and fails if any path, box, view or hover note still shows figures from a replaced file, or shows “on time” for an activity with no baseline.
