import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';

/** Runs inside the real, MFA-authenticated local editor session. It never saves a version. */
export async function checkLessonPreview(page, { language = 'ru', content, outputDirectory } = {}) {
  const base = new URL(page.url()).origin;
  assert.match(base, /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.OT_ALLOW_TEST_SEED, '1');
  for (const key of ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) assert.ok(!process.env[key], `Local preview refuses ${key}`);
  const labels = language === 'kk' ? {
    create: 'Жоба жасау', file: 'Оқу пакетін жүктеу', apply: 'Жаңа жоба ретінде ашу',
    show: 'Сабақты алдын ала қарау', hide: 'Сабақты алдын ала қарауды жасыру', region: 'Сабақ мазмұнын алдын ала қарау',
    transcript: 'Бейненің мәтіндік нұсқасы', body: 'Сабақ мәтіні / практикалық тапсырма',
    practice: 'Практикалық бөлім орындалғаннан кейін уәкілетті қызметкер растайды.', hours: /^Көлемі, сағат/, date: 'Мазмұнды тексеру күні',
  } : {
    create: 'Создать черновик', file: 'Загрузить учебный пакет', apply: 'Открыть как новый черновик',
    show: 'Предпросмотр урока', hide: 'Скрыть предпросмотр урока', region: 'Предпросмотр содержания урока',
    transcript: 'Текстовая расшифровка видео', body: 'Текст урока / задание на практику',
    practice: 'Практическую часть подтверждает уполномоченный сотрудник после выполнения.', hours: /^Объём, часы/, date: 'Дата проверки содержания',
  };
  const data = structuredClone(content || {
    title: 'TEST ONLY local lesson preview', language, audience: 'Synthetic browser fixture', prerequisites: '',
    outcomes: 'No training or qualification', limitations: 'TEST ONLY', format: 'Local test', durationHours: null,
    priceMinor: null, currency: 'KZT', billingBasis: 'learner', accessModel: 'manual', documentDescription: 'No document',
    support: 'TEST', sourceRefs: ['Synthetic local fixture'], reviewedAt: '',
    modules: [{ id: 'preview-module', title: 'TEST preview module', lessons: [
      { id: 'preview-text', title: 'TEST long lesson ' + 'Организация безопасного труда '.repeat(5), kind: 'text', required: true, body: 'TEST literal text <script>window.previewInjected=true</script>\n\n' + 'Учебное объяснение для проверки длинного текста. '.repeat(80) + '\nhttps://example.invalid/' + 'a'.repeat(160), media: [] },
      { id: 'preview-practice', title: 'TEST written practice', kind: 'practice', required: true, body: 'TEST ONLY practice case. No learner confirmation or competence is created.', media: [] },
    ] }],
    assessment: { durationMinutes: 10, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'preview-question', text: 'TEST PRIVATE BANK MUST NOT ENTER LESSON PREVIEW', topic: 'TEST', options: [{ id: 'a', text: 'TEST KEY OPTION' }, { id: 'b', text: 'TEST OTHER OPTION' }], correctOptionIds: ['a'] }],
  });
  const lessons = data.modules.flatMap(module => module.lessons);
  assert.ok(lessons.length >= 2 && lessons.some(lesson => lesson.kind === 'practice'));
  const firstLesson = lessons[0];
  const practiceLesson = lessons.find(lesson => lesson.kind === 'practice');
  firstLesson.media = [
    { kind: 'image', url: 'https://preview-media.invalid/image.png', alt: 'TEST alternative description of a diagram', transcript: '' },
    { kind: 'video', url: 'https://preview-media.invalid/video.mp4', alt: 'TEST named video', transcript: 'TEST full text alternative. <b>This remains plain text.</b>' },
    { kind: 'attachment', url: 'javascript:window.previewInjected=true', alt: 'TEST unvalidated attachment', transcript: '' },
  ];
  data.durationHours = null;
  data.reviewedAt = '';
  const beforeResponse = await page.request.get(base + '/api/v1/admin/program-versions');
  assert.equal(beforeResponse.status(), 200);
  const before = await beforeResponse.json();
  const requests = [];
  const observe = request => {
    const url = new URL(request.url());
    if ((url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) || url.hostname === 'preview-media.invalid') requests.push({ method: request.method(), host: url.hostname, path: url.pathname });
  };
  page.on('request', observe);
  const checkpoints = [];
  const keyboardChecks = [];
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const previewButton = (label, title) => page.getByRole('button', { name: new RegExp('^' + escaped(label) + '\\s*:\\s*' + escaped(title.trim().replace(/\s+/g, ' ')) + '$') });
  async function keyboardReach(locator) {
    for (let count = 0; count < 600; count++) {
      if (await locator.evaluate(element => element === document.activeElement)) {
        const samples = [];
        try {
          await expect.poll(async () => {
            const state = await locator.evaluate(element => {
              const box = element.getBoundingClientRect();
              return { top: box.top, bottom: box.bottom, height: box.height, viewportHeight: innerHeight, scrollY,
                focused: element === document.activeElement, focusVisible: element.matches(':focus-visible'),
                name: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 200) };
            });
            samples.push(state);
            return state.top >= 0 && state.bottom <= state.viewportHeight;
          }).toBe(true);
        } catch (error) {
          if (outputDirectory) {
            await mkdir(outputDirectory, { recursive: true });
            await writeFile(resolve(outputDirectory, `lesson-preview-focus-failure-${language}.json`), JSON.stringify({ language, tabCount: count, samples }, null, 2));
            await page.screenshot({ path: resolve(outputDirectory, `lesson-preview-focus-failure-${language}.png`) });
          }
          throw new Error('Focused preview control is outside the viewport: ' + JSON.stringify(samples.at(-1)), { cause: error });
        }
        assert.ok(await locator.evaluate(element => element.matches(':focus-visible')));
        keyboardChecks.push({ tabCount: count, samples });
        return count;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error('Preview control not reached with Tab');
  }
  try {
    await page.goto(base + (language === 'kk' ? '/kk' : '') + '/admin/programs');
    await page.getByRole('button', { name: labels.create, exact: true }).click();
    await page.getByLabel(labels.file, { exact: true }).setInputFiles({ name: 'lesson-preview.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'ot-center-program-draft-v1', programId: 'ohrana-truda', data })) });
    await page.getByRole('button', { name: labels.apply, exact: true }).click();
    const controlId = await previewButton(labels.show, firstLesson.title).getAttribute('aria-controls');
    const firstButton = page.locator(`button[aria-controls=${JSON.stringify(controlId)}]`);
    await keyboardReach(firstButton);
    await page.keyboard.press('Enter');
    await expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    const preview = page.getByRole('region', { name: labels.region, exact: true });
    await expect(preview.getByRole('heading', { level: 4, name: firstLesson.title, exact: true })).toBeVisible();
    assert.equal(await preview.locator('p.whitespace-pre-wrap').first().textContent(), firstLesson.body);
    assert.equal(await preview.locator('img,video,a,script').count(), 0);
    assert.equal(await preview.getByText(firstLesson.media[0].alt, { exact: false }).count(), 1);
    for (const question of data.questions) assert.ok(!(await preview.textContent()).includes(question.text), 'Question bank is absent from the lesson-only renderer');
    assert.ok(!(await page.evaluate(() => window.previewInjected)));
    checkpoints.push('Current unsaved lesson renders as escaped text with descriptions; no active media, attachment or question bank');
    const summary = preview.locator('summary').filter({ hasText: labels.transcript });
    await keyboardReach(summary);
    await page.keyboard.press('Enter');
    await expect(preview.getByText(firstLesson.media[1].transcript, { exact: true })).toBeVisible();
    assert.equal(await preview.locator('b').count(), 0);
    checkpoints.push('Transcript disclosure opens with keyboard and preserves plain text');
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await preview.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && element.scrollWidth <= element.clientWidth + 1; }));
      if (outputDirectory) {
        await mkdir(outputDirectory, { recursive: true });
        await preview.screenshot({ path: resolve(outputDirectory, `lesson-preview-${language}-${width}.png`) });
      }
    }
    checkpoints.push('Long lesson, names and text alternatives fit desktop and 360px');
    const editorBody = page.getByLabel(labels.body, { exact: true }).first();
    await editorBody.fill(firstLesson.body + '\nTEST UNSAVED PREVIEW EDIT');
    await expect(preview.locator('p.whitespace-pre-wrap').first()).toHaveText(firstLesson.body + '\nTEST UNSAVED PREVIEW EDIT');
    await editorBody.fill(firstLesson.body);
    const close = previewButton(labels.hide, firstLesson.title);
    await keyboardReach(close);
    await page.keyboard.press('Enter');
    await expect(preview).toHaveCount(0);
    await expect(previewButton(labels.show, firstLesson.title)).toBeFocused();
    checkpoints.push('Live unsaved edits appear; keyboard collapse retains focus on the same disclosure');
    const practiceButton = previewButton(labels.show, practiceLesson.title);
    await keyboardReach(practiceButton);
    await page.keyboard.press('Enter');
    await expect(preview.getByText(labels.practice, { exact: true })).toBeVisible();
    assert.equal(await preview.locator('button,input,select,textarea').count(), 0);
    await expect(page.getByLabel(labels.hours)).toHaveValue('');
    await expect(page.getByLabel(labels.date, { exact: true })).toHaveValue('');
    const afterResponse = await page.request.get(base + '/api/v1/admin/program-versions');
    assert.equal(afterResponse.status(), 200);
    assert.deepEqual(await afterResponse.json(), before, 'Preview does not save, review or publish any version');
    assert.deepEqual(requests, [], 'Preview sends no domain writes and makes no external media requests');
    checkpoints.push('Practice preview has no completion control; hours/review remain unset and persistent versions unchanged');
    return { language, status: 'passed', checkpoints, keyboardChecks, lessons: lessons.length, firstLessonBodySha256: createHash('sha256').update(firstLesson.body).digest('hex'), domainWrites: 0, externalMediaRequests: 0, screenReader: 'not_run' };
  } finally {
    page.off('request', observe);
  }
}
