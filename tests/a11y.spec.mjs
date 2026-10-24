import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { offline } from "./helpers/app.mjs";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

test("no serious colour-contrast problems on the main tabs", async ({ page }) => {
  await offline(page);
  await page.addScriptTag({ content: AXE });
  for (const t of ["dash", "gantt", "dq", "per", "port"]) {
    await page.evaluate((t) => setTab(t), t);
    await page.waitForTimeout(200);
    const bad = await page.evaluate(() => axe.run(document, { runOnly: ["color-contrast"] }).then((r) => r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))));
    expect(bad, t).toEqual([]);
  }
});
