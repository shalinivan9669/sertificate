import test from 'node:test';
import assert from 'node:assert/strict';
import { courseDirections } from '../shared/course-registry';
import { getCourseSearchIntent } from '../shared/course-search-intent';

test('every existing direction has distinct bilingual selection guidance', () => {
  for (const locale of ['ru', 'kk']) {
    const preparations = new Set<string>();
    for (const direction of courseDirections) {
      const content = getCourseSearchIntent(direction.id, locale);
      assert.ok(content, direction.id);
      assert.ok(content.preparation.length > 100);
      assert.ok(!preparations.has(content.preparation), direction.id);
      preparations.add(content.preparation);
    }
    assert.equal(preparations.size, 20);
  }
});

test('document guidance distinguishes organization certification and worker qualification', () => {
  assert.match(getCourseSearchIntent('iso-9001')!.document, /разные процедуры/);
  assert.match(getCourseSearchIntent('gpm-stropalschiki')!.preparation, /первичная подготовка/);
  assert.equal(getCourseSearchIntent('unknown'), undefined);
  assert.deepEqual(getCourseSearchIntent('labor-safety'), getCourseSearchIntent('ohrana-truda'));
});
