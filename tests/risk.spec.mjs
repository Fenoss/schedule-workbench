import { test, expect } from "@playwright/test";
import { offline, hostedAs, watchErrors } from "./helpers/app.mjs";

async function riskSample(page) {
  await page.click("#appSw");
  await page.click('[data-app="risk"]');
  await expect(page.locator(".top .bname")).toContainText("Risk");
  await page.click('#riskWrap [data-rk="sample"]');
  await page.waitForFunction(() => RK.risks.length >= 28 && !PER.busy, null, { timeout: 30000 });
}

test("risk workbench: switch, sample registers, roll-up and filters", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await riskSample(page);
  // every portfolio, programme and project register is reachable, parents roll up their children
  const s = await page.evaluate(() => ({
    levels: [...new Set(RK.risks.map((r) => r.level))].sort(),
    parents: RK.risks.filter((r) => r.parentId).length,
    ifc: RK.risks.filter(rkIsIfc).length,
    p1: (() => { const p = RK.risks.find((r) => r.ref === "PF-R001"); return Math.round(rkEV(p, false, "cost")) === Math.round(rkKids(p).filter(rkLive).reduce((n, k) => n + rkEV(k, false, "cost"), 0)); })(),
  }));
  expect(s.levels).toEqual(["portfolio", "programme", "project"]);
  expect(s.parents).toBeGreaterThanOrEqual(10);
  expect(s.ifc).toBe(3);
  expect(s.p1).toBe(true);
  // a square on the matrix filters the register
  await page.locator("#riskWrap .rk-hc.has").first().click();
  await expect(page.locator('#rkNav [data-rkt="reg"]')).toHaveAttribute("aria-selected", "true");
  const n = await page.locator("#riskWrap .rk-reg tbody tr[data-rid]").count();
  expect(n).toBeGreaterThan(0);
  // a project register shows only that project's risks plus interface risks that include it
  await page.evaluate(() => { const p = PER.projects.find((x) => x.code === "HLM-TS"); rkSetScope({ lv: "project", id: p.id }); RK.cell = null; rkRender(); });
  const refs = await page.locator("#riskWrap .rk-reg tbody .rk-ref").allTextContents();
  expect(refs.every((r) => r.startsWith("HLM-TS") || r === "HLM-R001")).toBe(true);
  for (const t of ["over", "tree", "ifc", "resp"]) { await page.click(`#rkNav [data-rkt="${t}"]`); await page.waitForTimeout(80); }
  // back to the schedule workbench
  await page.click("#appSw"); await page.click('[data-app="schedule"]');
  await expect(page.locator(".top .bname")).toContainText("Schedule");
  await expect(page.locator("#riskWrap")).toBeHidden();
  w.check();
});

test("risk editor: add, assess, plan a response, escalate", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await riskSample(page);
  await page.evaluate(() => { const p = PER.projects.find((x) => x.code === "WSQ-A"); rkSetScope({ lv: "project", id: p.id }); });
  await page.click('#riskWrap [data-rk="new"]');
  await page.fill('#rkSheet [data-e="title"]', "Crane oversail licence refused");
  await page.click('#rkSheet [data-rket="ass"]');
  await page.selectOption('#rkSheet [data-e="d.q.pre.p"]', "4");
  await page.selectOption('#rkSheet [data-e="d.q.pre.i.time"]', "4");
  await page.click('#rkSheet [data-rket="qt"]');
  await page.fill('#rkSheet [data-e="d.qt.p"]', "40");
  await page.fill('#rkSheet [data-e="d.qt.cost.min"]', "100000");
  await page.fill('#rkSheet [data-e="d.qt.cost.ml"]', "400000");
  await page.fill('#rkSheet [data-e="d.qt.cost.max"]', "1000000");
  await page.click('#rkSheet [data-rket="ass"]');
  await page.click('#rkSheet [data-rke="suggest"]');
  await page.click('#rkSheet [data-rket="resp"]');
  await page.click('#rkSheet [data-rkstrat="reduce"]');
  await page.click('#rkSheet [data-rke="addact"]');
  await page.fill('#rkSheet [data-ai="0.t"]', "Agree oversail with the neighbour");
  await page.click('#rkSheet [data-rke="save"]');
  await page.waitForFunction(() => RK.risks.some((r) => r.title === "Crane oversail licence refused"));
  const r = await page.evaluate(() => { const r = RK.risks.find((x) => x.title === "Crane oversail licence refused"); return { ref: r.ref, pre: rkQS(r, "pre"), cur: rkQS(r, "cur"), ev: Math.round(rkEV(r, false, "cost")), acts: r.d.actions.length, strat: r.d.resp.strat }; });
  expect(r).toEqual({ ref: "WSQ-A-R004", pre: 16, cur: 9, ev: 200000, acts: 1, strat: "reduce" });
  // escalate it to the programme: a parent is created and the risk is linked to it
  await page.evaluate(() => rkEscalate(RK.risks.find((x) => x.title === "Crane oversail licence refused"), "programme"));
  await page.waitForFunction(() => { const r = RK.risks.find((x) => x.title === "Crane oversail licence refused"); const p = r && rkById(r.parentId); return p && p.level === "programme" && p.d.qt.fromKids; });
  await page.keyboard.press("Escape");
  w.check();
});

test("admin chooses the register format: tiered columns follow the level", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await riskSample(page);
  await page.click('#riskWrap [data-rk="cfg"]');
  await page.check('#rkCfg input[value="tiered"]');
  await page.click('#rkCfg [data-rkc="lv"][data-k="project"]');
  await page.click('#rkCfg [data-rkc="rm"][data-k="owner"]');
  await page.click('#rkCfg [data-rkc="add"][data-k="cost3"]');
  await page.click('#rkCfg [data-rkc="save"]');
  await expect(page.locator("#rkCfgM")).toHaveCount(0);
  await page.evaluate(() => { const p = PER.projects.find((x) => x.code === "WSQ-A"); rkSetScope({ lv: "project", id: p.id }); rkGo("reg"); });
  const head = await page.locator("#riskWrap .rk-reg thead").textContent();
  expect(head).toContain("Cost min / likely / max");
  expect(head).not.toContain("Owner");
  await page.evaluate(() => { rkSetScope({ lv: "portfolio" }); });
  expect(await page.locator("#riskWrap .rk-reg thead").textContent()).toContain("Owner");
  w.check();
});

test("hosted: company admin configures risk registers and a contributor adds a risk", async ({ page }) => {
  const w = watchErrors(page);
  await hostedAs(page, { id: "u-b", email: "boss@first.com", name: "Boss", company_id: "co-a" }, "admin", "__DB.companies.push({id:'co-a',name:'First Co',status:'active',branding:{}})");
  await page.click("#userChip");
  await page.click('#userMenu [data-um="users"]');
  await page.click('[data-adm="co-risk"]');
  await page.check('#rkCfg input[value="cascade"]');
  await page.click('#rkCfg [data-rkc="save"]');
  await expect.poll(() => page.evaluate(() => (__DB.company_settings.find((s) => s.company_id === "co-a") || {}).risk?.align)).toBe("cascade");
  await page.click("#appSw"); await page.click('[data-app="risk"]');
  await page.click('#riskWrap [data-rk="new"]');
  await page.fill('#rkSheet [data-e="title"]', "Portfolio funding approval late");
  await page.click('#rkSheet [data-rke="save"]');
  await expect.poll(() => page.evaluate(() => (__DB.risks || []).map((r) => r.ref + " " + r.level))).toEqual(["PF-R001 portfolio"]);
  w.check();
});
