import assert from 'node:assert/strict';
import test from 'node:test';
import { cities } from '../content/cities';
import { buildSeoContent } from '../content/public-city-content';
import { directionDetails } from '../content/direction-details.js';
import { courses } from '../config/courses.js';

test('each city has useful localized service answers and all nine direction links', () => {
  for (const city of cities) {
    for (const locale of ['ru', 'kk']) {
      const content = buildSeoContent(city, null, locale)!;
      assert.ok(content.hero.h1.includes(city.name[locale as 'ru' | 'kk']));
      assert.equal(content.modules.related.links.length, 9);
      assert.deepEqual(content.modules.related.links.map(({ to }) => to), courses.map(({ slug }) => `/${city.slug}/${slug}`));
      assert.equal(content.modules.faq.faqs.length, 4);
      assert.equal(new Set(content.modules.faq.faqs.map(({ a }) => a)).size, 4, 'answers respond to their questions');
      assert.ok(content.modules.scenarios.items[2]);
      assert.ok(content.modules.scenarios.items[2].text.length > 70, 'city planning guidance present');
      assert.doesNotMatch(JSON.stringify(content), /runtime-flow|лендинг|1-3 дня|чаще всего обучаем|срочное обучение|SEO-страница/);
      if (locale === 'kk') assert.doesNotMatch(JSON.stringify(content), /Для команд|В городе|Проверка знаний|Ключевые отрасли|Мы планируем/);
    }
  }
  assert.equal(buildSeoContent(undefined, null, 'ru'), null);
});

test('public topics describe each legacy direction in both languages without creating LMS approval', () => {
  assert.deepEqual(Object.keys(directionDetails).sort(), courses.map(({ slug }) => slug).sort());
  for (const details of Object.values(directionDetails)) {
    for (const locale of ['ru', 'kk'] as const) {
      const content = details[locale];
      assert.ok(content.audience.length > 40);
      assert.equal(content.topics.length, 3);
      assert.ok(content.clarify.length > 40);
      assert.doesNotMatch(JSON.stringify(content), /100%|гарантирован|автоматическ.*сертификат|правильный ответ/);
    }
  }
});
