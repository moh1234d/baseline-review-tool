# Baseline Review Tool

Single-file P6 schedule review tool (schedule comparison, delay analysis, baseline builder, claim review, P6 roundtrip).
The tool runs entirely in the browser: schedules and documents are processed on the user's device and are not uploaded to the host.
The only network call is the optional Claude AI step, which sends the text shown in that step to Anthropic, only when the user switches AI on and gives consent.

## Do not commit project data
No XER, BOQ, contract, report or saved-project files belong in this repository (`.gitignore` blocks the common types).

## Build
    npm ci
    python3 build.py      # writes dist/index.html

## Deploy (Cloudflare Pages, built from this repo)
- Build command: `npm ci && python3 build.py`
- Build output directory: `dist`
- Protect the site with Cloudflare Access (Zero Trust) so only named users can open it.

Source is in `src/` (engine*.js = calculations, app*.js = screens). Version is in `src/VERSION`; add a line to `src/CHANGELOG.md` for every change.
