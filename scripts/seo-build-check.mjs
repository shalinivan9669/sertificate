import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildPublicRoutes, defaultSiteUrl, isNonIndexableRoute } from '../config/public-route-policy.js';
import { inspectPublicHtml } from './seo-http-check.mjs';

const output = path.resolve(process.argv[2] || '.output/public');
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl;
const found = [];
async function visit(folder) {
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) await visit(full);
    else if (item.name === 'index.html') {
      const relative = path.relative(output, path.dirname(full)).replaceAll('\\', '/');
      const route = relative ? `/${relative}` : '/';
      assert.equal(isNonIndexableRoute(route), false, `Private HTML must never be prerendered: ${route}`);
      found.push(route);
    }
  }
}
await visit(output);
for (const route of buildPublicRoutes()) {
  const html = await fs.readFile(path.join(output, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');
  inspectPublicHtml(html, route, siteUrl, { indexable: process.env.OT_NOINDEX !== 'true' });
}
console.log(`Build SEO contracts passed: ${buildPublicRoutes().length} public HTML pages checked; ${found.length} generated index files contain no private route.`);
