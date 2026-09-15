import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3102";
const fixture = JSON.parse(
  await readFile(".data/editorial/e2e-fixture.json", "utf8"),
);
if (fixture.notice !== "SYNTHETIC LOCAL TEST DATA ONLY")
  throw new Error("Synthetic fixture required");
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const report = { checks: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
async function ready() {
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#__nuxt")?.__vue_app__),
  );
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) {
  await ready();
  // Reset the viewport before a full-page capture so sticky/fixed elements
  // are not composited halfway down the document after focusing an answer.
  await page.evaluate(() => window.scrollTo(0, 0));
  const size = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll, name).toBeLessThanOrEqual(size.width + 1);
  await expect(page.locator('.civic-footer-contact > a').first()).toHaveCSS('color', 'rgb(244, 236, 221)');
  await page.screenshot({
    path: `artifacts/editorial/${name}.png`,
    fullPage: true,
  });
  report.checks.push({ name, ...size });
}
try {
  await page.goto(base + "/auth/login?returnTo=/cabinet", {
    waitUntil: "domcontentloaded",
  });
  await ready();
  await page.getByLabel("Email", { exact: true }).fill(fixture.other.email);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(fixture.other.password);
  await page
    .getByRole("button", { name: "Вход в личный кабинет", exact: true })
    .click();
  await page.waitForURL(base + "/cabinet");
  await page
    .getByRole("link", { name: "Открыть обучение", exact: true })
    .first()
    .waitFor();
  const destination = await page
    .getByRole("link", { name: "Открыть обучение", exact: true })
    .first()
    .getAttribute("href");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await capture("cabinet-authenticated-" + width);
  }
  await page.goto(base + destination, { waitUntil: "domcontentloaded" });
  await page.locator(".lms-reading").waitFor();
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [820, 820],
    [1024, 768],
    [1440, 1000],
    [1920, 1080],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await capture("lesson-" + width);
  }
  await page.goto(base + destination + '/exam', { waitUntil: 'domcontentloaded' });
  await ready();
  await page.locator('.lms-card, [role="timer"]').first().waitFor();
  if (!(await page.getByRole('timer').isVisible())) {
    await page.goto(base + destination + '/pre-test', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.').check();
    await page.getByRole('button', { name: 'Начать попытку — запустить таймер', exact: true }).click();
    await page.waitForURL(/\/exam\?attempt=/);
  }
  await page.getByLabel("Correct test option", { exact: true }).check();
  await page.getByText("Все ответы сохранены", { exact: true }).waitFor();
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [820, 820],
    [1024, 768],
    [1440, 1000],
    [1920, 1080],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByLabel("Correct test option", { exact: true }),
    ).toBeChecked();
    await capture("exam-" + width);
  }
  await page.setViewportSize({ width: 390, height: 460 });
  await expect(
    page.getByLabel("Correct test option", { exact: true }),
  ).toBeChecked();
  await capture("exam-reduced-viewport");
  await page.getByRole('checkbox').first().focus();
  const focusedAnswer = await page.evaluate(() => {
    const input = document.activeElement;
    const rect = input.getBoundingClientRect();
    return { visible: rect.top >= 0 && rect.bottom <= innerHeight, unobscured: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === input };
  });
  expect(focusedAnswer).toEqual({ visible: true, unobscured: true });
  await page.screenshot({ path: 'artifacts/editorial/exam-focus-reduced-viewport.png' });
  report.checks.push({ name: 'focused answer remains visible above a reduced viewport edge and is not obscured by the timer', ...focusedAnswer });
  const examUrl = new URL(page.url());
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + '/kk' + destination, { waitUntil: 'domcontentloaded' });
    await page.locator('.lms-reading').waitFor();
    await capture('lesson-kk-' + width);
    await page.goto(base + '/kk' + examUrl.pathname + examUrl.search, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Correct test option', { exact: true }).waitFor();
    await capture('exam-kk-' + width);
  }
  expect(report.errors).toEqual([]);
} catch (error) {
  report.failure = error.stack;
  report.visibleError = await page.locator('main').innerText().catch(() => '');
  await page.screenshot({ path: 'artifacts/editorial/learning-visual-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(
    "artifacts/editorial/learning-visual-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
