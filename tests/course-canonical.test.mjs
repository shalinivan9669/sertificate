import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPublicPath, canonicalPublicUrl, courseCardAliases } from '../config/public-route-runtime.js';
import { legacyCourseDirections } from '../shared/course-registry.ts';

test('only known aliases of the same catalogue programme share a preferred canonical', () => {
  const aliases = Object.fromEntries(legacyCourseDirections.filter(({ alias }) => alias).map(({ id, alias }) => [alias, id]));
  assert.deepEqual(courseCardAliases, aliases, 'runtime aliases must match the programme registry');
  for (const [alias, id] of Object.entries(aliases)) {
    for (const prefix of ['', '/kk']) {
      assert.equal(canonicalPublicPath(`${prefix}/courses/${alias}?city=almaty&format=online&versionId=example#details`), `${prefix}/courses/${id}`);
      assert.equal(canonicalPublicPath(`${prefix}/courses/${id}/`), `${prefix}/courses/${id}`);
      assert.equal(canonicalPublicUrl(`https://www.otcenter.kz${prefix}/courses/${alias}`), `https://www.otcenter.kz${prefix}/courses/${id}`);
    }
  }
});

test('marketing pages, distinct programmes, languages and private flows retain their own paths', () => {
  for (const path of ['/', '/kk', '/ohrana-truda', '/kk/ohrana-truda', '/almaty/ohrana-truda', '/courses/iso-9001', '/kk/courses/iso-9001', '/courses/unknown', '/learn/labor-safety', '/courses/labor-safety/lesson']) {
    assert.equal(canonicalPublicPath(path), path);
    assert.equal(canonicalPublicUrl(`https://www.otcenter.kz${path}`), `https://www.otcenter.kz${path}`);
  }
});

test('normalization preserves the configured origin and does not redirect the journey URL', () => {
  const route = '/kk/courses/fire-safety?city=astana&versionId=published-example#terms';
  const original = route;
  assert.equal(canonicalPublicUrl(`https://preview.example${route}`), 'https://preview.example/kk/courses/ptm');
  assert.equal(route, original);
});
