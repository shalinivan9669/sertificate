import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDirections } from '../shared/course-registry';
import { cities } from '../config/cities';
import { leadCities, leadCityLabel, leadCityValue, leadContextQuery, leadFormats, readLeadContext } from '../shared/lead-context';

test('every published direction and existing city keeps its exact identity through the consultation query', () => {
  assert.equal(courseDirections.length, 20);
  assert.deepEqual(leadCities.map(city => city.id), cities.map(city => city.slug));
  for (const direction of courseDirections) {
    for (const city of cities) {
      for (const format of leadFormats) {
        const source = { programId: direction.id, city: city.slug, format: format.id };
        const query = leadContextQuery(source);
        assert.deepEqual(query, { program: direction.id, city: city.slug, format: format.id });
        assert.deepEqual(readLeadContext(query), source);
      }
    }
  }
});

test('the existing wizard schema forwards only chosen public context into the B2B form', () => {
  const storedSelection = { direction: 'ptm', role: 'hr', industry: 'construction', format: 'onsite', city: 'astana' };
  assert.deepEqual(leadContextQuery(storedSelection), { program: 'ptm', city: 'astana', format: 'onsite' });
  assert.deepEqual(readLeadContext(leadContextQuery(storedSelection)), { programId: 'ptm', city: 'astana', format: 'onsite' });
  assert.deepEqual(storedSelection, { direction: 'ptm', role: 'hr', industry: 'construction', format: 'onsite', city: 'astana' });
});

test('historical runtime aliases resolve to the registry ID, with explicit program taking precedence', () => {
  assert.deepEqual(leadContextQuery({ program: 'labor-safety', direction: 'ptm' }), { program: 'ohrana-truda' });
  assert.deepEqual(leadContextQuery({ program: 'industrial-safety' }), { program: 'promyshlennaya-bezopasnost' });
  assert.deepEqual(leadContextQuery({ program: 'fire-safety' }), { program: 'ptm' });
  assert.deepEqual(leadContextQuery({ program: ['ptm'], direction: 'ohrana-truda' }), {});
});

test('unknown/private query, arbitrary locale, arrays, and contact strings never become inferred context', () => {
  for (const input of [null, undefined, [], 'ptm', {
    program: '/learn/private-enrollment', city: 'learner@example.test', format: 'https://example.test',
    locale: 'kk', returnTo: '/admin/operations', sourcePath: '/learn/secret', name: 'PRIVATE NAME',
    utm_campaign: 'PRIVATE CAMPAIGN', referrer: 'https://example.test/?email=private',
  }, { program: ['ptm'], city: ['astana'], format: ['online'] }, { program: 'PTM', city: 'Астана', format: 'офлайн' }]) {
    assert.deepEqual(leadContextQuery(input), {});
  }
  assert.deepEqual(leadContextQuery({ program: 'ptm', locale: 'kk', returnTo: '/cabinet', email: 'private@example.test' }), { program: 'ptm' });
});

test('RU and KK visible city names round-trip to the exact slug; manual edits are retained', () => {
  for (const city of leadCities) {
    for (const locale of ['ru', 'kk']) {
      const label = leadCityLabel(city.id, locale);
      assert.ok(label);
      assert.equal(leadCityValue(label), city.id);
      assert.equal(leadCityValue(` ${label} `), city.id);
    }
  }
  assert.equal(leadCityLabel('kostanay', 'kk'), 'Қостанай');
  assert.equal(leadCityLabel('unknown', 'ru'), '');
  assert.equal(leadCityValue('  Темиртау  '), 'Темиртау');
  assert.equal(leadCityValue(''), '');
});

test('direct forms have no hidden program, inferred format, city, or stored-choice fallback', () => {
  assert.deepEqual(readLeadContext({}), { programId: '', city: '', format: '' });
  assert.deepEqual(leadContextQuery({ city: 'astana' }), { city: 'astana' });
  assert.deepEqual(readLeadContext({ program: '', direction: 'ptm' }), { programId: '', city: '', format: '' });
});
