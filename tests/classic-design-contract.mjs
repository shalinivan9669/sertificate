import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// The September 13 editorial redesign supersedes the frozen root-page wrapper.
// Keep the reviewed classic component unchanged and available at /second.
// September 14: the owner explicitly requested a site-wide telephone replacement.
// September 14 follow-up: the owner requested course value in place of public prices.
// The classic layout is preserved; its phone and course value copy reflect those requests.
export const classicBase = '413ad4a34e53203f39df3946962903f51caf16a0';
export const classicCourseRevision = '2026-09-08: owner-approved 20 directions, filters and PDF display prices';
export const classicBlobs = Object.freeze({
  'components/HomePageClassic.vue': '1d11df93e44ea42f28738fa5c837aa767d56c098',
});

export async function assertClassicSource() {
  for (const [path, expected] of Object.entries(classicBlobs)) {
    const source = Buffer.from((await readFile(new URL('../' + path, import.meta.url), 'utf8')).replaceAll('\r\n', '\n'));
    const actual = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
    assert.equal(actual, expected, `${path} diverges from the reviewed classic (${classicBase}; ${classicCourseRevision}); do not refresh this guard from HEAD to hide a design change`);
  }
  const root = await readFile(new URL('../pages/index.vue', import.meta.url), 'utf8');
  const second = await readFile(new URL('../pages/second.vue', import.meta.url), 'utf8');
  assert.match(root, /import HomePageEditorial from '~\/components\/HomePageEditorial\.vue'/);
  assert.match(root, /<HomePageEditorial\s*\/>/);
  assert.match(second, /<HomePageClassic\s*\/>/);
}
