# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RiskFlow is a mobile-first Progressive Web App for single-project schedule and
cost risk analysis, styled after Oracle Primavera P6. Users enter activities,
link dependencies, and give each a three-point estimate (optimistic / most
likely / pessimistic) for duration and cost. Running a Monte Carlo simulation
(PERT-Beta or triangular sampling, dependency-aware forward pass per trial)
converts the deterministic plan into a probabilistic forecast — schedule and
cost contingency needed to hit P50/P80/P90 confidence — visualised as a
risk-adjusted Gantt chart and an S-curve.

It ships two ways from the same codebase: as an installable PWA served by
Django (add to iPhone home screen via Safari), and as a native iOS shell
built with Capacitor around a static export of the same web app.

`plan.md` is the original build plan/spec (design system, feature list,
verification notes as of initial delivery) — read it for the "why" behind
UI/UX decisions, but treat this file as authoritative for how to work in the
repo day to day, since the app has grown past that snapshot (e.g. multi-project
switching and Excel export exist in `app.js` now but aren't in `plan.md`).

## Architecture

**Backend is minimal by design.** Django (5.x) has exactly one app,
`scheduler`, with one real view (`scheduler/views.py:index`) that renders one
template (`scheduler/templates/scheduler/index.html`). There is no database
usage, no DRF, no API endpoints — `scheduler/models.py` is empty. Everything
after the initial page load — simulation, persistence, chart rendering,
Excel export — runs client-side in the browser. `scheduler/urls.py` also
serves `/privacy/` (static page, required for App Store review) and `/sw.js`
(service worker, deliberately served at root scope rather than under
`/static/` so it can control the whole app — see the comment in
`service_worker()`).

**Frontend is vanilla JS, no build step**, split across
`scheduler/static/scheduler/js/`:
- `engine.js` — `RiskEngine`, a pure DOM-free module (IIFE attached to
  `window`): PERT-Beta/triangular samplers, Kahn topological sort, CPM
  (critical path via forward/backward pass on PERT-mean durations),
  percentile math, project validation, and the chunked Monte Carlo loop
  (`runSimulation`, batches of 400 iterations via `setTimeout` to keep the UI
  thread responsive, reports progress). Kept separate from `app.js`
  specifically so the math can be tested/reasoned about independently of DOM
  state.
- `app.js` — all application state, DOM rendering, and canvas chart drawing.
  Single `state` object + a large set of top-level functions organized under
  `// ---------- Section ----------` banner comments (Formatting, DOM cache,
  State, Theme, Tabs, Activities, Run, Gantt, S-Curve, Project actions,
  Multi-project switcher, Excel export, Landscape split, Service worker,
  Init). No framework, no reactive bindings — functions mutate `state` then
  call the relevant `render*` function directly.
- `sample-data.js` — the 8-activity demo project ("Load Sample").
- `sw.js` — cache-first service worker for the PWA app shell.
- `vendor/exceljs.min.js` — bundled dependency for the Excel export feature
  (Activities/Summary/Gantt/S-Curve sheets, generated client-side from the
  simulation result).

**Persistence is `localStorage` only**, no server round-trips. State is
multi-project: `PROJECTS_KEY` holds an array of projects, `ACTIVE_PROJECT_KEY`
the selected one. `loadProjects()` in `app.js` also migrates a legacy
single-project store (`LEGACY_STORAGE_KEY`) from before multi-project support
existed — preserve that migration path when touching storage code, since
real users' browsers may still carry the old key. Export/import uses a
portable `{version, currency, tasks}` JSON schema, independent of the
internal multi-project storage format.

**Dual delivery from one Django app**:
- PWA: served directly by Django/gunicorn (see Deployment below);
  `manifest.json` + `sw.js` make it installable.
- Native iOS: `scripts/export_static.py` renders `index.html` with
  `STATIC_URL` forced to `/static/` (so `{% static %}` tags produce
  root-relative paths that work when Capacitor serves the bundle from
  `webDir`) and copies `scheduler/static/scheduler/` into `mobile/www/`,
  excluding the PWA-only `manifest.json`/`sw.js`. No Django process runs
  inside the native app — it's a fully static bundle wrapped by Capacitor.
  `mobile/` has its own `package.json` (Capacitor CLI/core/ios) and is a
  separate npm project; see `mobile/README.md` for the full Mac-side
  (Xcode/CocoaPods/signing) workflow. `.github/workflows/ios-build.yml` runs
  an unsigned simulator-SDK build on every push touching `scheduler/**`,
  `mobile/**`, or `scripts/export_static.py`, as a sanity check that the
  export + Capacitor sync + native project still build together.

## Commands

Local dev server:
```bash
python manage.py runserver 8000
```
(`.claude/launch.json` runs this the same way via `.venv/Scripts/python`,
i.e. a Windows venv — adjust the interpreter path for other platforms.)

Install dependencies:
```bash
pip install -r requirements.txt        # runtime: Django, gunicorn, whitenoise
pip install -r requirements-dev.txt     # adds Pillow, for the icon-generation scripts
```

Django management commands (standard):
```bash
python manage.py migrate
python manage.py collectstatic --no-input
```

There is no configured JS/Python test suite or linter — `scheduler/tests.py`
is the empty Django boilerplate and no test runner is wired up. `RiskEngine`
in `engine.js` was written to be independently testable (pure functions, no
DOM), but no test harness currently exercises it; if you add tests, that's
the natural place to start.

Regenerate PWA icons (after changing the icon design in
`scripts/generate_icons.py`):
```bash
python scripts/generate_icons.py   # writes scheduler/static/scheduler/icons/
```

Regenerate iOS icon/splash source images:
```bash
python scripts/generate_ios_assets.py   # writes mobile/resources/
```

Export the static bundle for the iOS shell (run after any change under
`scheduler/static/` or `scheduler/templates/` that should ship natively):
```bash
python scripts/export_static.py   # writes mobile/www/
cd mobile && npx cap sync ios     # Mac-only: copies mobile/www/ into the Xcode project
```

Mobile project (from `mobile/`):
```bash
npm install
npx cap add ios       # first time only, Mac-only: generates the Xcode project
npx cap sync ios       # re-run after any web app change
npx cap open ios       # opens Xcode
```

## Deployment

Deploys to Render via `render.yaml` (build: `./build.sh` — installs deps,
collectstatic, migrate; start: `gunicorn riskflow.wsgi:application`).
`DJANGO_DEBUG` is explicitly `"False"` in production; `SECRET_KEY` is
generated by Render. `ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` are derived from
`RENDER_EXTERNAL_HOSTNAME` in `riskflow/settings.py` — when `DEBUG` is off,
security settings (`SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`,
`CSRF_COOKIE_SECURE`) turn on. Static files are served by whitenoise
(`CompressedManifestStaticFilesStorage`), not a separate CDN/proxy.

## Conventions worth knowing

- Vanilla-JS style throughout `app.js`/`engine.js` is pre-ES6: `var`, plain
  `function` declarations, no arrow functions, no classes, no modules —
  match this style rather than introducing modern syntax mid-file.
- `engine.js` must stay DOM-free and side-effect-free (no `document`/`window`
  UI access, no direct state mutation) so it stays usable/testable in
  isolation from `app.js`.
- Design tokens (colors, spacing, radii) live as CSS custom properties in
  `scheduler/static/scheduler/css/styles.css`, with light/dark values keyed
  off `prefers-color-scheme` and a manual `data-theme` override (cycled by
  the header's theme button) — don't hardcode colors in JS or templates.
- Numeric/tabular UI (durations, costs, column headers) uses the monospace
  font stack (`ui-monospace`/SF Mono, IBM Plex Mono fallback); regular UI
  text uses the system font stack. Keep new numeric displays consistent with
  this.
- Both Gantt and S-curve charts are hand-rolled on `<canvas>` (no charting
  library) in `app.js` — `drawGanttChart`/`drawSCurveChart`. The Gantt
  renderer is shared between the main Gantt tab and the landscape mini-Gantt
  preview pane.
