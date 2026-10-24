import { test, expect } from "@playwright/test";
import { offline, samplePortfolio, watchErrors, hostedAs } from "./helpers/app.mjs";

test("programme dashboard, narrative and exports", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await samplePortfolio(page);
  // add a narrative to the latest update of one project
  const pid = await page.evaluate(() => PER.projects.find((p) => p.name === "Civils & Systems").id);
  await page.evaluate((pid) => { perPick(pid); setTab("per"); }, pid);
  await page.waitForFunction(() => PER.periods.length === 6);
  await page.click(".pitem [data-pnar]");
  await page.fill('[data-nar="changed"]', "Viaduct deck resequenced");
  await page.fill('[data-nar="risks"]', "OLE possession not confirmed");
  await page.click(".pdlg [data-ok]");
  await expect.poll(() => page.evaluate(() => PER.periods[PER.periods.length - 1].narrative.risks)).toBe("OLE possession not confirmed");
  await expect(page.locator("#perMain")).toContainText("Cost performance");
  await expect(page.locator("#perMain")).toContainText("Schedule quality");
  // programme dashboard
  await page.evaluate(() => setTab("port"));
  const gid = await page.evaluate(() => PER.programmes.find((g) => g.code === "NXR").id);
  await page.click(`[data-pd="open"][data-id="${gid}"]`);
  await expect(page.locator("#pdBody")).toContainText("Forecast finish by project");
  await expect(page.locator("#pdBody")).toContainText("OLE possession not confirmed");
  // export falls back to CSV offline (no CDN in tests) or produces xlsx when available
  const dl = page.waitForEvent("download");
  await page.click('[data-pd="xls"]');
  const f = await dl;
  expect(f.suggestedFilename()).toMatch(/Northgate Express Rail programme .*\.(xlsx|csv)$/);
  await page.click('[data-pd="back"]');
  await expect(page.locator(".portlist")).toBeVisible();
  w.check();
});

test("phone shows an activity list instead of the Gantt chart", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await offline(page);
  await page.evaluate(() => setTab("gantt"));
  await expect(page.locator("#mList")).toBeVisible();
  expect(await page.locator("#mList .ml-i").count()).toBeGreaterThan(20);
  await expect(page.locator("#ganttWrap")).toBeHidden();
});

test("company admin sees the set-up checklist", async ({ page }) => {
  await hostedAs(page, { id: "u-b", email: "boss@first.com", name: "Boss", company_id: "co-a" }, "admin", "__DB.companies.push({id:'co-a',name:'My company',status:'active',branding:{}})");
  await page.evaluate(() => setTab("port"));
  await expect(page.locator(".setup")).toContainText("0 of 6 done");
  await page.click('.setup [data-su="co-brand"]');
  await expect(page.locator("#admBody")).toContainText("Branding");
});
