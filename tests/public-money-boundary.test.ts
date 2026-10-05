import assert from 'node:assert/strict';
import test from 'node:test';
import { publicVersion, type VersionRow } from '../server/services/catalog';
import { courseDirections } from '../shared/course-registry';
import { getPublicCoursePricing } from '../shared/public-course-pricing';
import { publicMoneyFindings } from '../shared/public-data-guard';

test('public version allowlist keeps learning facts and leaves private source bytes unchanged', () => {
  const row = { id: 'synthetic', program_id: 'ohrana-truda', version: 1, published_at: '2026-10-05',
    data_json: JSON.stringify({ title: 'Synthetic only', language: 'ru', durationHours: 40,
      priceMinor: 987654321, currency: 'KZT', accessModel: 'paid', billingBasis: 'learner',
      modules: [{ id: 'module', title: 'Module', lessons: [{ id: 'lesson', title: 'Lesson', kind: 'practice', required: true, body: 'PRIVATE', media: [] }] }],
      questions: [{ correctOptionIds: ['PRIVATE'] }],
    }) } as VersionRow;
  const before = row.data_json;
  const published = publicVersion(row);
  assert.deepEqual(publicMoneyFindings(published), []);
  assert.equal(published.durationHours, 40);
  assert.equal(published.modules[0]!.lessons[0]!.kind, 'practice');
  assert.equal(row.data_json, before);
  assert.ok(!JSON.stringify(published).includes('PRIVATE'));
});

test('all public directions expose request copy without monetary fields or labels', () => {
  for (const direction of courseDirections) {
    const pricing = getPublicCoursePricing(direction.id);
    assert.equal(pricing.mode, 'request');
    assert.deepEqual(publicMoneyFindings(pricing), []);
    assert.ok(pricing.label.ru && pricing.label.kk);
  }
  assert.ok(publicMoneyFindings({ offers: { price: 123 } }).length);
  assert.ok(publicMoneyFindings({ text: '123 ₸' }).length);
});
