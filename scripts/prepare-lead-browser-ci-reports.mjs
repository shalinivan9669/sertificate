/** Upload only bounded, non-contact summaries from the two isolated lead browser pilots. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareLeadBrowserCiReports(root = 'artifacts') {
  let prepared = 0;
  for (const suite of ['lead-attribution-browser', 'lead-workspace-browser']) {
    const source = join(root, suite);
    for (const run of await readdir(source, { withFileTypes: true }).catch(() => [])) {
      if (!run.isDirectory() || !/^[0-9a-f-]{36}$/.test(run.name)) continue;
      const report = await readFile(join(source, run.name, 'report.json'), 'utf8').then(JSON.parse).catch(() => null);
      if (!report) continue;
      const target = join(root, 'ci-lead-browser', suite, run.name);
      await mkdir(target, { recursive: true });
      // No stacks, contact screenshots, network bodies, local paths or private logs.
      await writeFile(join(target, 'report.json'), JSON.stringify({
        status: report.status === 'passed' ? 'passed' : 'failed',
        buildId: /^[0-9a-f-]{36}$/.test(report.buildId) ? report.buildId : null,
        finishedAt: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(report.finishedAt) ? report.finishedAt : null,
        passedChecks: Array.isArray(report.checks) ? report.checks.filter(check => check?.status === 'passed').length : 0,
        javascriptErrors: Array.isArray(report.errors) ? report.errors.length : null,
        syntheticOnly: report.syntheticOnly === true,
        externalDelivery: report.externalDelivery === false ? false : null,
        diagnosticDetailsOmitted: true
      }, null, 2), { flag: 'wx' });
      prepared++;
    }
  }
  return prepared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Prepared ${await prepareLeadBrowserCiReports()} safe lead browser CI summaries`);
}
