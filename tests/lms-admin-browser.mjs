import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import { PDFDocument } from "pdf-lib";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3101";
if (
  process.env.NODE_ENV !== "test" ||
  process.env.OT_ALLOW_TEST_SEED !== "1" ||
  process.env.VERCEL ||
  process.env.TURSO_DATABASE_URL ||
  !/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)
)
  throw new Error("Explicit local test environment required");
const fixture = JSON.parse(
  await readFile(process.env.OT_E2E_FIXTURE_PATH || new URL("../.data/e2e-fixture.json", import.meta.url), "utf8"),
);
assert.equal(fixture.notice, "SYNTHETIC LOCAL TEST DATA ONLY");
assert.ok(fixture.databasePath.endsWith("e2e.sqlite"));
const db = createClient({
  url: "file:" + fixture.databasePath.replaceAll("\\", "/"),
});
const runId = Date.now();
const password = "Synthetic-admin-browser-2026!";
const hash = await hashPassword(password);
const users = {};
for (const role of ["editor", "reviewer", "admin", "finance", "issuer"]) {
  const id = "browser-" + role + "-" + randomUUID();
  const user = {
    id,
    name: "TEST ONLY " + role,
    email: role + "-" + runId + "@example.test",
    role,
    password,
  };
  await db.execute({
    sql: 'INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)',
    args: [id, user.name, user.email, role, Date.now(), Date.now()],
  });
  await db.execute({
    sql: "INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)",
    args: [id + "-account", id, "credential", id, hash, Date.now(), Date.now()],
  });
  users[role] = user;
}
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const contexts = [];
const checks = [];
const errors = [];
const passed = (name) => {
  checks.push({ name, status: "passed" });
  console.log("PASS", name);
};
async function go(page, path) {
  await page.goto(path.startsWith("http") ? path : base + path, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#__nuxt")?.__vue_app__),
  );
}
function totp(uri) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of new URL(uri).searchParams
    .get("secret")
    .toUpperCase()
    .replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return String(
    (hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}
let lastSessionStartedAt = 0;
async function session(user, mfa = true) {
  // Exercise the real five-logins-per-minute limit without changing server policy.
  const delay = Math.max(0, 13000 - (Date.now() - lastSessionStartedAt));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastSessionStartedAt = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await go(page, "/auth/login?returnTo=%2Fcabinet%2Fsecurity");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(user.password);
  let loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Вход в личный кабинет", exact: true })
    .click();
  let login = await loginResponse;
  if (login.status() === 429) {
    console.log(
      "INFO Real authentication limiter reached; waiting before one UI retry",
    );
    await page.waitForTimeout(
      Math.min(
        60000,
        Math.max(1000, Number(login.headers()["retry-after"] || 60) * 1000),
      ),
    );
    loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Вход в личный кабинет", exact: true })
      .click();
    login = await loginResponse;
  }
  assert.equal(
    login.status(),
    200,
    "Actual staff sign-in status: " + login.status(),
  );
  await page.waitForURL((url) => url.pathname === "/cabinet/security");
  if (mfa) {
    try {
      await page
        .getByLabel("Текущий пароль", { exact: true })
        .waitFor({ timeout: 10000 });
    } catch (error) {
      const response = await page.request.get(base + "/api/v1/me");
      checks.push({
        name: "MFA setup screen diagnostic",
        role: user.role,
        status: response.status(),
        visibleErrors: await page.locator(".lms-error").allTextContents(),
      });
      await page.screenshot({
        path: "artifacts/lms-browser/security-failure.png",
        fullPage: true,
      });
      throw error;
    }
    await page
      .getByLabel("Текущий пароль", { exact: true })
      .fill(user.password);
    await page
      .getByRole("button", { name: "Настроить приложение", exact: true })
      .click();
    await expect(page.locator("code")).toContainText("otpauth://");
    const uri = await page.locator("code").textContent();
    await page.getByLabel("Код из приложения", { exact: true }).fill(totp(uri));
    await page
      .getByRole("button", { name: "Подтвердить и включить", exact: true })
      .click();
    await page
      .getByText("Настройки безопасности сохранены.", { exact: true })
      .waitFor();
  }
  return page;
}
async function post(page, path, data) {
  return page.request.post(base + "/api/v1" + path, {
    headers: { Origin: base },
    data,
  });
}
let editor;
let admin;
try {
  editor = await session(users.editor);
  await go(editor, "/admin");
  await expect(
    editor.getByRole("link", { name: "Программы и редактор", exact: true }),
  ).toBeVisible();
  assert.equal(
    await editor
      .getByRole("link", { name: "Пользователи и права", exact: true })
      .count(),
    0,
  );
  passed(
    "Editor session completed real MFA and sees only its administration tools",
  );
  await go(editor, "/admin/programs");
  await editor
    .getByRole("button", { name: "Создать черновик", exact: true })
    .click();
  const title = "[TEST ONLY] Browser authored version " + runId;
  await editor
    .getByLabel(/^Направление/)
    .selectOption("antiterroristicheskaya-podgotovka");
  await editor
    .locator("summary")
    .filter({ hasText: "Материалы для подготовки программы" })
    .click();
  await editor
    .getByText("Расчет курса по продуктам", { exact: false })
    .waitFor();
  await expect(
    editor.getByText("Учебные мероприятия по", { exact: false }),
  ).toBeVisible();
  await expect(
    editor.getByText("Нужно подготовить и проверить", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    editor.getByLabel("Название программы", { exact: true }),
  ).toHaveValue("");
  passed(
    "Source authoring guide displays actual PDF inventory and missing content without manufacturing a course",
  );
  await editor.getByLabel(/^Направление/).selectOption("ohrana-truda");
  await editor.getByLabel("Название программы", { exact: true }).fill(title);
  await editor
    .getByLabel("Формат и практика", { exact: true })
    .fill("Synthetic test only");
  await editor.getByLabel(/^Объём, часы/).fill("1");
  await editor
    .getByLabel("Дата проверки содержания", { exact: true })
    .fill(new Date().toISOString().slice(0, 10));
  await editor.getByLabel(/^Модель доступа/).selectOption("free");
  await editor
    .getByLabel("Стоимость, ₸ (пусто — по запросу)", { exact: true })
    .fill("0");
  for (const label of [
    "Аудитория",
    "Результаты обучения",
    "Порядок оформления и вид документа",
    "Поддержка и контакты",
  ])
    await editor
      .getByLabel(label, { exact: true })
      .fill(
        "Synthetic test content; no occupational competence or real document",
      );
  await editor
    .getByLabel("Источники — один на строку", { exact: true })
    .fill("tests/lms-admin-browser.mjs synthetic evidence");
  await editor
    .getByRole("button", { name: "Добавить модуль", exact: true })
    .click();
  await editor
    .getByLabel("Название модуля", { exact: true })
    .fill("TEST module");
  await editor
    .getByRole("button", { name: "Добавить урок", exact: true })
    .click();
  await editor
    .getByLabel("Название урока", { exact: true })
    .fill("TEST lesson");
  await editor
    .getByLabel("Текст урока / задание на практику", { exact: true })
    .fill("Synthetic browser lesson text only.");
  await editor
    .getByRole("button", { name: "Добавить вопрос", exact: true })
    .click();
  await editor.locator("summary").filter({ hasText: "Новый вопрос" }).click();
  await editor
    .getByLabel("Формулировка", { exact: true })
    .fill("Synthetic browser question");
  await editor.getByLabel("Тема", { exact: true }).fill("Test");
  await editor
    .getByLabel("Вариант ответа 1", { exact: true })
    .fill("Correct synthetic response");
  await editor
    .getByLabel("Вариант ответа 2", { exact: true })
    .fill("Incorrect synthetic response");
  await editor.getByLabel("Правильный вариант 1", { exact: true }).check();
  await editor
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await editor.getByText("Черновик сохранён.", { exact: true }).waitFor();
  await editor
    .getByRole("button", {
      name: "Проверить полноту и передать на рецензию",
      exact: true,
    })
    .click();
  await editor
    .getByText("Версия передана на проверку.", { exact: true })
    .waitFor();
  const listed = await (
    await editor.request.get(base + "/api/v1/admin/program-versions")
  ).json();
  const version = listed.versions.find((v) => v.data.title === title);
  assert.equal(version.status, "review");
  assert.equal(
    (
      await post(editor, "/admin/program-versions/" + version.id + "/publish", {
        revision: version.revision,
        evidence: "Synthetic self approval attempt",
      })
    ).status(),
    403,
  );
  passed(
    "Visual editor creates lesson/question/rules draft, submits review, and server refuses author self-approval",
  );
  const reviewer = await session(users.reviewer);
  await go(reviewer, "/admin/programs");
  await reviewer.getByRole("button").filter({ hasText: title }).click();
  await reviewer
    .getByLabel("Основание утверждения / ссылка на решение", { exact: true })
    .fill("Synthetic independent browser reviewer approval only");
  await reviewer
    .getByLabel(
      "Я проверил(-а) эту версию и подтверждаю открытие записи по ней.",
      { exact: true },
    )
    .check();
  await reviewer
    .getByRole("button", { name: "Утвердить и опубликовать", exact: true })
    .click();
  await reviewer
    .getByText("Версия опубликована для новых назначений.", { exact: true })
    .waitFor();
  const catalog = await (
    await reviewer.request.get(base + "/api/v1/catalog/programs")
  ).json();
  assert.ok(
    catalog.programs.some((p) => p.versions.some((v) => v.id === version.id)),
  );
  passed(
    "Independent reviewer with actual MFA publishes immutable version and public catalog updates",
  );
  const publishedBeforeImport = (
    await db.execute({
      sql: "SELECT * FROM program_versions WHERE id=?",
      args: [version.id],
    })
  ).rows[0];
  for (const locale of ["ru", "kk"]) {
    const labels =
      locale === "ru"
        ? {
            title: "Название программы",
            file: "Загрузить учебный пакет",
            apply: "Открыть как новый черновик",
            hours: /^Объём, часы/,
            reviewed: "Дата проверки содержания",
            save: "Сохранить черновик",
            saved: "Черновик сохранён.",
            review: "Проверить полноту и передать на рецензию",
          }
        : {
            title: "Бағдарлама атауы",
            file: "Оқу пакетін жүктеу",
            apply: "Жаңа жоба ретінде ашу",
            hours: /^Көлемі, сағат/,
            reviewed: "Мазмұнды тексеру күні",
            save: "Жобаны сақтау",
            saved: "Жоба сақталды.",
            review: "Толықтығын тексеріп, рецензияға жіберу",
          };
    const programPage = (locale === "kk" ? "/kk" : "") + "/admin/programs";
    await go(editor, programPage);
    await editor.getByRole("button").filter({ hasText: title }).click();
    await expect(editor.getByLabel(labels.title, { exact: true })).toHaveValue(
      title,
    );
    await expect(editor.getByLabel(labels.title, { exact: true })).toBeDisabled();
    const importTitle = "[TEST ONLY] Imported " + locale + " package " + runId;
    const importData = {
      ...structuredClone(version.data),
      title: importTitle,
      language: locale,
      durationHours: null,
      reviewedAt: "2026-01-01",
      accessModel: "manual",
      priceMinor: null,
    };
    // Optional billing basis must acquire the same server default in the UI.
    delete importData.billingBasis;
    const envelope = {
      format: "ot-center-program-draft-v1",
      programId: "ohrana-truda",
      data: importData,
    };
    const mutations = [];
    const trackMutation = (request) => {
      if (
        new URL(request.url()).pathname.startsWith(
          "/api/v1/admin/program-versions",
        ) &&
        !["GET", "HEAD"].includes(request.method())
      )
        mutations.push({ method: request.method(), url: request.url() });
    };
    editor.on("request", trackMutation);
    try {
      await editor.getByLabel(labels.file, { exact: true }).setInputFiles({
        name: "synthetic-program-" + locale + ".json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(envelope)),
      });
      await expect(
        editor.getByRole("status").filter({ hasText: importTitle }),
      ).toBeVisible();
      await expect(editor.getByLabel(labels.title, { exact: true })).toHaveValue(
        title,
      );
      await expect(editor.getByLabel(labels.hours)).toHaveValue("1");
      await expect(editor.getByLabel(labels.title, { exact: true })).toBeDisabled();
      assert.equal(mutations.length, 0, "File preview must not persist data");
      await editor.getByRole("button", { name: labels.apply, exact: true }).click();
      await expect(editor.getByLabel(labels.title, { exact: true })).toHaveValue(
        importTitle,
      );
      await expect(editor.getByLabel(labels.title, { exact: true })).toBeEnabled();
      await expect(editor.getByLabel(labels.hours)).toHaveValue("");
      await expect(editor.getByLabel(labels.reviewed, { exact: true })).toHaveValue(
        "",
      );
      assert.equal(mutations.length, 0, "Applying a preview only opens a draft");
      const saveResponse = editor.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/admin/program-versions" &&
          response.request().method() === "POST",
      );
      await editor.getByRole("button", { name: labels.save, exact: true }).click();
      const savedResponse = await saveResponse;
      assert.ok(savedResponse.ok(), await savedResponse.text());
      const importedVersion = (await savedResponse.json()).version;
      await editor.getByText(labels.saved, { exact: true }).waitFor();
      assert.equal(mutations.length, 1);
      assert.equal(mutations[0].method, "POST");
      assert.notEqual(importedVersion.id, version.id);
      assert.equal(importedVersion.status, "draft");
      assert.equal(importedVersion.createdBy, users.editor.id);
      assert.equal(importedVersion.approvedBy, null);
      assert.equal(importedVersion.publishedAt, null);
      assert.deepEqual(importedVersion.data, {
        ...importData,
        billingBasis: "learner",
        reviewedAt: "",
      });
      await go(editor, programPage);
      await editor.getByRole("button").filter({ hasText: importTitle }).click();
      await expect(editor.getByLabel(labels.title, { exact: true })).toHaveValue(
        importTitle,
      );
      await expect(editor.getByLabel(labels.hours)).toHaveValue("");
      await expect(editor.getByLabel(labels.reviewed, { exact: true })).toHaveValue(
        "",
      );
      const reviewResponse = editor.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            "/api/v1/admin/program-versions/" + importedVersion.id + "/review" &&
          response.request().method() === "POST",
      );
      await editor.getByRole("button", { name: labels.review, exact: true }).click();
      const rejectedReview = await reviewResponse;
      assert.equal(rejectedReview.status(), 422);
      assert.match(await rejectedReview.text(), /PUBLICATION_INCOMPLETE/);
      await expect(editor.locator(".lms-error")).toBeVisible();
      const reloadedVersionsResponse = await editor.request.get(
        base + "/api/v1/admin/program-versions",
      );
      assert.equal(reloadedVersionsResponse.status(), 200);
      const reloadedVersions = (await reloadedVersionsResponse.json()).versions;
      const persistedImport = reloadedVersions.find(
        (candidate) => candidate.id === importedVersion.id,
      );
      assert.deepEqual(persistedImport, importedVersion);
      const publishedAfterImport = (
        await db.execute({
          sql: "SELECT * FROM program_versions WHERE id=?",
          args: [version.id],
        })
      ).rows[0];
      assert.deepEqual(publishedAfterImport, publishedBeforeImport);
      passed(
        locale.toUpperCase() +
          " file import previews without writes, saves a separate unapproved draft, reloads null hours and rejects incomplete review without changing the published original",
      );
    } finally {
      editor.off("request", trackMutation);
    }
  }
  admin = await session(users.admin);
  const adminDraftResponse = await post(admin, "/admin/program-versions", {
    programId: "ohrana-truda",
    data: {
      ...version.data,
      title: "[TEST ONLY] Self-approval rejection " + runId,
    },
  });
  assert.ok(adminDraftResponse.ok(), await adminDraftResponse.text());
  const adminDraft = (await adminDraftResponse.json()).version;
  const adminReviewedResponse = await post(
    admin,
    "/admin/program-versions/" + adminDraft.id + "/review",
    { revision: adminDraft.revision },
  );
  assert.ok(adminReviewedResponse.ok(), await adminReviewedResponse.text());
  const adminReviewed = (await adminReviewedResponse.json()).version;
  const selfApproval = await post(
    admin,
    "/admin/program-versions/" + adminDraft.id + "/publish",
    {
      revision: adminReviewed.revision,
      evidence:
        "TEST ONLY actual MFA administrator self approval must be rejected",
    },
  );
  assert.equal(selfApproval.status(), 403);
  assert.match(await selfApproval.text(), /SEPARATE_REVIEWER_REQUIRED/);
  passed(
    "Administrator with actual MFA and publish capability still cannot approve their own authored version",
  );
  await go(admin, "/admin");
  await admin
    .locator("summary")
    .filter({ hasText: "Создать организацию" })
    .click();
  const organizationName = "TEST ONLY Organization " + runId;
  await admin
    .getByLabel("Название организации", { exact: true })
    .fill(organizationName);
  await admin
    .getByRole("button", { name: "Создать организацию", exact: true })
    .click();
  await admin.getByText("Организация создана.", { exact: true }).waitFor();
  await go(admin, "/cabinet/organization");
  await admin
    .getByRole("heading", { name: organizationName, exact: true })
    .waitFor();
  await admin.getByLabel("Email", { exact: true }).fill(fixture.learner.email);
  await admin
    .getByRole("button", { name: "Создать приглашение", exact: true })
    .click();
  const invitationLink = admin.locator('a[href*="?invitation="]');
  await invitationLink.waitFor();
  const invitationPath = await invitationLink.getAttribute("href");
  const learner = await session(fixture.learner, false);
  await go(learner, invitationPath);
  await learner
    .getByRole("button", { name: "Принять приглашение", exact: true })
    .click();
  await learner.getByText("Приглашение принято.", { exact: true }).waitFor();
  passed(
    "Organization creation and personalized invitation acceptance work for the verified recipient",
  );
  await go(admin, "/cabinet/organization");
  await admin
    .getByRole("heading", { name: organizationName, exact: true })
    .waitFor();
  await admin.getByLabel("Файл CSV", { exact: true }).setInputFiles({
    name: "synthetic-invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "email,name,role\ninvalid,TEST,member\n" +
        fixture.other.email +
        ",TEST,member\n" +
        fixture.other.email +
        ",TEST,member",
    ),
  });
  await admin
    .getByRole("button", { name: "Проверить и показать строки", exact: true })
    .click();
  await admin.getByText("Предпросмотр готов.", { exact: false }).waitFor();
  await expect(
    admin.getByRole("button", { name: "Подтвердить импорт", exact: true }),
  ).toBeDisabled();
  await admin.getByLabel("Файл CSV", { exact: true }).setInputFiles({
    name: "synthetic-valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "email,name,role\n" + fixture.other.email + ",TEST,member",
    ),
  });
  await admin
    .getByRole("button", { name: "Проверить и показать строки", exact: true })
    .click();
  await admin
    .getByLabel("Я проверил(-а) список и подтверждаю создание приглашений.", {
      exact: true,
    })
    .check();
  await admin
    .getByRole("button", { name: "Подтвердить импорт", exact: true })
    .click();
  await admin.getByText("Импорт подтверждён.", { exact: false }).waitFor();
  passed(
    "CSV preview shows invalid/duplicate rows and requires confirmation before importing valid invitations",
  );
  await admin
    .locator("section")
    .filter({
      has: admin.getByRole("heading", {
        name: "Назначить обучение",
        exact: true,
      }),
    })
    .last()
    .locator("label")
    .filter({ hasText: fixture.learner.email })
    .locator("input[type=checkbox]")
    .check();
  await admin.getByLabel(/^Опубликованная программа/).selectOption(version.id);
  await admin.getByLabel(/Создать назначения выбранным сотрудникам:/).check();
  await admin
    .getByRole("button", { name: "Подтвердить назначения", exact: true })
    .click();
  await admin.getByText("Назначения созданы.", { exact: false }).waitFor();
  const organizations = await (
    await admin.request.get(base + "/api/v1/organizations")
  ).json();
  const organization = organizations.organizations.find(
    (o) => o.name === organizationName,
  );
  const overview = await (
    await admin.request.get(base + "/api/v1/organizations/" + organization.id)
  ).json();
  assert.ok(
    overview.enrollments.some(
      (e) => e.userId === fixture.learner.id && e.status === "pending_access",
    ),
  );
  const csvReport = await admin.request.get(
    base + "/api/v1/organizations/" + organization.id + "/report.csv",
  );
  assert.equal(csvReport.status(), 200);
  passed(
    "Corporate assignment remains pending approved access, real progress report is downloadable",
  );
  const finance = await session(users.finance);
  await go(finance, "/admin");
  await expect(
    finance.getByRole("heading", { name: "Заказы", exact: true }),
  ).toBeVisible();
  assert.equal(
    await finance
      .getByRole("heading", { name: "Документы", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await finance
      .locator("summary")
      .filter({ hasText: "Создать организацию" })
      .count(),
    0,
  );
  passed(
    "Finance sees financial operations without document issuance or organization administration",
  );
  const invoiceConfiguration = await (
    await admin.request.get(
      base + "/api/v1/organizations/" + organization.id + "/invoices",
    )
  ).json();
  if (invoiceConfiguration.enabled) {
    const paidData = {
      ...version.data,
      title: "[TEST ONLY] Paid invoice version " + runId,
      accessModel: "paid",
      billingBasis: "organization",
      priceMinor: 123400,
    };
    const draftResponse = await post(editor, "/admin/program-versions", {
      programId: "ohrana-truda",
      data: paidData,
    });
    assert.ok(draftResponse.ok(), await draftResponse.text());
    const draft = (await draftResponse.json()).version;
    const reviewResponse = await post(
      editor,
      "/admin/program-versions/" + draft.id + "/review",
      { revision: draft.revision },
    );
    assert.ok(reviewResponse.ok(), await reviewResponse.text());
    const reviewed = (await reviewResponse.json()).version;
    const publishedResponse = await post(
      reviewer,
      "/admin/program-versions/" + draft.id + "/publish",
      {
        revision: reviewed.revision,
        evidence:
          "TEST ONLY paid invoice browser fixture independently reviewed",
      },
    );
    assert.ok(publishedResponse.ok(), await publishedResponse.text());
    await go(admin, "/payment/ohrana-truda?versionId=" + draft.id);
    await expect(
      admin.getByRole("link", { name: "Кабинет организации", exact: true }),
    ).toBeVisible();
    assert.equal(
      await admin
        .getByRole("button", { name: "Создать заказ", exact: true })
        .count(),
      0,
    );
    await go(admin, "/cabinet/organization");
    const invoicesSection = admin
      .locator("section")
      .filter({
        has: admin.getByRole("heading", {
          name: "Счета на обучение",
          exact: true,
        }),
      })
      .last();
    await invoicesSection
      .locator("summary")
      .filter({ hasText: "Сформировать счёт для сотрудников" })
      .click();
    await invoicesSection
      .getByLabel(/^Платная программа/)
      .selectOption(draft.id);
    await invoicesSection
      .locator("label")
      .filter({ hasText: fixture.learner.email })
      .locator("input[type=checkbox]")
      .check();
    await invoicesSection
      .locator("label")
      .filter({ hasText: users.admin.email })
      .locator("input[type=checkbox]")
      .check();
    await invoicesSection
      .getByLabel("Наименование плательщика", { exact: true })
      .fill("TEST ONLY synthetic invoice buyer");
    await invoicesSection
      .getByLabel("БИН плательщика", { exact: true })
      .fill("000000000000");
    await invoicesSection
      .getByLabel("Адрес плательщика", { exact: true })
      .fill("TEST ONLY no real postal address");
    await invoicesSection
      .getByLabel(
        "Проверил(-а) программу, список сотрудников и реквизиты плательщика.",
        { exact: true },
      )
      .check();
    await invoicesSection
      .getByRole("button", { name: "Сформировать счёт", exact: true })
      .click();
    await invoicesSection
      .getByText(
        "Счёт сформирован. Реквизиты и итоговая сумма зафиксированы в документе.",
        { exact: true },
      )
      .waitFor();
    const listedInvoices = await (
      await admin.request.get(
        base + "/api/v1/organizations/" + organization.id + "/invoices",
      )
    ).json();
    const invoice = listedInvoices.invoices.find(
      (item) => item.versionId === draft.id,
    );
    assert.equal(invoice.amountMinor, 123400);
    assert.equal(invoice.status, "issued");
    assert.equal(invoice.snapshot.billingBasis, "organization");
    assert.equal(invoice.snapshot.quantity, 2);
    const printable = await admin.request.get(
      base + "/api/v1/invoices/" + invoice.id + "/download",
    );
    assert.equal(printable.status(), 200);
    assert.match(await printable.text(), /TEST ONLY synthetic invoice buyer/);
    assert.equal(
      (
        await learner.request.get(base + "/api/v1/invoices/" + invoice.id)
      ).status(),
      404,
    );
    passed(
      "Organization-priced invoice stays fixed for two staff, individual checkout is hidden, private printable invoice refuses ordinary employee access",
    );
    await go(finance, "/admin");
    const financialInvoice = finance
      .locator("article")
      .filter({ hasText: invoice.number });
    await financialInvoice
      .getByRole("button", { name: "Сверить поступление", exact: true })
      .click();
    await finance
      .getByLabel("Номер банковского документа / платежа", { exact: true })
      .fill("TEST-ONLY-NO-BANK-TRANSFER-" + runId);
    await finance
      .getByLabel("Основание и результаты сверки", { exact: true })
      .fill("TEST ONLY isolated synthetic evidence, no real money transferred");
    await expect(
      finance.getByRole("button", {
        name: "Подтвердить поступление с основанием",
        exact: true,
      }),
    ).toBeDisabled();
    await finance
      .getByLabel(
        "Я проверил(-а) поступление на согласованный счёт и подтверждаю соответствие суммы и плательщика.",
        { exact: true },
      )
      .check();
    await finance
      .getByRole("button", {
        name: "Подтвердить поступление с основанием",
        exact: true,
      })
      .click();
    await finance
      .getByText(
        "Поступление по счёту подтверждено с основанием. Доступ обновлён согласно условиям назначения.",
        { exact: true },
      )
      .waitFor();
    const confirmedInvoice = await (
      await finance.request.get(base + "/api/v1/invoices/" + invoice.id)
    ).json();
    assert.equal(confirmedInvoice.invoice.status, "confirmed");
    assert.equal(confirmedInvoice.invoice.lines.length, 2);
    assert.equal(
      confirmedInvoice.invoice.lines.reduce(
        (total, item) => total + item.amountMinor,
        0,
      ),
      123400,
    );
    const assigned = await (
      await admin.request.get(base + "/api/v1/organizations/" + organization.id)
    ).json();
    assert.ok(
      assigned.enrollments.some(
        (item) =>
          item.userId === fixture.learner.id && item.status === "active",
      ),
    );
    passed(
      "Finance UI requires explicit evidence and confirmation, server confirms synthetic invoice and activates assigned access",
    );
  } else {
    await expect(
      finance.getByText(
        "Выставление счетов пока отключено: учебному центру нужно настроить утверждённые реквизиты. Ранее созданные документы доступны в списке.",
        { exact: true },
      ),
    ).toBeVisible();
    passed(
      "Invoice configuration disabled state is visible and does not claim payment or activation",
    );
  }
  const issuer = await session(users.issuer);
  await go(issuer, "/admin/documents");
  await issuer
    .locator("summary")
    .filter({ hasText: "Добавить бланк документа" })
    .click();
  await issuer.getByLabel(/^Программа/).selectOption("ohrana-truda");
  const templateName = "TEST ONLY browser template " + runId;
  await issuer
    .getByLabel("Название шаблона", { exact: true })
    .fill(templateName);
  await issuer
    .getByLabel("Наименование организации, выдающей документ", { exact: true })
    .fill("TEST ONLY synthetic issuer");
  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage();
  pdfPage.drawText("TEST ONLY - NOT A REAL CREDENTIAL", {
    x: 30,
    y: 800,
    size: 14,
  });
  const names = [
    "learnerName",
    "programTitle",
    "serial",
    "issuedAt",
    "verificationUrl",
    "issuerName",
  ];
  for (const [i, name] of names.entries()) {
    const field = pdf.getForm().createTextField(name);
    field.addToPage(pdfPage, {
      x: 30,
      y: 720 - i * 60,
      width: 500,
      height: 40,
    });
  }
  await issuer.getByLabel("Бланк PDF до 1 МБ", { exact: true }).setInputFiles({
    name: "TEST-ONLY-browser-template.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  for (const [i, label] of [
    "ФИО слушателя",
    "Название программы",
    "Номер документа",
    "Дата выдачи",
    "Ссылка проверки",
    "Наименование издателя",
  ].entries())
    await issuer.getByLabel(label, { exact: true }).fill(names[i]);
  await issuer
    .getByRole("button", { name: "Сохранить шаблон на проверку", exact: true })
    .click();
  await issuer
    .getByText("Шаблон сохранён как черновик.", { exact: false })
    .waitFor();
  await go(reviewer, "/admin/documents");
  const templateCard = reviewer
    .locator("article")
    .filter({ hasText: templateName });
  const previewHref = await templateCard
    .getByRole("link", { name: "Открыть бланк PDF", exact: false })
    .getAttribute("href");
  const preview = await reviewer.request.get(base + previewHref);
  assert.equal(preview.status(), 200);
  assert.ok(preview.headers()["content-type"].includes("application/pdf"));
  await templateCard
    .getByRole("button", { name: "Рассмотреть и утвердить", exact: true })
    .click();
  await reviewer
    .getByLabel("Основание и результаты проверки", { exact: true })
    .fill("Synthetic browser PDF field mapping checked independently");
  await reviewer
    .getByLabel(
      "Я проверил(-а) бланк и соответствие полей, подтверждаю использование для указанной программы.",
      { exact: true },
    )
    .check();
  await reviewer
    .getByRole("button", { name: "Утвердить шаблон", exact: true })
    .click();
  await reviewer.getByText("Шаблон утверждён.", { exact: true }).waitFor();
  passed(
    "Synthetic AcroForm PDF uploads, authorized reviewer previews it and independently approves template",
  );
  await admin.setViewportSize({ width: 360, height: 800 });
  await go(admin, "/cabinet/organization");
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mkdir("artifacts/lms-browser", { recursive: true });
  await admin.screenshot({
    path: "artifacts/lms-browser/organization-360.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  passed(
    "Organization workspace fits 360px and all tested staff screens have no JavaScript errors",
  );
} catch (error) {
  checks.push({
    name: "Staff browser suite",
    status: "failed",
    error: error.stack,
  });
  const failedPage = contexts.at(-1)?.pages().at(-1) || admin || editor;
  if (failedPage) {
    checks.push({
      name: "Failure screen",
      url: failedPage.url(),
      visibleErrors: await failedPage.locator(".lms-error").allTextContents(),
    });
    await failedPage
      .screenshot({
        path: "artifacts/lms-browser/admin-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  }
  throw error;
} finally {
  await mkdir("artifacts/lms-browser", { recursive: true });
  await writeFile(
    "artifacts/lms-browser/admin-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  db.close();
  await browser.close();
}
