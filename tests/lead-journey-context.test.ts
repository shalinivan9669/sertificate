import assert from 'node:assert/strict';
import test from 'node:test';
import { leadContextQuery, leadProgramSelectionFingerprint, resolveLeadJourneyContext, resolveSavedLeadJourneyContext } from '../shared/lead-context';

test('saved visitor preferences never alter server or first client conversion links', () => {
  const defaults = { programId: 'ohrana-truda' };
  const saved = { direction: 'ptm', city: 'almaty', format: 'onsite' };
  assert.deepEqual(resolveLeadJourneyContext({}, saved, false, defaults), {
    programId: 'ohrana-truda', city: '', format: '',
  });
  assert.deepEqual(resolveLeadJourneyContext({ city: 'astana' }, saved, false, defaults), {
    programId: 'ohrana-truda', city: 'astana', format: '',
  });
});

test('a clean article transition retains selected course, city and format in its conversion link', () => {
  const course = resolveLeadJourneyContext({ programId: 'industrial-safety', city: 'almaty', format: 'onsite' }, {}, true);
  // A separate journey context stores the canonical programme; catalogue selection is untouched.
  const saved = { direction: course.programId, city: course.city, format: course.format };
  const article = resolveLeadJourneyContext({}, saved, true, { programId: 'ohrana-truda' });
  assert.deepEqual(leadContextQuery(article), {
    program: 'promyshlennaya-bezopasnost', city: 'almaty', format: 'onsite',
  });
});

test('explicit multi-programme enquiry survives clean editorial navigation without mutating saved selection', () => {
  const savedSelection = { direction: 'ptm', directionIds: ['ptm', 'elektrobezopasnost'], city: 'astana', format: 'online' };
  const before = structuredClone(savedSelection);
  const visit = resolveLeadJourneyContext({ programId: 'ohrana-truda', programs: 'ohrana-truda,ptm', city: 'almaty', format: 'onsite' }, savedSelection, true);
  const article = resolveLeadJourneyContext({}, visit, true, { programId: 'pervaya-pomoshch' });
  assert.deepEqual(leadContextQuery(article), { program: 'ohrana-truda', programs: 'ohrana-truda,ptm', city: 'almaty', format: 'onsite' });
  assert.deepEqual(savedSelection, before);
  assert.deepEqual(leadContextQuery(resolveLeadJourneyContext({ programs: '' }, savedSelection, true)), { city: 'astana', format: 'online' });
});

test('explicit path and query choices win over saved preferences and unrelated article defaults', () => {
  const result = resolveLeadJourneyContext({ programId: 'ptm', city: 'astana', format: 'classroom' }, {
    direction: 'ohrana-truda', city: 'almaty', format: 'onsite',
  }, true, { programId: 'elektrobezopasnost' });
  assert.deepEqual(result, { programId: 'ptm', city: 'astana', format: 'classroom' });
});

test('fallback context is validated before it reaches a conversion URL', () => {
  assert.deepEqual(resolveLeadJourneyContext({ city: '<invalid>', format: 'invented' }, {
    direction: 'unknown', city: 'unknown', format: 'unknown', phone: 'private', email: 'private',
  }, true), { programId: '', city: '', format: '' });
});

test('new city and format choices supersede the previous informational visit', () => {
  const oldSelection = { directionIds: ['ptm'], city: 'almaty', format: 'onsite' };
  const journey = { programs: 'ohrana-truda', selectionFingerprint: leadProgramSelectionFingerprint(oldSelection) };
  const current = { ...oldSelection, city: 'astana', format: 'online' };
  assert.deepEqual(leadContextQuery(resolveLeadJourneyContext({}, resolveSavedLeadJourneyContext(current, journey), true)), {
    program: 'ohrana-truda', city: 'astana', format: 'online',
  });
});

test('changing the actual programme selection invalidates a previous viewed programme fallback', () => {
  const before = { directionIds: ['ptm', 'elektrobezopasnost'], city: 'almaty', format: 'onsite' };
  const journey = { programs: 'ohrana-truda', selectionFingerprint: leadProgramSelectionFingerprint(before) };
  const current = { directionIds: ['pervaya-pomoshch', 'ptm'], city: 'astana', format: 'online' };
  assert.deepEqual(leadContextQuery(resolveLeadJourneyContext({}, resolveSavedLeadJourneyContext(current, journey), true)), {
    program: 'pervaya-pomoshch', programs: 'pervaya-pomoshch,ptm', city: 'astana', format: 'online',
  });
});
