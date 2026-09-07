import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSitemapEntries, defaultSiteUrl } from '../config/public-route-policy.js';

// Nuxt serves the live sitemap. This preview stays outside public/ so a stale
// static file cannot shadow the generated response.
const target = process.argv[2] || '.output/seo/sitemap-preview.xml';
const entries = buildSitemapEntries(process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl);
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
${entry.alternatives.map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(alternate.href)}" />`).join('\n')}
  </url>`).join('\n')}
</urlset>
`;
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, xml);
console.log(`Generated sitemap preview with ${entries.length} URLs: ${target}`);
