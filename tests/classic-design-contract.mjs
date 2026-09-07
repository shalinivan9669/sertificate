import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Reviewed once against the explicitly requested audit base with git rev-parse
// <commit>:<path>. These are Git blob IDs, not snapshots generated from HEAD.
// No update/refresh mode: intentional classic changes require explicit review.
export const classicBase = '413ad4a34e53203f39df3946962903f51caf16a0';
export const classicBlobs = Object.freeze({
  'components/HomePageClassic.vue': 'a1ff0776d2d4c98297b0050b553c35ccbe00fba4',
  'pages/index.vue': '5d5710fa6eb31021139bb1a15b0fcf3e026072de',
});

export async function assertClassicSource() {
  for (const [path, expected] of Object.entries(classicBlobs)) {
    const source = Buffer.from((await readFile(new URL('../' + path, import.meta.url), 'utf8')).replaceAll('\r\n', '\n'));
    const actual = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
    assert.equal(actual, expected, `${path} diverges from the preserved classic at ${classicBase}; do not refresh this guard from HEAD to hide a design change`);
  }
}
