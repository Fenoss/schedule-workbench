import { test, expect } from "@playwright/test";
import { offline, watchErrors } from "./helpers/app.mjs";

// A stand-in for Claude that answers the way the real model is asked to.
async function fakeAi(page) {
  await page.waitForFunction(() => AI.checked);
  await page.evaluate(() => {
    window.__ai = [];
    const fake = async (input, opts) => {
      __ai.push(input);
      if (opts.tools) {
        await opts.tools.find((t) => t.name === "find_risks").execute({ text: "power" });
        await opts.tools.find((t) => t.name === "draft_risks").execute({ risks: [{ title: "TBM spares held offshore", type: "threat", category: "Supply chain", register: "HLM-TS", cause: "spares stock is overseas", event: "a breakdown waits for parts", effect: "tunnelling stops", probability_pct: 30, cost: { min: 100000, likely: 250000, max: 600000 }, days: { min: 5, likely: 12, max: 30 }, scores: { inherent: { p: 3, i: { cost: 2, time: 3 } }, current: { p: 3, i: { cost: 2, time: 3 } }, target: { p: 2, i: { cost: 2, time: 2 } } }, response: { strategy: "reduce", plan: "Hold critical spares on site", actions: [{ action: "List critical spares", owner: "TBM Manager", due_in_days: 10 }] }, rationale: "TBM is on the critical path", confidence: "medium" }] });
        await opts.tools.find((t) => t.name === "propose_changes").execute({ changes: [{ ref: "PF-R004", probability_pct: 33, add_actions: [{ action: "Respond to consultation", owner: "Head of Assurance", due_in_days: 20 }], reason: "consultation closes soon" }, { ref: "NOPE-1", probability_pct: 5 }] });
      }
      const text = "**PF-R001 leads the exposure.** I drafted one risk and proposed one change.";
      opts.onText && opts.onText({ text });
      return { text };
    };
    fake.json = async (p) => {
      __ai.push(p);
      if (/TASK: Identify about/.test(p)) return { summary: "Interfaces and supply chain dominate.", risks: [
        { title: "Late design freeze for station fit-out", type: "threat", category: "Design", register: "HLM-TS", cause: "c", event: "e", effect: "f", probability_pct: 40, cost: { min: 50000, likely: 120000, max: 400000 }, days: { min: 5, likely: 15, max: 40 }, activities: ["ST210"], scores: { inherent: { p: 3, i: { cost: 2, time: 3 } } }, response: { strategy: "reduce", actions: [{ action: "Freeze plan", owner: "Design Manager", due_in_days: 7 }] }, rationale: "r", confidence: "high" },
        { title: "Signalling software assurance takes longer", register: "HLM-RS", category: "Design", probability_pct: 50, duplicate_of: "HLM-RS-R001" },
        { title: "Interface access between tunnels and systems", register: "HLM", category: "Interfaces", interface_projects: ["HLM-TS", "HLM-RS"], probability_pct: 25 }] };
      if (/Quantify this risk for Monte Carlo/.test(p)) return { probability_pct: 45, cost: { min: 100000, likely: 200000, max: 600000 }, days: { min: 5, likely: 10, max: 30 }, distribution: "pert", scores: { current: { p: 3, i: { cost: 2, time: 2 } } }, rationale: "Based on similar risks", assumptions: ["one event"] };
      if (/Propose a response/.test(p)) return { strategy: "transfer", plan: "Insurance", actions: [{ action: "Get a quote", owner: "Commercial", due_in_days: 14 }] };
      if (/"estimates"/.test(p)) { const part = p.split("RISKS TO QUANTIFY")[1] || ""; const refs = [...part.matchAll(/\n([A-Z0-9]+(?:-[A-Z0-9]+)*-R\d{3})\|/g)].map((m) => m[1]); return { estimates: refs.map((ref) => ({ ref, probability_pct: 20, cost: { min: 10000, likely: 20000, max: 50000 }, days: { min: 1, likely: 3, max: 9 }, scores: { current: { p: 2, i: { cost: 1 } } }, rationale: "x" })) }; }
      return {};
    };
    fake.limits = async () => ({ tools: true, images: { maxCount: 5 } });
    AI.sample = fake; AI.tools = true;
  });
}
async function riskSample(page) {
  await page.click("#appSw"); await page.click('[data-app="risk"]');
  await page.click('#riskWrap [data-rk="sample"]');
  await page.waitForFunction(() => RK.risks.length >= 28 && !PER.busy, null, { timeout: 30000 });
}

