import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredProgramVersion } from '../shared/program-version-selection';
const versions = [
  { id: 'ru-online', language: 'ru', format: 'online' },
  { id: 'kk-online', language: 'kk', format: 'online' },
  { id: 'ru-onsite', language: 'ru', format: 'onsite' },
];
test('program respects language and requested format instead of first published version', () => {
  assert.equal(preferredProgramVersion(versions, { language: 'ru', format: 'onsite' })?.id, 'ru-onsite');
  assert.equal(preferredProgramVersion(versions, { language: 'kk', format: 'online' })?.id, 'kk-online');
});
test('user choice takes priority over deep-link version; invalid identifiers never create a version', () => {
  assert.equal(preferredProgramVersion(versions, { language: 'ru', selected: 'ru-online', versionId: 'ru-onsite' })?.id, 'ru-online');
  assert.equal(preferredProgramVersion(versions, { language: 'ru', versionId: 'ru-onsite' })?.id, 'ru-onsite');
  assert.equal(preferredProgramVersion(versions, { language: 'ru', versionId: 'missing', format: 'onsite' })?.id, 'ru-onsite');
  assert.equal(preferredProgramVersion([], { language: 'ru' }), undefined);
});
test('unavailable preference returns an actual version whose mismatch the UI must disclose', () => {
  const version = preferredProgramVersion(versions, { language: 'kk', format: 'onsite' });
  assert.equal(version?.id, 'kk-online');
  assert.notEqual(version?.format, 'onsite');
});
