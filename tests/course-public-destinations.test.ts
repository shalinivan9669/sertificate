import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDirections, getCoursePublicPath } from '../shared/course-registry';
import { getCourseSearchContent } from '../shared/course-search-content';
import { getPublicCourseLandingSeo, getPublicCourseSeo } from '../shared/public-course-seo';
import { buildPublicRoutes, localizePublicPath } from '../config/public-route-policy.js';

test('article and related-training destinations exist in both public route inventories', () => {
  const inventory = new Set(buildPublicRoutes());
  for (const direction of courseDirections) {
    const destination = getCoursePublicPath(direction.id)!;
    for (const locale of ['ru', 'kk']) {
      assert.ok(inventory.has(localizePublicPath(destination, locale)), `${direction.id}: ${locale} public destination`);
      const content = getCourseSearchContent(direction.id, locale)!;
      for (const related of content.related) {
        assert.notEqual(related, direction.id, 'related training must add a different direction');
        assert.ok(inventory.has(localizePublicPath(getCoursePublicPath(related)!, locale)), `${related}: related link must resolve`);
      }
      if (!destination.startsWith('/courses/')) {
        const landing = getPublicCourseLandingSeo(direction.id, locale)!;
        const program = getPublicCourseSeo(direction.id, locale)!;
        assert.notEqual(landing.title, program.title, 'service and program titles describe different selection stages');
        assert.notEqual(landing.description, program.description, 'service and program summaries have distinct purposes');
      }
    }
    if (direction.alias) assert.equal(getCoursePublicPath(direction.alias), destination);
  }
});

test('unrecognized article tags cannot create a guessed URL', () => {
  for (const value of [undefined, null, '', 'not-a-course', 'constructor', '__proto__', '/courses/iso-9001', 123]) {
    assert.equal(getCoursePublicPath(value), undefined);
    assert.equal(getCourseSearchContent(value), undefined);
  }
});
