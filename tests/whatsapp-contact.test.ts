import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWhatsAppContactUrl, whatsAppGreeting } from '../shared/whatsapp-contact';

test('public WhatsApp enquiry uses the Contacts number and excludes query and hash', () => {
  const url = new URL(buildWhatsAppContactUrl('/contacts?email=personal@example.com&phone=123#request-form', 'https://otcenter.kz')!);
  assert.equal(url.origin + url.pathname, 'https://wa.me/77766803282');
  assert.equal(url.searchParams.get('text'), whatsAppGreeting + '\n\nСтраница: https://otcenter.kz/contacts');
});

test('course enquiry includes the real public direction and canonical alias without selection data', () => {
  const url = new URL(buildWhatsAppContactUrl('/courses/labor-safety?versionId=private-selection', 'https://otcenter.kz')!);
  assert.equal(url.searchParams.get('text'), whatsAppGreeting + '\n\nКурс: Охрана труда.\nhttps://otcenter.kz/courses/ohrana-truda');
  const kazakh = new URL(buildWhatsAppContactUrl('/kk/almaty/ptm?person=private', 'https://otcenter.kz', 'kk')!);
  assert.match(kazakh.searchParams.get('text')!, /Курс: Өрт-техникалық минимум/);
  assert.doesNotMatch(kazakh.searchParams.get('text')!, /person=|private/);
});

test('private and non-indexable journeys never generate a WhatsApp enquiry', () => {
  for (const path of ['/cabinet', '/kk/learn/person-id', '/exam/result', '/payment/order-id', '/orders/order-id', '/verify/private-token', '/auth/login', '/preview/seo-expansion', '/kk/%63abinet/organization']) {
    assert.equal(buildWhatsAppContactUrl(path, 'https://otcenter.kz'), undefined, path);
  }
});
