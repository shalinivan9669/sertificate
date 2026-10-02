import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCityPageContext } from '../content/city-page-context';
import { cities } from '../content/cities';
import { courses } from '../config/courses.js';
import { formats } from '../config/formats.js';
import { buildPublicRoutes } from '../config/public-route-policy.js';

test('450 city-topic pages have stable bilingual context and crawlable existing links', () => {
  const routes = new Set(buildPublicRoutes());
  for (const locale of ['ru', 'kk']) {
    const signatures = new Set();
    const descriptions = new Set();
    for (const city of cities) for (const [kind, topics] of [['course', courses], ['format', formats]] as const) {
      for (const topic of topics) {
        const id = 'type' in topic ? topic.type : topic.slug;
        const content = buildCityPageContext(city.slug, kind, id, locale)!;
        assert.ok(content, `${city.slug}/${id}/${locale}`);
        assert.ok(content.description.includes(city.name[locale as 'ru' | 'kk']));
        assert.ok(!descriptions.has(content.description), 'distinct city-topic description');
        descriptions.add(content.description);
        const signature = JSON.stringify(content.sections.map(section => section.text));
        assert.ok(!signatures.has(signature), 'city-topic body must differ');
        signatures.add(signature);
        for (const link of content.links) assert.ok(routes.has(link.to), link.to);
        assert.deepEqual(content, buildCityPageContext(city.slug, kind, id, locale));
        if (locale === 'kk') assert.doesNotMatch(signature, /Для группы|Подготовьте|Укажите|Проверьте/);
      }
    }
    assert.equal(signatures.size, 225);
  }
  assert.equal(buildCityPageContext('unknown', 'course', 'ptm'), null);
  assert.equal(buildCityPageContext('almaty', 'format', 'unknown'), null);
});
