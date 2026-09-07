import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { createClient } from "@libsql/client";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3101";
if (!/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local test server required");
const fixture = JSON.parse(
  await readFile(process.env.OT_E2E_FIXTURE_PATH || new URL("../.data/e2e-fixture.json", import.meta.url), "utf8"),
);
assert.equal(fixture.notice, "SYNTHETIC LOCAL TEST DATA ONLY");
assert.ok(fixture.databasePath.endsWith("e2e.sqlite"));
const db = createClient({
  url: "file:" + fixture.databasePath.replaceAll("\\", "/"),
});
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const checks = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const email = `auth-ui-${Date.now()}@example.test`;
const password = "Synthetic-ui-password-2026!";
const newPassword = "Synthetic-new-password-2026!";
const passed = (name) => {
  checks.push({ name, status: "passed" });
  console.log("PASS", name);
};
async function go(path) {
  await page.goto(path.startsWith("http") ? path : base + path, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#__nuxt")?.__vue_app__),
  );
}
async function queuedLink(purpose) {
  const user = (
    await db.execute({
      sql: 'SELECT id,emailVerified FROM "user" WHERE email=?',
      args: [email],
    })
  ).rows[0];
  assert.ok(user, "Synthetic signup was persisted");
  const rows = (
    await db.execute({
      sql: "SELECT payload_json FROM outbox WHERE type=? AND aggregate_id=? ORDER BY created_at DESC",
      args: ["auth.email", user.id],
    })
  ).rows;
  const payload = rows
    .map((row) => JSON.parse(row.payload_json))
    .find((body) => body.purpose === purpose);
  assert.ok(payload, "Required message was durably queued");
  const url = payload.text.match(/https?:\/\/\S+/)?.[0];
  assert.ok(
    url && new URL(url).origin === base,
    "Queued token URL remains local",
  );
  return url;
}
function totp(uri) {
  const secret = new URL(uri).searchParams
    .get("secret")
    .toUpperCase()
    .replace(/=+$/, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret)
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function login(pass, target = "/cabinet") {
  await go("/auth/login?returnTo=" + encodeURIComponent(target));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Пароль/).fill(pass);
  await page
    .getByRole("button", { name: "Вход в личный кабинет", exact: true })
    .click();
}
try {
  await go("/auth/signup?returnTo=%2Fcabinet%2Fsecurity");
  await page
    .getByLabel("Имя и фамилия", { exact: true })
    .fill("TEST ONLY Browser Identity");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Пароль/).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page.getByText("Аккаунт создан.", { exact: false }).waitFor();
  assert.equal(
    Number(
      (
        await db.execute({
          sql: 'SELECT emailVerified FROM "user" WHERE email=?',
          args: [email],
        })
      ).rows[0].emailVerified,
    ),
    0,
  );
  passed(
    "Signup form creates unverified synthetic account and honestly reports queued email",
  );
  await go(await queuedLink("email_verification"));
  assert.equal(
    Number(
      (
        await db.execute({
          sql: 'SELECT emailVerified FROM "user" WHERE email=?',
          args: [email],
        })
      ).rows[0].emailVerified,
    ),
    1,
  );
  passed(
    "Actual queued verification link verifies account and returns to localized app",
  );
  await login(password, "/cabinet/security");
  await page.waitForURL(/\/cabinet\/security$/);
  await page.getByLabel("Текущий пароль", { exact: true }).fill(password);
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
  const me = await (await page.request.get(base + "/api/v1/me")).json();
  assert.equal(me.user.twoFactorEnabled, true);
  assert.equal(me.user.mfaVerified, true);
  passed("MFA setup uses real TOTP and marks the verified session");
  await go("/cabinet");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL(/\/auth\/login$/);
  await login(password);
  await page.waitForURL(/\/auth\/mfa/);
  await page.getByLabel("Код подтверждения", { exact: true }).fill(totp(uri));
  await page
    .getByRole("button", { name: "Подтверждение входа", exact: true })
    .click();
  await page.waitForURL(/\/cabinet$/);
  passed("Subsequent login requires the MFA challenge and resumes the cabinet");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL(/\/auth\/login$/);
  await go("/auth/forgot");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Восстановление доступа", exact: true })
    .click();
  await page.getByText("Запрос принят.", { exact: false }).waitFor();
  await go(await queuedLink("password_reset"));
  await page.getByLabel(/^Пароль/).fill(newPassword);
  await page.getByRole("button", { name: "Новый пароль", exact: true }).click();
  await page
    .getByText("Пароль изменён. Войдите с новым паролем.", { exact: true })
    .waitFor();
  await login(newPassword);
  await page.waitForURL(/\/auth\/mfa/);
  await page.getByLabel("Код подтверждения", { exact: true }).fill(totp(uri));
  await page
    .getByRole("button", { name: "Подтверждение входа", exact: true })
    .click();
  await page.waitForURL(/\/cabinet$/);
  passed("Actual password-reset link changes credentials and retains MFA");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  passed(
    "390px authenticated identity flow has no overflow or browser JavaScript errors",
  );
} catch (error) {
  checks.push({
    name: "Identity browser suite",
    status: "failed",
    error: error.stack,
  });
  throw error;
} finally {
  await mkdir("artifacts/lms-browser", { recursive: true });
  await writeFile(
    "artifacts/lms-browser/auth-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  db.close();
  await browser.close();
}
