import { test, expect } from "@playwright/test";
import { offline, samplePortfolio, watchErrors, STANDALONE, HOSTED } from "./helpers/app.mjs";

test("hosted page is a standards-mode page that fits phones", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await page.route("**/config.js", (r) => r.fulfill({ body: "", contentType: "application/javascript" }));
  await page.goto(HOSTED);
  expect(await page.evaluate(() => document.compatMode)).toBe("CSS1Compat");
  expect(await page.evaluate(() => innerWidth)).toBe(390);
});

test("every tab renders without errors on the sample schedule", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  for (const t of ["dash", "gantt", "tld", "dq", "ifc", "per", "exec", "build", "port"]) {
    await page.evaluate((t) => setTab(t), t);
    await page.waitForTimeout(150);
  }
  w.check();
});

test("phone layout has no sideways scrolling", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await offline(page);
  for (const t of ["dash", "gantt", "dq", "port"]) {
    await page.evaluate((t) => setTab(t), t);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("dashboard figures are not cut off", async ({ page }) => {
  await offline(page);
  await page.evaluate(() => setTab("dash"));
  for (const w of [1440, 1280, 1100]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    const cut = await page.evaluate(() => [...document.querySelectorAll("#dashWrap .sv")].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent));
    expect(cut, `at ${w}px`).toEqual([]);
  }
});

test("sample portfolio builds eight projects with six updates each", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await samplePortfolio(page);
  expect(await page.evaluate(() => PER.projects.map((p) => p.summary.count))).toEqual(Array(8).fill(6));
  w.check();
});
