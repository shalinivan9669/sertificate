import assert from 'node:assert/strict';
import test from 'node:test';
import { formatGuidance, getFormatGuidance } from '../content/format-guidance.js';
import { formats } from '../config/formats.js';
import { cities } from '../config/cities.js';
import { buildPublicRoutes, localizePublicPath } from '../config/public-route-policy.js';

test('all six existing formats have substantive and distinct RU/KK preparation guidance', () => {
  assert.equal(formats.length, 6);
  assert.deepEqual(Object.keys(formatGuidance).sort(), formats.map((item) => item.type).sort());
  for (const locale of ['ru', 'kk']) {
    const introductions = new Set();
    const constraints = new Set();
    const checklistItems = new Set();
    for (const { type } of formats) {
      const content = getFormatGuidance(type, locale);
      assert.ok(content, `${type}/${locale}`);
      assert.equal(content.checklist.length, 4, `${type}/${locale}: actionable preparation checklist`);
      const body = [content.introduction, content.choice, ...content.checklist, content.constraint].join(' ');
      assert.ok(body.split(/\s+/u).length >= 140, `${type}/${locale}: useful guidance beyond headings and navigation`);
      assert.ok(/[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/u.test(body));
      introductions.add(content.introduction);
      constraints.add(content.constraint);
      content.checklist.forEach((item) => checklistItems.add(item));
    }
    assert.equal(introductions.size, 6, `${locale}: each format has its own purpose`);
    assert.equal(constraints.size, 6, `${locale}: each format explains its own limits`);
    assert.equal(checklistItems.size, 24, `${locale}: preparation steps are specific to the format`);
  }
});

test('guidance links resolve to clean public direction and matching city-format pages in both locales', () => {
  const publicRoutes = new Set(buildPublicRoutes());
  for (const { type, slug } of formats) {
    for (const locale of ['ru', 'kk']) {
      const content = getFormatGuidance(type, locale);
      assert.equal(content.directions.length, 3);
      assert.equal(content.cities.length, cities.length);
      for (const link of [...content.directions, ...content.cities]) {
        assert.ok(link.label.trim());
        assert.ok(!/[?#]/u.test(link.to), `${link.to}: editorial links must not create selection variants`);
        assert.ok(publicRoutes.has(localizePublicPath(link.to, locale)), `${type}/${locale}: ${link.to} must be an existing public destination`);
      }
      for (const city of cities) {
        const link = content.cities.find((item) => item.to === `/${city.slug}/${slug}`);
        assert.ok(link, `${type}/${locale}: ${city.slug} must keep the same format`);
        assert.equal(link.label, locale === 'kk' ? city.nameKk : city.nameRu);
      }
    }
  }
});

test('practical limits address each formats main decision in both languages', () => {
  const concepts = {
    online: { ru: /практическую подготовку/u, kk: /практикалық дайындық/u },
    vyezdnoe: { ru: /условия проведения/u, kk: /өткізу шарттары/u },
    ochnoe: { ru: /постоянной учебной аудитории/u, kk: /тұрақты оқу аудиториясының/u },
    srochnoe: { ru: /пропуск занятий/u, kk: /өткізіп жіберуді/u },
    tender: { ru: /не может гарантировать/u, kk: /кепілдік бере алмайды/u },
    prodlenie: { ru: /автоматическую замену даты/u, kk: /күнді автоматты түрде ауыстыру/u },
  };
  for (const [type, byLocale] of Object.entries(concepts)) {
    for (const [locale, pattern] of Object.entries(byLocale)) {
      assert.match(getFormatGuidance(type, locale).constraint, pattern, `${type}/${locale}`);
    }
  }
});

test('unknown formats do not inherit unrelated guidance and locale fallback remains Russian', () => {
  assert.equal(getFormatGuidance('not-a-format', 'ru'), null);
  assert.equal(getFormatGuidance(undefined, 'kk'), null);
  assert.deepEqual(getFormatGuidance('online', 'en'), getFormatGuidance('online', 'ru'));
});
