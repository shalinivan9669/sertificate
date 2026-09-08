# Internal LMS navigation and font-loading lab

`scripts/lms-nav-layout-lab.mjs` is a focused companion to the existing `performance-lab.mjs`, not a rerun of its homepage comparison or API burst. It keeps the same cold browser cache, DPR 1, CPU ×4, 150 ms latency and 1.6/0.75 Mbps network profile used for the earlier mobile observation. The existing `tests/prepare-performance-session.mjs` remains responsible for normal verified HTTP sign-in; the measurement script never creates a session through SQL or signs in itself.

Run only against an explicitly local **already running** build. The script does not start a server or modify build output. Prepare the existing terminal-attempt session with the existing helper for that server, using `NODE_ENV=test`, `OT_ALLOW_TEST_SEED=1`, the explicit local `.data/e2e.sqlite` database and `PERF_CURRENT_BASE`. The helper refuses remote/Vercel databases and academic fixture creation. Session cookies and the terminal URL remain in ignored `.data` files.

Example after the coordinating executor supplies the actual ports:

```powershell
$env:PERF_CURRENT_BASE = 'http://127.0.0.1:3110'
node tests/prepare-performance-session.mjs
$env:LMS_LAYOUT_LABEL = 'baseline'
node scripts/lms-nav-layout-lab.mjs baseline http://127.0.0.1:3110

# Refresh the session with the same helper if the updated server requires it.
$env:PERF_CURRENT_BASE = 'http://127.0.0.1:3111'
node tests/prepare-performance-session.mjs
$env:LMS_LAYOUT_LABEL = 'after'
$env:LMS_LAYOUT_REFERENCE = 'artifacts/performance/lms-nav/baseline/report.json'
node scripts/lms-nav-layout-lab.mjs after http://127.0.0.1:3111
```

These ports are illustrative; no server is launched by these instructions. `LMS_LAYOUT_LABEL` permits a separate output directory for each preserved run. `LMS_LAYOUT_REPEATS` accepts 1–3 and defaults to 1; before and after must use the same repeat count and installed Chrome version. `BROWSER_PATH` can select an existing Chrome/Chromium executable. Actual build IDs are obtained over HTTP from `/_nuxt/builds/latest.json`, so a source label is not treated as proof of build identity.

The matrix is RU/KK × 360/390/420/768 px × catalog/existing terminal exam × two modes: **32 navigations per repeat**. Each uses a fresh browser context. An initial GET preflight requires the verified synthetic learner and an already graded/expired attempt with a stored result. Catalog views are anonymous. Navigation requests allow only GET/HEAD/OPTIONS; any attempted mutation fails the run. The test requires a hydrated page, 20 catalog cards or a real terminal-result view, three internal nav links, successful Inter/Manrope font loading, no overflow and no browser/resource errors.

The two measurement modes have different purposes:

- **Natural:** ordinary cold navigation with the profile above. It records the observed layout-shift sum, font events and changing nav/link geometry. A sum above 0.1 is explicitly reported as a quality observation, not silently counted as a threshold pass.
- **Held fonts:** font requests wait until the hydrated page and catalog/result are ready with fallback fonts. The script captures geometry and a screenshot, releases the font requests, then records settled geometry and another screenshot. It requires an actual pending font request and subsequently loaded web fonts. In the after run, a changed nav row count, nav height or link row position beyond 1 CSS px fails the comparison. This artificial delay diagnoses wrapping stability; its total shift value is not a natural user-performance measurement.

Geometry includes nav bounds, link bounds and row positions, the shell/header position, actual computed font styles, and font loading events. Layout-shift attribution records element regions and rectangles without copying question/answer/account contents. A shift entry mentioning a nav link may also contain other sources; its value is not claimed as an exact per-element contribution. The recorded sum excludes shifts with recent user input, matching the preceding local performance report. It is **not a full-session field CLS, INP or Core Web Vitals pass**.

Reports and viewport screenshots are written under ignored `artifacts/performance/lms-nav/<label>/`. Raw attempt identifiers, cookies and passwords are omitted from report URLs. Screenshots show only the explicitly synthetic local fixture. The script exits nonzero for incomplete comparisons, invalid preflight, functional failures or unstable internal navigation in the after held-font mode. Natural shift values above 0.1 remain visible for review even if the nav-specific checks pass.

Preparation validation: `node --check scripts/lms-nav-layout-lab.mjs` and `npx eslint scripts/lms-nav-layout-lab.mjs` passed. Browser measurements require the supplied baseline and updated build URLs; preparation alone is not a measurement result.


## Executed comparison and narrow CSS fixes

The full matrix actually ran three times in Chrome 152.0.7977.76, with one repeat per scenario:

