import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSitemapEntries, defaultSiteUrl } from '../config/public-route-policy.js';

// Nuxt serves the live sitemap. This preview stays outside public/ so a stale
// static file cannot shadow the generated response.
const target = process.argv[2] || '.output/seo/sitemap-preview.xml';
const entries = buildSitemapEntries(process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl);
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map((entry) => [
  '  <url>',
  `    <loc>${escapeXml(entry.loc)}</loc>`,
  ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
  ...(entry.images || []).map((image) => `    <image:image><image:loc>${escapeXml(String(image.loc))}</image:loc></image:image>`),
  ...entry.alternatives.map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(alternate.href)}" />`),
  '  </url>',
].join('\n')).join('\n')}
</urlset>
`;
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, xml);
console.log(`Generated sitemap preview with ${entries.length} URLs: ${target}`);
