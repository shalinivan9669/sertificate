import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// The index retains the audit-base blob. The home blob was explicitly reviewed
// for the owner's 2026-09-08 request: extend the existing course grid and display
// PDF prices. Hero, formats and remaining classic sections retain their design.
// No automatic refresh mode: subsequent changes still require explicit review.
export const classicBase = '413ad4a34e53203f39df3946962903f51caf16a0';
export const classicCourseRevision = '2026-09-08: owner-approved 20 directions, filters and PDF display prices';
export const classicBlobs = Object.freeze({
  'components/HomePageClassic.vue': 'fd2396cc1a993af1b2f8de395b80ef5ecda86784',
  'pages/index.vue': '5d5710fa6eb31021139bb1a15b0fcf3e026072de',
});

export async function assertClassicSource() {
  for (const [path, expected] of Object.entries(classicBlobs)) {
    const source = Buffer.from((await readFile(new URL('../' + path, import.meta.url), 'utf8')).replaceAll('\r\n', '\n'));
    const actual = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
    assert.equal(actual, expected, `${path} diverges from the reviewed classic (${classicBase}; ${classicCourseRevision}); do not refresh this guard from HEAD to hide a design change`);
  }
}