test("Ask AI drafts risks and proposes changes that the user adds", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page); await fakeAi(page); await riskSample(page);
  await page.click('#riskWrap [data-rk="ai"]');
  await expect(page.locator("#rkAiWrap")).toBeVisible();
  await page.click('#rkAiQuick [data-rkaiq="1"]');
  await expect(page.locator("#rkAiChat .rk-aid")).toHaveCount(2);
  expect(await page.evaluate(() => __ai[0][0].content.includes("REGISTERS") && __ai[0][0].content.includes("PF-R001"))).toBe(true);
  await page.click("#rkAiChat [data-rkdadd]");
  await page.waitForFunction(() => RK.risks.some((r) => r.title === "TBM spares held offshore"));
  await page.click("#rkAiChat [data-rkcapply]");
  await page.waitForFunction(() => { const r = RK.risks.find((x) => x.ref === "PF-R004"); return r && +r.d.qt.p === 33 && r.d.actions.length === 2; });
  const r = await page.evaluate(() => { const r = RK.risks.find((x) => x.title === "TBM spares held offshore"); return { ref: r.ref, level: r.level, ai: r.d.ai.src, cur: rkCurScore(r), acts: r.d.actions.length, strat: r.d.resp.strat }; });
  expect(r).toEqual({ ref: "HLM-TS-R003", level: "project", ai: "chat", cur: 9, acts: 1, strat: "reduce" });
  await page.click('#rkAiChat .ailink');
  await expect(page.locator("#rkSheet")).toBeVisible();
  w.check();
});

test("Identify risks with AI: review, skip duplicates and add", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page); await fakeAi(page); await riskSample(page);
  await page.click('#riskWrap [data-rk="identify"]');
  await page.fill("#rkIdBrief", "8 km driverless metro, four underground stations, NEC4 option C.");
  await page.click('#rkIdM [data-rkid="run"]');
  await expect(page.locator("#rkIdM .rk-idc")).toHaveCount(3);
  await expect(page.locator("#rkIdM .rk-idc").nth(1)).toContainText("may repeat");
  expect(await page.locator('#rkIdM [data-rkidsel="1"]').isChecked()).toBe(false);
  await page.click('#rkIdM [data-rkid="add"]');
  await page.waitForFunction(() => RK.risks.some((r) => r.title === "Interface access between tunnels and systems"));
  const x = await page.evaluate(() => { const a = RK.risks.find((r) => r.title === "Late design freeze for station fit-out"), b = RK.risks.find((r) => r.title === "Interface access between tunnels and systems"); return { a: [a.level, a.d.qt.acts, a.d.ai.src], b: [b.level, rkIfcPids(b).length], dup: RK.risks.filter((r) => r.title === "Signalling software assurance takes longer").length }; });
  expect(x).toEqual({ a: ["project", "ST210", "identify"], b: ["programme", 2], dup: 0 });
  w.check();
});

test("AI in the editor estimates a risk, and bulk quantifies the rest", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page); await fakeAi(page); await riskSample(page);
  await page.click('#riskWrap [data-rk="new"]');
  await page.fill('#rkSheet [data-e="title"]', "Archaeology found in the station box");
  await page.click('#rkSheet [data-rket="qt"]');
  await page.click('#rkSheet [data-rkedai="quant"]');
  await expect(page.locator("#rkSheet .rk-aidiff")).toBeVisible();
  await page.click('#rkSheet [data-rkedai="apply"]');
  await page.click('#rkSheet [data-rket="resp"]');
  await page.click('#rkSheet [data-rkedai="resp"]');
  await page.click('#rkSheet [data-rkedai="apply"]');
  await page.click('#rkSheet [data-rke="save"]');
  await page.waitForFunction(() => RK.risks.some((r) => r.title === "Archaeology found in the station box"));
  const r = await page.evaluate(() => { const r = RK.risks.find((x) => x.title === "Archaeology found in the station box"); return { p: r.d.qt.p, dist: r.d.qt.dist, cur: rkQS(r, "cur"), strat: r.d.resp.strat, acts: r.d.actions.length }; });
  expect(r).toEqual({ p: 45, dist: "pert", cur: 6, strat: "transfer", acts: 1 });
  // bulk: add two unquantified risks then quantify them together
  await page.evaluate(async () => { await rkCreate(Object.assign(rkBlank({ lv: "portfolio" }), { title: "Unquantified A" })); await rkCreate(Object.assign(rkBlank({ lv: "portfolio" }), { title: "Unquantified B" })); });
  await page.click('#rkNav [data-rkt="reg"]');
  await page.click('#riskWrap [data-rk="bq"]');
  await page.click('#rkBqM [data-rkbqa="run"]');
  await expect(page.locator("#rkBqM .rk-bqt tbody tr")).toHaveCount(2);
  await page.click('#rkBqM [data-rkbqa="apply"]');
  await page.waitForFunction(() => RK.risks.filter((r) => /^Unquantified/.test(r.title)).every((r) => +r.d.qt.p === 20 && rkQS(r, "cur") === 2));
  w.check();
});
