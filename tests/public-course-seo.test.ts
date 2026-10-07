import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDirections } from '../shared/course-registry';
import { getPublicCourseValue } from '../shared/public-course-value';
import { getSourceProductForDirection } from '../shared/source-products';
import { getPublicCourseSeo } from '../shared/public-course-seo';

test('every public direction has its own localized metadata backed by existing editorial sources', () => {
  assert.equal(courseDirections.length, 20);
  for (const locale of ['ru', 'kk'] as const) {
    const titles = new Set<string>(), descriptions = new Set<string>();
    for (const direction of courseDirections) {
      const metadata = getPublicCourseSeo(direction.id, locale);
      assert.ok(metadata, `${direction.id}: ${locale} metadata is present`);
      assert.ok(getPublicCourseValue(direction.id), `${direction.id}: existing public editorial description`);
      if ('sourceProductId' in direction) {
        assert.ok(getSourceProductForDirection(direction.id), `${direction.id}: additional direction has service inventory`);
      }
      assert.ok(metadata.title.trim());
      assert.ok(metadata.description.trim());
      // The selected READY BiOT snippet intentionally omits a brand suffix.
      assert.equal((metadata.title.match(/OT Center/g) || []).length, direction.id === 'ohrana-truda' && locale === 'ru' ? 0 : 1);
      titles.add(metadata.title);
      descriptions.add(metadata.description);
      assert.doesNotMatch(metadata.description, /Обучение по охране труда, ТБ, БИОТ и промышленной безопасности/);
      if (locale === 'kk') {
        assert.notEqual(metadata.description, getPublicCourseSeo(direction.id, 'ru')!.description);
        assert.doesNotMatch(metadata.description, /Подготовка|Обучение|Уточните|Согласуйте|Обсудите|для вашей/);
      }
      assert.doesNotMatch(`${metadata.title} ${metadata.description}`, /онлайн|\bonline\b|дистанционно|\d+\s*(?:час|сағ)|тенге|\bKZT\b|₸|гарантир|выдач[аи]|сертификат за|удостоверение за/i);
    }
    assert.equal(titles.size, courseDirections.length, `${locale}: one title per direction`);
    assert.equal(descriptions.size, courseDirections.length, `${locale}: one description per direction`);
  }
});

test('historical aliases resolve to the same metadata without creating duplicate offers', () => {
  for (const direction of courseDirections) {
    if (!direction.alias) continue;
    for (const locale of ['ru', 'kk']) {
      assert.deepEqual(getPublicCourseSeo(direction.alias, locale), getPublicCourseSeo(direction.id, locale));
    }
  }
});

test('unknown directions do not inherit a different course and locale fallback is deterministic', () => {
  for (const value of [undefined, null, '', 'unknown-course', '/courses/ohrana-truda', 'toString', '__proto__', 'constructor', 123, {}, ['ohrana-truda']]) {
    assert.equal(getPublicCourseSeo(value, 'ru'), undefined);
    assert.equal(getPublicCourseSeo(value, 'kk'), undefined);
  }
  assert.deepEqual(getPublicCourseSeo('iso-9001', 'kk-KZ'), getPublicCourseSeo('iso-9001', 'kk'));
  assert.deepEqual(getPublicCourseSeo('iso-9001', 'ru-KZ'), getPublicCourseSeo('iso-9001', 'ru'));
  assert.deepEqual(getPublicCourseSeo('ohrana-truda', 'ru-KZ'), getPublicCourseSeo('ohrana-truda', 'ru'));
  assert.deepEqual(getPublicCourseSeo('iso-9001'), getPublicCourseSeo('iso-9001', 'ru'));
});

test('a caller cannot mutate metadata used by another request or locale', () => {
  const original = getPublicCourseSeo('iso-9001', 'ru')!;
  const changed = getPublicCourseSeo('iso-9001', 'ru')!;
  changed.title = 'Changed';
  changed.description = 'Changed';
  assert.deepEqual(getPublicCourseSeo('iso-9001', 'ru'), original);
});
