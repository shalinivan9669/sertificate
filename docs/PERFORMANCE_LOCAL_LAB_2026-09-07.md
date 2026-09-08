# Final local performance comparison — 2026-09-07

A later [focused LMS navigation/font-loading comparison](LMS_NAV_LAYOUT_LAB.md#executed-comparison-and-narrow-css-fixes) reproduced the terminal-view shift below and validated a narrow CSS fix in local candidate build `718c3f06`: RU/390 terminal observed shift sum changed from 0.18025 to 0.00055, and all 16 controlled navigation scenarios retained their rows/height when fonts loaded. The original full experiment and its numbers below remain historical evidence for build `6aa9fbb6`; the focused candidate check does not replace the homepage/API measurements or establish field Core Web Vitals.

This report replaces the earlier intermediate measurements. It compares the preserved HomePageClassic baseline at `http://127.0.0.1:3100/` with final Node build **`6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9`** at `http://127.0.0.1:3101/`. The run began **2026-09-07 14:09:30 UTC**, used Chrome **152.0.7977.76**, and completed with exit 0. All 13 measured navigations returned HTTP 200 and hydrated, with no page exceptions, failed requests, HTTP resource errors, blocked mutations or horizontal overflow. These facts do **not** mean every performance threshold passed: the terminal exam view had a measured CLS of **0.18**, a known local quality limitation.

```powershell
$env:PERF_BASELINE_BASE = 'http://127.0.0.1:3100'
$env:PERF_CURRENT_BASE = 'http://127.0.0.1:3101'
node scripts/performance-lab.mjs
```

Raw final observations: `artifacts/performance/report-6aa9fbb6.json` (also the current `report.json`). The actual command log is `implementation-performance-final.log`. The ordinary learner/staff browser suites had finished and closed their browsers before measurement. Other light development activity can still affect this shared Windows host.

Three alternating baseline/after runs per profile used fresh browser contexts, disabled browser cache and identical CDP settings. Desktop: 1440×1000, DPR 1, CPU ×1, 40 ms network latency, 10 Mbps down / 2 Mbps up. Mobile: 390×844, DPR 1, touch/mobile emulation, CPU ×4, 150 ms latency, 1.6 Mbps down / 0.75 Mbps up. Responses came from local HTTP servers; Vercel CDN, remote Turso latency, production compression and real mobile radios were not represented. Requests other than GET/HEAD/OPTIONS were blocked by the harness.

| Profile | Median baseline LCP | Median final LCP | Median observed CLS baseline → final | JavaScript transferred baseline → final |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 564 ms | 552 ms | 0 → 0 | 483,188 → 559,996 bytes (+15.9%) |
| Mobile | 2,036 ms | 2,136 ms | 0.01 → 0.01 | 401,684 → 476,551 bytes (+18.6%) |

The added application functionality increased downloaded JavaScript. Mobile LCP samples for the final artifact were 2,176, 1,320 and 2,136 ms. These three-run medians do not establish an actual field speed improvement, and none is claimed. Transfer bytes are Chrome Network encoded lengths, including response overhead; decoded script body medians were 478,900 → 549,642 bytes desktop and 398,824 → 466,867 bytes mobile. Different desktop/mobile script totals reflect what each viewport loaded during the observation window.

The LCP observer ran through `networkidle` plus 1.5 seconds. CLS is the sum of observed layout-shift entries excluding recent input during that navigation window; it is not a full-session field CLS assessment. No interaction latency was measured, so this report contains **no INP result** and does not declare a field Core Web Vitals pass.

## Existing terminal exam view

`tests/prepare-performance-session.mjs` prepared a session for an existing synthetic fixture learner and selected an already graded/expired attempt of that fixture's original program version. The helper used read-only SQL and one normal verified HTTP sign-in; it did not create or alter academic content, progress, answers or attempts. Its cookie state and relative exam URL remain in ignored `.data` files. The measurement harness validates the URL's local origin and exact exam path, then permits only GET/HEAD/OPTIONS.

One mobile terminal-view navigation returned **HTTP 200**, hydrated and displayed “Проверка знаний”: **LCP 1,968 ms, observed CLS 0.18, JavaScript transferred 506,046 bytes**. This is a read of an existing result, not an in-progress exam interaction benchmark.

The CLS is above 0.1 and is recorded as a **known local quality limitation**, not a passed threshold or a functional page failure. An additional read-only diagnostic reproduced approximately 0.18025: text widths changed during font loading, an internal LMS navigation link wrapped onto another line, and the nearby heading/content moved down 26 CSS pixels. Attribution is saved in `artifacts/performance/terminal-cls-attribution.json`. No runtime redesign was opened from this late lab observation. A focused font/navigation stability profile remains appropriate before claiming a production CLS result.

## Short public API read bursts

Each endpoint received a warmup followed by 50 public GET requests at concurrency 10 on the final local build:

| Endpoint | Successful responses | p50 | p95 | Maximum | Elapsed burst |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/api/health` | 50/50 HTTP 200 | 51.84 ms | 76.63 ms | 78.38 ms | 283.66 ms |
| `/api/v1/catalog/programs` | 50/50 HTTP 200 | 61.58 ms | 108.07 ms | 108.22 ms | 334.55 ms |

The two bursts had zero errors. They exercise local loopback and an isolated file-backed libSQL catalog. They cannot establish free-tier Vercel/Turso throughput, cold-start time, distributed concurrency, storage latency or cost. Remote deployment with an approved persistent database and a stable staging dataset is required to measure those properties. SMTP delivery and remote database verification are separate integration gates; these measurements do not close them.
