import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectPublicHtml } from '../scripts/seo-http-check.mjs';

const html = (robots) => `<html lang="ru-KZ"><head><title>OT Center</title><meta name="description" content="Обучение"><meta name="robots" content="${robots}"><link rel="canonical" href="https://otcenter.kz/"><link rel="alternate" hreflang="ru-KZ" href="https://otcenter.kz/"><link rel="alternate" hreflang="kk-KZ" href="https://otcenter.kz/kk"></head><body><h1>Обучение</h1></body></html>`;

test('public SEO checker defaults to strict indexability', () => {
  assert.doesNotThrow(() => inspectPublicHtml(html('index, follow'), '/'));
  assert.throws(() => inspectPublicHtml(html('noindex, follow'), '/'), /indexable/);
});

test('explicit non-indexable environment requires noindex', () => {
  assert.doesNotThrow(() => inspectPublicHtml(html('noindex, nofollow'), '/', undefined, { indexable: false }));
  assert.throws(() => inspectPublicHtml(html('index, follow'), '/', undefined, { indexable: false }), /explicit non-indexable/);
});
