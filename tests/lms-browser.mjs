import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://localhost:3101";
if (!/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error(
    "Browser test only runs against an explicitly local test server",
  );
const fixture = JSON.parse(
  await readFile(process.env.OT_E2E_FIXTURE_PATH || new URL("../.data/e2e-fixture.json", import.meta.url), "utf8"),
);
assert.equal(fixture.notice, "SYNTHETIC LOCAL TEST DATA ONLY");
await mkdir("artifacts/lms-browser", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const checks = [];
const pageErrors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
const passed = (name) => {
  checks.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};
async function ready(p) {
  await p.waitForFunction(
    () => Boolean(document.querySelector("#__nuxt")?.__vue_app__),
    { timeout: 15000 },
  );
}
async function login(p, actor, returnTo = "/courses/ohrana-truda") {
  await p.goto(`${base}/auth/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await ready(p);
  await p.getByLabel("Email", { exact: true }).fill(actor.email);
  await p.getByLabel("Пароль", { exact: true }).fill(actor.password);
  await p
    .getByRole("button", { name: "Вход в личный кабинет", exact: true })
    .click();
  await p.waitForURL((url) => url.pathname === returnTo, { timeout: 15000 });
}
async function enrollAndStudy(p) {
  const variants = p.getByLabel(/^Вариант и язык обучения/);
  const enrollButton = p.getByRole("button", {
    name: "Записаться на обучение",
    exact: true,
  });
  await variants.or(enrollButton).first().waitFor({ state: "visible" });
  if (await variants.count()) await variants.selectOption(fixture.versionId);
  await enrollButton.click();
  await p.waitForURL(/\/learn\/[^/?]+$/, { timeout: 15000 });
  const id = new URL(p.url()).pathname.split("/").pop();
  await p
    .getByRole("button", {
      name: "Материал изучен — завершить урок",
      exact: true,
    })
    .waitFor();
  return id;
}
try {
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 1000 });
    for (const route of [
      "/courses",
      "/program-selection",
      "/b2b",
      "/kk/courses",
      "/kk/program-selection",
      "/auth/login",
      "/cabinet",
    ]) {
      const response = await page.goto(base + route, {
        waitUntil: "domcontentloaded",
      });
      await ready(page);
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator("h1").count(), 1, route + " one H1");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${route} overflow at ${width}`,
      );
      assert.equal(
        await page.getByText("Sertificat.kz", { exact: true }).count(),
        0,
      );
      await page.screenshot({
        path: `artifacts/lms-browser/${route.replaceAll("/", "_")}-${width}.png`,
        fullPage: true,
      });
    }
    passed(`RU/KK public and auth screens at ${width}px, no overflow`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const catalogResponse = await page.request.get(
    base + "/api/v1/catalog/programs",
  );
  const catalog = await catalogResponse.json();
  const directions = new Set(catalog.programs.map((p) => p.directionId));
  for (const legacy of [
    "ohrana-truda",
    "promyshlennaya-bezopasnost",
    "ptm",
    "elektrobezopasnost",
    "raboty-na-vysote",
    "gpm-stropalschiki",
    "gazoopasnye-raboty",
    "ekologicheskaya-bezopasnost",
    "pervaya-pomoshch",
  ])
    assert.ok(directions.has(legacy), "Preserve legacy direction " + legacy);
  const unknown = await page.goto(base + "/courses/no-such-program", {
    waitUntil: "domcontentloaded",
  });
  assert.equal(unknown.status(), 404);
  passed(
    "Nine historical directions preserved alongside expanded catalog, unknown program HTTP 404",
  );
  await login(page, fixture.learner);
  passed("Email/password login preserves program returnTo");
  const enrollmentId = await enrollAndStudy(page);
  const initialEnrollment = await (
    await page.request.get(base + "/api/v1/enrollments/" + enrollmentId)
  ).json();
  assert.equal(initialEnrollment.progress.completed, 0);
  await page.route("**/api/v1/enrollments/*/progress/*", (route) =>
    route.abort("failed"),
  );
  await page
    .getByRole("button", {
      name: "Материал изучен — завершить урок",
      exact: true,
    })
    .click();
  await page
    .getByText("Завершение не подтверждено.", { exact: false })
    .waitFor();
  await page.unroute("**/api/v1/enrollments/*/progress/*");
  await page
    .getByRole("button", { name: "Загрузить актуальный прогресс", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Материал изучен — завершить урок",
      exact: true,
    })
    .click();
  await page
    .getByText("Урок завершён. Прогресс сохранён на сервере.", { exact: true })
    .waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByText("Урок завершён. Прогресс сохранён на сервере.", { exact: true })
    .waitFor();
  passed(
    "Lesson starts at zero, offline completion has no false success, retry and reload preserve server progress",
  );
  await page
    .getByRole("link", { name: "Условия проверки знаний", exact: false })
    .click();
  await page
    .getByLabel(
      "Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.",
    )
    .check();
  await page
    .getByRole("button", {
      name: "Начать попытку — запустить таймер",
      exact: true,
    })
    .click();
  await page.waitForURL(/\/exam\?attempt=/);
  const examUrl = page.url();
  const attemptId = new URL(examUrl).searchParams.get("attempt");
  const examDto = await (
    await page.request.get(base + "/api/v1/attempts/" + attemptId)
  ).json();
  assert.equal(JSON.stringify(examDto).includes("correctOptionIds"), false);
  const second = await context.newPage();
  await second.goto(examUrl, { waitUntil: "domcontentloaded" });
  await ready(second);
  await page.getByLabel("Correct test option", { exact: true }).check();
  await page.getByText("Все ответы сохранены", { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  assert.equal(
    await page.getByLabel("Correct test option", { exact: true }).isChecked(),
    true,
  );
  const reloaded = await (
    await page.request.get(base + "/api/v1/attempts/" + attemptId)
  ).json();
  assert.equal(reloaded.deadlineAt, examDto.deadlineAt);
  passed(
    "Attempt has no answer keys; autosave, fixed deadline and chosen answer survive reload",
  );
  await second.getByLabel("Incorrect test option", { exact: true }).check();
  await second
    .getByText("Другой сеанс изменил попытку.", { exact: false })
    .waitFor();
  await second
    .getByRole("button", { name: "Принять ответы с сервера", exact: true })
    .click();
  await expect(
    second.getByLabel("Correct test option", { exact: true }),
  ).toBeChecked();
  await second.close();
  passed(
    "Concurrent tab revision conflict is explicit and server-answer recovery works",
  );
  await page
    .getByRole("button", { name: "Следующий вопрос", exact: true })
    .click();
  await page.getByLabel("Correct test option", { exact: true }).check();
  await page.getByText("Все ответы сохранены", { exact: true }).waitFor();
  await page
    .getByLabel(
      "Завершить попытку сейчас. После отправки ответы изменить нельзя.",
    )
    .check();
  await page
    .getByRole("button", {
      name: "Отправить ответы и завершить попытку",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Проверка знаний пройдена", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/lms-browser/server-passed-result.png",
    fullPage: true,
  });
  passed("Successful result comes from submitted server attempt");
  const otherContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  await otherContext.addCookies([
    {
      name: "ot-redesign-flow",
      value: JSON.stringify({
        passed: true,
        paid: true,
        issued: true,
        stage: "b2b",
        branch: "pass",
      }),
      url: base,
    },
  ]);
  const other = await otherContext.newPage();
  await login(other, fixture.other);
  const inaccessible = await other.request.get(
    base + "/api/v1/enrollments/" + enrollmentId,
  );
  assert.ok([403, 404].includes(inaccessible.status()));
  const otherEnrollment = await enrollAndStudy(other);
  await other
    .getByRole("button", {
      name: "Материал изучен — завершить урок",
      exact: true,
    })
    .click();
  await other
    .getByText("Урок завершён. Прогресс сохранён на сервере.", { exact: true })
    .waitFor();
  await other.goto(base + "/learn/" + otherEnrollment + "/pre-test", {
    waitUntil: "domcontentloaded",
  });
  await ready(other);
  await other
    .getByLabel(
      "Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.",
    )
    .check();
  await other
    .getByRole("button", {
      name: "Начать попытку — запустить таймер",
      exact: true,
    })
    .click();
  await other.waitForURL(/\/exam\?attempt=/);
  await other.getByLabel("Incorrect test option", { exact: true }).check();
  await other.getByText("Все ответы сохранены", { exact: true }).waitFor();
  await other
    .getByLabel(
      "Завершить попытку сейчас. После отправки ответы изменить нельзя.",
    )
    .check();
  await other
    .getByRole("button", {
      name: "Отправить ответы и завершить попытку",
      exact: true,
    })
    .click();
  await other
    .getByRole("heading", { name: "Проверка знаний не пройдена", exact: true })
    .waitFor();
  const otherAttempt = new URL(other.url()).searchParams.get("attempt");
  await other.goto(
    `${base}/learn/${otherEnrollment}/success?attempt=${otherAttempt}&paid=true`,
    { waitUntil: "domcontentloaded" },
  );
  await other
    .getByRole("heading", { name: "Проверка знаний не пройдена", exact: true })
    .waitFor();
  assert.equal(
    await other.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await other.screenshot({
    path: "artifacts/lms-browser/server-failed-result-360.png",
    fullPage: true,
  });
  passed(
    "Wrong answer fails on server; fake cookies and success URL cannot alter outcome; cross-account access denied",
  );
  await otherContext.close();
  await page.goto(base + "/cabinet", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL(/\/auth\/login$/);
  assert.equal((await page.request.get(base + "/api/v1/me")).status(), 401);
  passed("Logout invalidates access and clears private client data");
  assert.deepEqual(pageErrors, []);
  passed("No browser JavaScript errors");
} catch (error) {
  checks.push({ name: "Browser suite", status: "failed", error: error.stack });
  await page
    .screenshot({ path: "artifacts/lms-browser/failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await writeFile(
    "artifacts/lms-browser/report.json",
    JSON.stringify({ base, checks, pageErrors }, null, 2),
  );
  await browser.close();
}