| Phase | Actual build ID | Started UTC | Navigations | Functional failures | Natural sums above 0.1 |
| --- | --- | --- | ---: | ---: | ---: |
| Preserved baseline | 6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9 | 2026-09-07T14:51:20.198Z | 32 | 0 | 3 |
| Mobile LMS grid only | 44e942f1-8474-49ef-85ce-a0b1299f45f0 | 2026-09-07T14:59:28.776Z | 32 | 0 | 2 |
| LMS grid + narrow KK header reserve | 718c3f06-35b3-4e4c-8c0c-2e36e939a049 | 2026-09-07T15:07:53.580Z | 32 | 0 | 0 |

Baseline font withholding reproduced four unstable internal-nav cases among 16: catalog RU/360 and KK/360 moved their second link to another row, while terminal exam RU/390 and KK/360 grew the nav from 20 to 48 CSS px. The mobile grid in components/lms/LmsShell.vue keeps three explicit rows below the existing sm breakpoint. At sm and above the existing flex layout remains. All 16 final controlled scenarios kept the nav height, row count and link row positions stable within 1 CSS px.

The baseline KK/360 outer header also moved MAIN down 34 px during the font swap. A separate anonymous GET-only scan at every integer width from 320 to 420 px established the actual boundary: fallback fonts use two menu rows from 353 px, while loaded fonts use three rows through 366 px and two rows from 367 px. layouts/default.vue therefore reserves the existing 116 px (7.25rem) height only for KK menu widths through 366 px (22.875rem). A post-build repeat compared all 101 loaded layouts: menu height, link rows and MAIN top were preserved, with zero differences above 1 px. RU, wider headers, HomePageClassic, fullwidth layout, font faces and brand styles were not changed by this reservation.

Final natural cold-navigation observations are below. These are single-run observed shift sums, with no field-performance or statistical significance claim. The two controlled CSS changes are supported independently by the fallback/loaded geometry checks.

| Locale | Width | View | Baseline observed sum | Final observed sum |
| --- | ---: | --- | ---: | ---: |
| RU | 360 | catalog | 0.00810 | 0.00045 |
| RU | 360 | terminal-exam | 0.00064 | 0.00045 |
| KK | 360 | catalog | 0.19926 | 0.00884 |
| KK | 360 | terminal-exam | 0.19926 | 0.00884 |
| RU | 390 | catalog | 0.01118 | 0.00999 |
| RU | 390 | terminal-exam | 0.18025 | 0.00055 |
| KK | 390 | catalog | 0.00191 | 0.00164 |
| KK | 390 | terminal-exam | 0.01272 | 0.01048 |
| RU | 420 | catalog | 0.05157 | 0.03620 |
| RU | 420 | terminal-exam | 0.04510 | 0.01873 |
| KK | 420 | catalog | 0.01103 | 0.00990 |
| KK | 420 | terminal-exam | 0.00259 | 0.00104 |
| RU | 768 | catalog | 0.00360 | 0.00243 |
| RU | 768 | terminal-exam | 0.00747 | 0.00747 |
| KK | 768 | catalog | 0.00091 | 0.00372 |
| KK | 768 | terminal-exam | 0.00119 | 0.00122 |

The final maximum among 16 natural cases was 0.03620. The previously observed RU/390 terminal shift of 0.18025 is resolved in this focused candidate to 0.00055; the two KK/360 cases changed from 0.19926 to 0.00884. This closes those reproduced local navigation issues for the tested candidate and widths. It does not rewrite the earlier full homepage/API performance experiment or certify a hosted final build.

All three matrices returned HTTP 200, hydrated, loaded both tested web fonts, and had no JavaScript errors, failed resources, horizontal overflow or attempted mutations. Each phase saved 48 viewport screenshots. The baseline RU/390 fallback/loaded pair and final RU/390 terminal and KK/360 catalog screenshots were also inspected manually. The baseline briefly overlapped an initial cancelled build; later no heavy build overlapped the matrix. Shared-host developer activity remains a limitation for natural observations, and controlled geometry is the primary regression evidence.

Two CSS-only scratch builds used official Nuxt cleanup, verified that generated caches were removed, then ran npm run build with OT_NOINDEX=false and OT_BUILD_MODE=1. Both exited 0. The final scratch artifact passed 550 public SEO contracts and the asset gate: 551 HTML files, 15,770 references, one build ID and zero missing files. The original repository build outputs and academic content were not edited. The existing synthetic session passed GET preflight on both local origins without a new sign-in during these measurements.

Evidence directories: artifacts/performance/lms-nav/baseline, after-lms-grid and after-nav-reserve contain reports and screenshots. header-boundary.json, header-boundary-after.json and header-preservation.json record the 101-width check. Build logs are saved with each candidate report. The final scratch server used port 3102; the preserved baseline used port 3101. Runtime CSS changes are limited to components/lms/LmsShell.vue and the header-nav class/styles in layouts/default.vue. Focused ESLint, JavaScript syntax checking and the unchanged HomePageClassic/fullwidth git guard passed.
