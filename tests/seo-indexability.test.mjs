import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStablePublicSeo, inspectPublicHeaders, inspectPublicHtml } from '../scripts/seo-http-check.mjs';
import { preservesLeadContext } from '../config/public-route-runtime.js';

const html = (robots) => `<html lang="ru-KZ"><head><title>OT Center</title><meta name="description" content="Обучение"><meta name="robots" content="${robots}"><link rel="canonical" href="https://www.otcenter.kz/"><link rel="alternate" hreflang="ru-KZ" href="https://www.otcenter.kz/"><link rel="alternate" hreflang="kk-KZ" href="https://www.otcenter.kz/kk"><link rel="alternate" hreflang="x-default" href="https://www.otcenter.kz/"></head><body><h1>Обучение</h1></body></html>`;

test('public SEO checker defaults to strict indexability', () => {
  assert.doesNotThrow(() => inspectPublicHtml(html('index, follow'), '/'));
  assert.throws(() => inspectPublicHtml(html('noindex, follow'), '/'), /indexable/);
});

test('explicit non-indexable environment requires noindex', () => {
  assert.doesNotThrow(() => inspectPublicHtml(html('noindex, nofollow'), '/', undefined, { indexable: false }));
  assert.throws(() => inspectPublicHtml(html('index, follow'), '/', undefined, { indexable: false }), /explicit non-indexable/);
});

test('every Google robots directive is checked, including none and a second meta tag', () => {
  assert.throws(() => inspectPublicHtml(html('none'), '/'), /indexable/);
  const googlebotBlock = html('index, follow').replace('</head>', '<meta name="googlebot" content="noindex"></head>');
  assert.throws(() => inspectPublicHtml(googlebotBlock, '/'), /indexable/);
  const secondBlock = html('index, follow').replace('</head>', '<meta name="robots" content="noindex"></head>');
  assert.throws(() => inspectPublicHtml(secondBlock, '/'), /indexable/);
});

test('public HTTP headers cannot silently block an otherwise indexable HTML page', () => {
  assert.doesNotThrow(() => inspectPublicHeaders(new Headers(), '/online-obuchenie'));
  assert.doesNotThrow(() => inspectPublicHeaders(new Headers({ 'X-Robots-Tag': 'index, follow' }), '/online-obuchenie'));
  for (const directive of ['noindex', 'googlebot: noindex, follow', 'NoNe']) {
    assert.throws(() => inspectPublicHeaders(new Headers({ 'X-Robots-Tag': directive }), '/online-obuchenie'), /headers must allow indexing/);
  }
  assert.doesNotThrow(() => inspectPublicHeaders(new Headers({ 'X-Robots-Tag': 'noindex' }), '/', { indexable: false }));
});

test('query equivalence protects canonical, metadata and heading independently', () => {
  const reference = inspectPublicHtml(html('index, follow'), '/');
  assert.doesNotThrow(() => assertStablePublicSeo(reference, { ...reference }, '/?city=almaty'));
  for (const field of ['canonical', 'title', 'description', 'h1']) {
    assert.throws(() => assertStablePublicSeo(reference, { ...reference, [field]: 'Changed for query city' }, '/?city=almaty'), new RegExp(`preserve ${field}`));
  }
});

test('informational navigation uses clean destinations while explicit selection journeys retain context', () => {
  for (const locale of ['', '/kk']) {
    for (const path of ['/licenses', '/blog', '/blog/guide', '/privacy', '/public-offer', '/almaty', '/almaty/ohrana-truda', '/online-obuchenie', '/almaty/online-obuchenie']) {
      assert.equal(preservesLeadContext(`${locale}${path}`), false, `${locale}${path}`);
    }
    for (const path of ['/courses', '/courses/ohrana-truda', '/contacts', '/b2b', '/program-selection', '/payment/example', '/cabinet']) {
      assert.equal(preservesLeadContext(`${locale}${path}`), true, `${locale}${path}`);
    }
  }
});
