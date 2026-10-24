import { test, expect } from "@playwright/test";
import { offline, samplePortfolio, watchErrors } from "./helpers/app.mjs";

test.describe.configure({ mode: "serial" });
let page, w;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  w = watchErrors(page);
  await offline(page);
  await samplePortfolio(page);
  const pid = await page.evaluate(() => PER.projects.find((p) => p.name === "Civils & Systems").id);
  await page.evaluate((pid) => portOpen(pid), pid);
  await page.waitForFunction(() => PER.loaded && !PER.busy);
});
test.afterAll(() => w.check());

test("the CPM engine reproduces every saved forecast date", async () => {
  const diff = await page.evaluate(() => {
    const st = bFromSet(M.live, M.dd), res = bCompute(st), by = new Map([...M.live.acts.values()].map((a) => [a.proj + "|" + a.code, a]));
    let n = 0;
    st.acts.forEach((x) => { const r = res.R.get(x.id), a = by.get(st.projects.find((p) => p.id === x.proj).short + "|" + x.code); if (!a || !r || r.status === "cp") return;
      const fa = dayOf(a.f), fb = x.type === "start" ? r.es : r.ef, fa2 = a.type === "TT_FinMile" && a.f % DAY <= 8 * HR ? fa - 1 : fa; if (fa2 !== fb) n++; });
    return n;
  });
  expect(diff).toBe(0);
});

test("writing an unchanged update keeps the XER tables", async () => {
  const r = await page.evaluate(() => {
    const st = bModelState(); st.finMsAm = true; const res = bCompute(st), src = S.files.filter((f) => f.role === "live"), out = updPatch(st, res, src);
    return src.map((f, i) => Object.keys(f.tables).filter((k) => (out[i].tables[k] || []).length !== f.tables[k].length));
  });
  expect(r).toEqual([[], []]);
});

test("quality frameworks all run", async () => {
  for (const k of ["dcma", "aace"]) {
    const n = await page.evaluate((k) => runQuality(k).length, k);
    expect(n).toBe(k === "dcma" ? 14 : 25);
  }
});

test("an in-app update saves as the next period with resources carried", async () => {
  const pid = await page.evaluate(() => PER.loaded.pid);
  await page.evaluate((pid) => updStart(pid), pid);
  await page.fill("#udDD", "2026-11-16");
  await page.check("[name=udP][value=plan]");
  await page.click(".pdlg [data-ok]");
  await page.waitForFunction(() => B.st && B.st.upd && S.tab === "build");
  await page.click('[data-ua="save"]');
  await page.click(".pdlg [data-ok]");
  await page.waitForFunction(() => S.tab === "per" && !PER.busy, null, { timeout: 30000 });
  const last = await page.evaluate(() => { const p = PER.periods[PER.periods.length - 1]; return { label: p.label, n: PER.periods.length }; });
  expect(last).toEqual({ label: "Update 10 · 16 Nov 2026", n: 7 });
  const rsrc = await page.evaluate(() => S.files.filter((f) => f.role === "live").map((f) => (f.tables.TASKRSRC || []).length));
  expect(rsrc.every((n) => n > 0)).toBe(true);
});
