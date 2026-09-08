import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref } from 'vue';

// Exercise the page's actual async handlers with deliberately reordered transport
// responses. Rendering, Nuxt routing and the real API are covered by browser tests.
const file = await readFile(new URL('../pages/learn/[id]/index.vue', import.meta.url), 'utf8');
const { descriptor } = parse(file);
const compiled = ts.transpileModule(descriptor.scriptSetup.content, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const setup = new AsyncFunction(
  'useRoute', 'useLocalePath', 'useLmsApi', 'useLmsAnalytics', 'useAsyncData',
  'ref', 'computed', 'onMounted', 'onBeforeUnmount', 'watch', 'useHead',
  'nextTick',
  compiled + '\nreturn { openLesson, complete, returnToContents, lessonArticle, contentsHeading, selected, lessonData, loadingLesson, lessonError, saving, saveMessage, saveError };',
);
const lesson = (id, completed = false, revision = 0) => ({ id, title: 'SYNTHETIC ' + id, kind: 'text', required: true, completed, revision });
const detail = (id, completed = false, revision = 0) => ({ lesson: lesson(id), progress: { completed, revision } });
const enrollment = (completed = '') => ({ id: 'SYNTHETIC', modules: [{ id: 'module', lessons: ['A', 'B'].map(id => lesson(id, completed === id, completed === id ? 1 : 0)) }] });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function page(api, nextTick = async () => {}) {
  const data = ref(enrollment());
  const refreshes = [];
  let unmount;
  const methods = await setup(
    () => ({ params: { id: 'SYNTHETIC' }, query: {} }), () => value => value,
    () => ({ api, tr: ru => ru, errorText: error => error.message }), () => ({ track() {} }),
    async () => ({ data, pending: ref(false), error: ref(null), refresh: async () => { refreshes.push(true); } }),
    ref, computed, () => {}, callback => { unmount = callback; }, () => {}, () => {}, nextTick,
  );
  return { ...methods, data, refreshes, unmount: () => unmount() };
}

function focusTargets(view) {
  const events = [];
  const target = name => ({ focus: options => events.push({ name, action: 'focus', options }), scrollIntoView: options => events.push({ name, action: 'scroll', options }) });
  view.lessonArticle.value = { querySelector: selector => { assert.equal(selector, 'h2'); return target('lesson'); } };
  view.contentsHeading.value = target('contents');
  return events;
}

test('a prior A response cannot replace the latest A after A→B→A navigation', async () => {
  const requests = [];
  const view = await page(async () => { const response = deferred(); requests.push(response); return response.promise; });
  const first = view.openLesson('A'), middle = view.openLesson('B'), latest = view.openLesson('A');
  requests[2].resolve(detail('A', true, 1)); await latest;
  requests[0].resolve(detail('A')); await first;
  requests[1].resolve(detail('B')); await middle;
  assert.equal(view.selected.value, 'A');
  assert.deepEqual({ ...view.lessonData.value.progress }, { completed: true, revision: 1 });
  assert.equal(view.loadingLesson.value, false);
});

test('an earlier same-lesson error neither removes the latest spinner nor replaces successful content', async () => {
  const requests = [];
  const view = await page(async () => { const response = deferred(); requests.push(response); return response.promise; });
  const first = view.openLesson('A'), middle = view.openLesson('B'), latest = view.openLesson('A');
  requests[0].reject(new Error('OLD FAILURE')); await first;
  assert.equal(view.loadingLesson.value, true);
  assert.equal(view.lessonError.value, null);
  requests[2].resolve(detail('A', true, 1)); await latest;
  requests[1].reject(new Error('OTHER OLD FAILURE')); await middle;
  assert.equal(view.lessonError.value, null);
  assert.equal(view.lessonData.value.lesson.id, 'A');
});

test('saving A then choosing unfinished B preserves B and does not show A success on B or refetch B', async () => {
  const save = deferred(), requests = [];
  const view = await page(async (path, options) => {
    requests.push({ path, method: options?.method || 'GET' });
    return options?.method === 'PUT' ? save.promise : detail(path.split('/').pop());
  });
  await view.openLesson('A'); const saving = view.complete(); await view.openLesson('B');
  save.resolve(enrollment('A')); await saving;
  assert.equal(view.selected.value, 'B'); assert.equal(view.lessonData.value.lesson.id, 'B');
  assert.equal(view.lessonData.value.progress.completed, false); assert.equal(view.saveMessage.value, '');
  assert.equal(view.data.value.modules[0].lessons[0].completed, true, 'Server acknowledgement updates global progress');
  assert.equal(requests.length, 3, 'Only A GET, A PUT, B GET are necessary');
  assert.equal(view.refreshes.length, 0);
});

test('A save failure remains attached to its originating view and does not mark B failed', async () => {
  const save = deferred();
  const view = await page(async (path, options) => options?.method === 'PUT' ? save.promise : detail(path.split('/').pop()));
  await view.openLesson('A'); const saving = view.complete(); await view.openLesson('B');
  save.reject(new Error('A SAVE FAILURE')); await saving;
  assert.equal(view.saveError.value, ''); assert.equal(view.saveMessage.value, '');
  assert.equal(view.lessonData.value.lesson.id, 'B'); assert.equal(view.saving.value, false);
});

test('same-view save applies acknowledged progress and success without unnecessary follow-up reads', async () => {
  const requests = [];
  const view = await page(async (path, options) => {
    requests.push({ path, method: options?.method || 'GET' });
    return options?.method === 'PUT' ? enrollment('A') : detail('A');
  });
  await view.openLesson('A'); await view.complete();
  assert.deepEqual({ ...view.lessonData.value.progress }, { completed: true, revision: 1 });
  assert.equal(view.saveMessage.value, 'Завершение урока сохранено.');
  assert.equal(view.saveError.value, ''); assert.equal(view.refreshes.length, 0); assert.equal(requests.length, 2);
});

test('an A read started before A save committed cannot undo acknowledged progress after navigation back to A', async () => {
  const save = deferred(), lateRead = deferred(); let reads = 0;
  const view = await page(async (path, options) => {
    if (options?.method === 'PUT') return save.promise;
    reads++;
    return reads === 3 ? lateRead.promise : detail(path.split('/').pop());
  });
  await view.openLesson('A'); const saving = view.complete(); await view.openLesson('B'); const back = view.openLesson('A');
  save.resolve(enrollment('A')); await saving;
  lateRead.resolve(detail('A')); await back;
  assert.deepEqual({ ...view.lessonData.value.progress }, { completed: true, revision: 1 });
  assert.equal(view.saveMessage.value, '', 'A later visit does not inherit the previous visit\'s notice');
});

test('save failure in the same view is still actionable and does not fabricate completion', async () => {
  const view = await page(async (path, options) => { if (options?.method === 'PUT') throw new Error('NETWORK FAILED'); return detail('A'); });
  await view.openLesson('A'); await view.complete();
  assert.equal(view.saveError.value, 'NETWORK FAILED'); assert.equal(view.lessonData.value.progress.completed, false);
  assert.equal(view.saveMessage.value, ''); assert.equal(view.saving.value, false);
});

test('only explicit lesson selection focuses the loaded heading after rendering; initial/read retry/save stay put', async () => {
  const render = deferred();
  const view = await page(async (path, options) => options?.method === 'PUT' ? enrollment('A') : detail(path.split('/').pop()), () => render.promise);
  const events = focusTargets(view);
  await view.openLesson('A'); await view.openLesson('A'); await view.complete();
  assert.deepEqual(events, []);
  const selection = view.openLesson('B', true);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(events, [], 'An unrendered heading must not be focused');
  render.resolve(); await selection;
  assert.deepEqual(events, [
    { name: 'lesson', action: 'focus', options: { preventScroll: true } },
    { name: 'lesson', action: 'scroll', options: { block: 'start', behavior: 'instant' } },
  ]);
});

test('out-of-order selected lessons only move focus for the newest request', async () => {
  const requests = [];
  const view = await page(async () => { const response = deferred(); requests.push(response); return response.promise; });
  const events = focusTargets(view);
  const first = view.openLesson('A', true), middle = view.openLesson('B', true), latest = view.openLesson('A', true);
  requests[0].resolve(detail('A')); await first; requests[1].resolve(detail('B')); await middle;
  assert.deepEqual(events, []);
  requests[2].resolve(detail('A')); await latest;
  assert.equal(events.filter(event => event.action === 'focus').length, 1);
});

test('returning to contents while a selected lesson loads cancels its later focus move', async () => {
  const response = deferred();
  const view = await page(async () => response.promise);
  const events = focusTargets(view);
  const selection = view.openLesson('A', true);
  view.returnToContents();
  response.resolve(detail('A')); await selection;
  assert.deepEqual(events.map(event => event.name), ['contents', 'contents']);
  assert.equal(view.lessonData.value.lesson.id, 'A', 'Returning to contents does not discard the requested lesson');
});

test('a new choice or unmount during render prevents stale focus', async () => {
  for (const change of ['choice', 'unmount']) {
    const render = deferred();
    const view = await page(async path => detail(path.split('/').pop()), () => render.promise);
    const events = focusTargets(view);
    const selection = view.openLesson('A', true);
    await Promise.resolve(); await Promise.resolve();
    if (change === 'choice') await view.openLesson('B'); else view.unmount();
    render.resolve(); await selection;
    assert.deepEqual(events, [], change);
  }
});

test('failed selected lesson leaves focus available for its retry control', async () => {
  const view = await page(async () => { throw new Error('READ FAILED'); });
  const events = focusTargets(view);
  await view.openLesson('A', true);
  assert.equal(view.lessonError.value.message, 'READ FAILED'); assert.deepEqual(events, []);
});
