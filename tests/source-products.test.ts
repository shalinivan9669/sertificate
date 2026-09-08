import assert from 'node:assert/strict';
import test from 'node:test';
import { additionalSourceDirections, getSourceProductForDirection, sourceProductDocument, sourceProducts } from '../shared/source-products';
import { courseDirections, legacyCourseDirections } from '../shared/course-registry';

test('all sixteen source rows retain provenance and extend rather than replace the nine legacy directions', () => {
  assert.equal(sourceProducts.length, 16); assert.equal(sourceProductDocument.pages, 2);
  assert.equal(sourceProducts.filter(product => product.sourcePage === 1).length, 11);
  assert.equal(sourceProducts.filter(product => product.sourcePage === 2).length, 5);
  assert.equal(new Set(sourceProducts.map(product => `${product.sourcePage}:${product.sourceRow}`)).size, 16);
  assert.equal(new Set(sourceProducts.map(product => product.slug)).size, 16);
  assert.equal(sourceProducts.filter(product => product.legacyDirectionId !== null).length, 5);
  assert.equal(additionalSourceDirections.length, 11); assert.equal(legacyCourseDirections.length, 9); assert.equal(courseDirections.length, 20);
  for (const direction of legacyCourseDirections) assert.ok(courseDirections.some(current => current.id === direction.id && current.alias === direction.alias));
});

test('public source inventory contains no quoted numeric rates, bank details or ready-to-purchase learning content', () => {
  assert.equal(sourceProductDocument.publicDownloadUrl, null);
  assert.equal(sourceProducts.filter(product => product.pricingBasis === 'organization').length, 4);
  for (const product of sourceProducts) {
    assert.equal(product.publicPrice, null); assert.equal(product.availability, 'consultation');
    assert.equal(product.academicContentStatus, 'not_provided');
    assert.equal(product.priceClassification, 'unspecified_source_rate');
    assert.ok(!('amountMinor' in product)); assert.ok(!('amountKzt' in product)); assert.ok(!('rateTextRaw' in product));
    assert.ok(!('modules' in product)); assert.ok(!('questions' in product)); assert.ok(!('durationHours' in product));
  }
  assert.doesNotMatch(JSON.stringify(sourceProducts), /\d[\d\s]*\sтенге|БИН|ИИК|БИК|IBAN/);
});

test('ambiguous health and safety standard remains exactly as written with an explicit clarification', () => {
  const product = getSourceProductForDirection('menedzhment-ohrany-zdorovya'); assert.ok(product);
  assert.equal(product.standardAsWritten, 'ISO 14001'); assert.equal(product.sourcePage, 2); assert.equal(product.sourceRow, 5);
  assert.match(product.sourceNameRaw, /ISO 14001/);
  assert.ok(product.clarifications.includes('source_standard_scope_mismatch'));
  assert.doesNotMatch(product.title.ru, /45001/);
  assert.match(product.guidance.summary.ru, /уточнения/);
  assert.equal(getSourceProductForDirection('unknown-source-product'), undefined);
});

test('each source product has bilingual selection guidance that stays separate from academic content', () => {
  for (const source of sourceProducts) {
    const product = getSourceProductForDirection(source.slug); assert.ok(product);
    assert.equal(product.guidance.kind, 'marketing_orientation');
    for (const locale of ['ru', 'kk'] as const) {
      assert.ok(product.guidance.summary[locale].length > 50); assert.ok(product.guidance.audience[locale].length > 20);
      assert.equal(product.guidance.topics[locale].length, 3);
      assert.doesNotMatch(product.guidance.summary[locale], /100%|гарантирован|автоматическ.*сертификат/);
    }
  }
});
