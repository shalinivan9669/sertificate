import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('artifacts/redesign/2026-09-14');
const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const captureSources = ['after-final/capture-public-report.json', 'after-licenses-final/capture-public-report.json', 'after-selection-final/capture-public-report.json'];
const captures = new Map();
const captureRuns = [];
for (const path of captureSources) {
  const report = await read(path);
  captureRuns.push({ path, summary: report.summary });
  for (const capture of report.captures) captures.set(`${capture.name}-${capture.viewport.width}x${capture.viewport.height}`, { ...capture, report: path });
}
const regressionSources = ['after-regression-final/public-regression.json', 'after-regression-supplement/public-regression.json', 'after-selection-check/public-regression.json'];
const checks = new Map();
const regressionRuns = [];
for (const path of regressionSources) {
  const report = await read(path);
  regressionRuns.push({ path, passed: report.checks.length, recordedFailures: report.failures.length, pageErrors: report.pageErrors.length, hydrationWarnings: report.hydration.length });
  for (const check of report.checks) checks.set(check.name, { ...check, report: path });
}
const contrast = await read('after-final/contrast-tokens.json');
const report = {
  generatedAt: new Date().toISOString(),
  captureRuns,
  summary: { effectiveCaptures: captures.size, fullPageAndViewportPng: captures.size * 2, pageStateLocalePairs: new Set([...captures.values()].map(c => c.name)).size, widths: [1440, 1280, 820, 390, 360], locales: ['ru', 'kk'], overflows: [...captures.values()].filter(c => c.overflow).length, publicScenarioChecksPassed: checks.size, solidColorContrastChecksPassed: contrast.checks.filter(c => c.passed).length },
  regressionRuns,
  replacedHarnessExperiment: 'The two CSS zoom checks in after-regression-final were not valid browser zoom simulations: CSS zoom leaves media-query width unchanged. They are replaced by the passing 720×450 CSS-pixel / DPR 2 checks in after-regression-supplement, which emulate a 1440×900 physical viewport at 200% zoom. Previous evidence remains intact.',
  scope: 'Real local public application GET responses. No API mocks. Public browser scripts block POST/PUT/PATCH/DELETE. Artwork failure is explicitly simulated by aborting image requests. Closed authenticated screens are not certified by this report.',
  limitations: [
    'The authenticated cabinet, lesson, exam and working administrator UI could not be exercised against the isolated fixture process: its launch was rejected by automatic approval review. Prepared private tests were not run against normal data.',
    'Tikkurila was read-only inspected at localhost:3001 but responded HTTP 500 because tailwindcss could not be resolved. The reference PNG records that failure, not a visual review of the intended design.',
    'Before captures of certificate-denied, ui-kit, catalog-empty and article contain an intermediate header due to concurrent HMR. The before catalog-empty state is not considered a confirmed empty result.',
    'Dev screenshots include Nuxt DevTools; the 404 preview panel is development chrome rather than part of the production error component.',
    'Solid-color token contrast does not certify all photograph overlays or every incidental UI element; manual visual review and automated layout checks are distinct from user research.',
  ],
  checks: [...checks.values()],
  captures: [...captures.values()],
};
await writeFile(resolve(root, 'verification-final.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
