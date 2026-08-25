# RiskFlow — Risk-Adjusted Scheduler — Build Plan

## App Overview

A mobile-first Progressive Web App for single-project schedule and cost risk
analysis, styled after Oracle Primavera P6. The user enters activities, links
dependencies, and gives each a three-point estimate (optimistic / most likely
/ pessimistic) for duration and cost. Running the simulation converts the
deterministic plan into a probabilistic forecast via Monte Carlo simulation
(PERT-Beta or triangular sampling, dependency-aware forward pass each trial),
reporting the schedule and cost contingency needed to hit P50 / P80 / P90
confidence, visualised as a risk-adjusted Gantt and an S-curve.

This adapts `~/Downloads/plan.md` (the original native-SwiftUI/iOS MVP plan)
to this project's actual delivery model: **Django + vanilla JS + PWA**, the
same pattern as YogaFlow, PranaFlow, and CardioFlow — installed to the
iPhone home screen via Safari rather than shipped through the App Store.
Swift/SwiftData/Swift Charts concepts in the original plan map to:
SwiftData → `localStorage`; Swift Charts → hand-rolled `<canvas>` renderers;
NavigationSplitView landscape split → CSS grid at a landscape breakpoint.

## Tech Decisions

- **Backend**: Django (5.x), single app (`scheduler`), single view rendering
  one template at `/`. No DRF, no API endpoints — everything client-side.
- **Frontend**: One template, vanilla JavaScript split into `engine.js` (pure,
  DOM-free simulation engine — samplers, CPM, Monte Carlo), `sample-data.js`
  (8-activity construction example), and `app.js` (state, DOM rendering,
  canvas charts). No framework, no build step.
- **Data persistence**: `localStorage` holds the whole project (activities +
  run settings). No server-side persistence. Export/import JSON for
  portability (`{version, currency, tasks}` schema).
- **PWA**: `manifest.json` + service worker (`sw.js`, cache-first app shell),
  installable, standalone display mode.
- **Charts**: Canvas 2D, hand-rolled — a Gantt (bars at the selected
  confidence envelope, critical path in amber, contingency band, deterministic
  + confidence markers) and an S-curve (cumulative probability, gradient
  fill, P50/P80/P90 markers).

## Design system (Primavera P6-derived, plan.md §3)

- **Palette**: paper `#EEF1F4` / `#F7F9FB`, ink `#14202B`, hairlines
  `#C3CCD6`, schedule blue `#1F6091`, risk amber `#E07B2C`, teal `#2F8A80`,
  danger `#B5453A`. Full dark-mode palette via CSS custom properties
  (`prefers-color-scheme` + manual `data-theme` override, cycled by the
  header's theme button).
- **Type**: system font stack (resolves to SF Pro on iOS) for UI text;
  `ui-monospace`/SF Mono with IBM Plex Mono (Google Fonts) fallback for all
  numerics and column headers, tabular figures throughout.
- **Chrome**: flat toolbars, hairline dividers, blueprint-grid empty states,
  10px corner radius, small-caps letter-spaced column headers.
- **Layout**: bottom tab bar (Activities · Run · Gantt · S-Curve · Project);
  landscape (`min-width: 700px`) reveals a P6-style split — activity table
  + mini-Gantt side by side via CSS grid.

## Feature status

**Activities** — done: tabular list with critical-path dot (static CPM,
recomputed on every edit), O–P range / M-value duration & cost columns,
dependency chips, add/edit sheet with inline validation, delete with
dangling-dependency cleanup, empty state, sample-project load.

**Run** — done: iterations (1k/5k/10k/25k), distribution (PERT-β/triangular),
Gantt confidence (P50/P80/P90), currency (en-IN L/Cr abbreviation for INR,
k/M for other codes), chunked async simulation (`setTimeout`-batched, keeps
UI responsive) with progress bar, schedule + cost KPI cards and contingency
lines.

**Gantt** — done: per-activity bars at the selected confidence envelope,
critical path amber vs blue, contingency band (deterministic → risk-adjusted
finish), deterministic (dashed) + confidence (solid) markers, day gridlines,
horizontal scroll for long schedules.

**S-Curve** — done: cumulative probability curve (thinned to 120 points),
gradient fill, P50/P80/P90 dashed markers with labels, schedule/cost toggle.

**Project** — done: rename, load sample, export/import JSON, clear project,
"how it works" + independent-sampling-caveat explainer.

**PWA** — done: manifest, icons (generated via `scripts/generate_icons.py`,
P6-styled staggered Gantt-bar mark), service worker with cache-first shell
and `/sw.js` served at root scope for full coverage.

## Verified

- CPM/critical-path logic confirmed correct on the 8-activity sample
  (parallel Roofing/MEP branches — the shorter branch correctly excluded from
  the critical set).
- Simulation run produces sane P50 ≈ deterministic, P80/P90 growing
  contingency, for both schedule and cost.
- Activity validation (name required, O≤M≤P, cycle detection) blocks save
  with inline errors; fixing the input allows save.
- Theme cycling (system → light → dark → system) applies correctly.
- Landscape split (activities + mini-Gantt) engages at the `700px` breakpoint.
- No console or server errors across the above.

## Open / future work

Same as the original plan's non-goals: accounts, cloud/team sync, Android,
correlation modelling, resource levelling, WBS trees, baselines/actuals,
notifications, working-day calendars. Deploy config (`render.yaml`) is
scaffolded but unused until the user decides to host it beyond their phone.
