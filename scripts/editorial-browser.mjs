import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3102";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("Local verification only");
const out = "artifacts/editorial";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const report = { checks: [], errors: [], screenshots: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
async function ready(route) {
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded" });
  if (response.status() >= 400)
    throw new Error(route + ": HTTP " + response.status());
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#__nuxt")?.__vue_app__),
  );
  await page.evaluate(() => document.fonts.ready);
}
async function screenshot(name, fullPage = true) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  report.screenshots.push(name);
}
async function fit(name) {
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    heading: document.querySelector("h1")?.textContent,
    fonts:
      document.fonts.check('16px "OT Sans"') &&
      document.fonts.check('48px "OT Display"'),
  }));
  expect(geometry.scroll, name + " horizontal overflow").toBeLessThanOrEqual(
    geometry.width + 1,
  );
  expect(geometry.fonts).toBe(true);
  report.checks.push({ name, ...geometry });
}
try {
  if (!process.argv.includes("--extras-only")) {
    for (const locale of ["", "/kk"]) {
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
        await ready(locale || "/");
        await fit(`home ${locale || "ru"} ${width}x${height}`);
        if ([390, 820, 1440, 1920].includes(width))
          await screenshot(
            `home-${locale ? "kk" : "ru"}-${width}`,
            width === 390,
          );
        if (width === 390)
          await screenshot(`cover-${locale ? "kk" : "ru"}-390`, false);
      }
    }
    for (const route of [
      "/courses",
      "/courses/ohrana-truda",
      "/program-selection",
      "/auth/login",
      "/cabinet",
      "/b2b",
      "/almaty",
      "/ui-kit",
      "/kk/courses",
      "/kk/ui-kit",
    ]) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        await ready(route);
        await fit(route + " " + width);
        await screenshot(
          route.replaceAll("/", "-").replace(/^-/, "") + "-" + width,
          true,
        );
      }
    }
  }
  await ready("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await expect(page.locator("#editorial-menu")).toBeVisible();
  await fit("mobile menu open");
  await screenshot("menu-390");
  await page
    .locator("#editorial-menu")
    .getByRole("link", { name: "Весь каталог", exact: false })
    .click();
  await expect(page.locator("#editorial-menu")).not.toBeVisible();
  report.checks.push({ name: "mobile navigation closes after route change" });
  await ready("/courses");
  await page.getByRole("searchbox").fill("xxxxxxxx-no-program");
  await expect(
    page.getByText("По выбранным условиям программ не найдено.", {
      exact: false,
    }),
  ).toBeVisible();
  report.checks.push({ name: "catalog empty search state" });
  await ready("/ui-kit");
  await page.getByRole("button", { name: "Открыть диалог" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть диалог" }),
  ).toBeFocused();
  report.checks.push({ name: "dialog Escape and focus restoration" });
  await page.getByLabel("Email", { exact: true }).fill("reader@example.test");
  await page.getByLabel("Второй вариант ответа").check();
  for (const [width, height] of [
    [360, 800],
    [820, 820],
    [844, 390],
    [390, 460],
  ]) {
    await page.setViewportSize({ width, height });
    await fit(`input preservation ${width}x${height}`);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "reader@example.test",
    );
    await expect(page.getByLabel("Второй вариант ответа")).toBeChecked();
  }
  await page.getByLabel("Показать состояние").selectOption("conflict");
  await expect(page.getByRole("alert")).toContainText("Конфликт");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await fit("200 percent root font size");
  await screenshot("ui-kit-text-200");
  report.checks.push({
    name: "form and selected answer survive resizing, landscape and reduced viewport height",
  });
  await ready("/program-selection?city=almaty&format=onsite");
  await expect(page.locator("#city-select")).toHaveValue("almaty");
  await page.locator("#city-select").selectOption("astana");
  await expect(page).toHaveURL(/program-selection.*city=astana/);
  expect(new URL(page.url()).searchParams.get("format")).toBe("onsite");
  report.checks.push({
    name: "city switch retains selection route and format query",
  });
  await ready("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Содержание страницы", { exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Разделы страницы" }),
  ).toBeVisible();
  await fit("compact contents open");
  await screenshot("contents-390");
  await page.route("**/images/editorial/**", (route) => route.abort());
  await ready("/");
  await expect(page.locator(".ed-cover--fallback")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Подобрать обучение", exact: true }),
  ).toBeVisible();
  await screenshot("cover-image-unavailable", false);
  await page.unroute("**/images/editorial/**");
  report.checks.push({
    name: "cover remains readable and actionable without image",
  });
  // A 1440x1000 browser at 200% zoom has a 720x500 CSS viewport and DPR 2.
  // CSS `zoom` alone does not update media queries and is not equivalent.
  const zoomContext = await browser.newContext({
    viewport: { width: 720, height: 500 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const zoomPage = await zoomContext.newPage();
  for (const route of ["/", "/ui-kit"]) {
    await zoomPage.goto(base + route, { waitUntil: "networkidle" });
    await zoomPage.evaluate(() => document.fonts.ready);
    const size = await zoomPage.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      dpr: devicePixelRatio,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
    const name = (route === "/" ? "home" : "ui-kit") + "-zoom-200";
    await zoomPage.screenshot({ path: `${out}/${name}.png` });
    report.screenshots.push(name);
    report.checks.push({
      name: "200 percent browser zoom equivalent: " + route,
      ...size,
    });
  }
  await zoomContext.close();
  expect(report.errors).toEqual([]);
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await writeFile(
    `${out}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        checks: report.checks.length,
        errors: report.errors,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
