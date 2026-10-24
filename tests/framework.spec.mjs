import { test, expect } from "@playwright/test";
import { offline, hostedAs, watchErrors } from "./helpers/app.mjs";

async function toFramework(page) { await page.click("#appSw"); await page.click('[data-app="frame"]'); await expect(page.locator(".top .bname")).toContainText("Framework"); }

test("framework: standard structures feed the risk workbench, and conformance reads the open schedule", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await toFramework(page);
  await page.click('#fwNav [data-fwt="str"]');
  await page.click('#fwWrap [data-fw="std"]');
  await page.waitForFunction(() => FW.structs.length >= 6 && !PER.busy);
  // the RBS top level becomes the risk categories, the OBS gives owners
  const r = await page.evaluate(() => ({ cats: rkCfg().cats.length, fromRbs: !!rkCfg().catsFromRbs, obs: fwObsNames().includes("Interface Manager") }));
  expect(r).toEqual({ cats: 11, fromRbs: true, obs: true });
  // edit the WBS: add a top-level item, indent it, save
  await page.click('#fwWrap [data-fwsid]:has-text("Standard WBS")');
  await page.click('#fwWrap [data-fwop="addtop"]');
  await page.locator('#fwWrap [data-fwnf="name"]').last().fill("Archaeology");
  await page.locator("#fwWrap .fw-n").last().hover();
  await page.locator('#fwWrap .fw-n').last().locator('[data-fwop="in"]').click();
  await page.click('#fwWrap [data-fw="ssave"]');
  await page.waitForFunction(() => { const s = FW.structs.find((x) => x.name === "Standard WBS"); const n = s && s.data.nodes.find((x) => x.name === "Archaeology"); return n && s.data.nodes.find((x) => x.id === n.p).code === "KD"; });
  // build a WBS from the open sample schedule and check conformance
  await page.click('#fwNav [data-fwt="conf"]');
  await expect(page.locator("#fwWrap .fw-cc").first()).toBeVisible();
  const titles = await page.locator("#fwWrap .fw-cc h3").allTextContents();
  expect(titles.some((t) => t.includes("Schedule WBS"))).toBe(true);
  expect(titles.some((t) => t.includes("Activity code “Discipline”"))).toBe(true);
  await page.click('#fwWrap [data-fw="mkcode"][data-fwt2="Location"]');
  await page.waitForFunction(() => FW.structs.some((s) => s.kind === "code" && s.name === "Location"));
  w.check();
});

test("framework: portfolio attributes, import and the interface register", async ({ page }) => {
  const w = watchErrors(page);
  await offline(page);
  await toFramework(page);
  await page.click('#fwNav [data-fwt="str"]'); await page.click('#fwWrap [data-fw="std"]'); await page.waitForFunction(() => FW.structs.length >= 6 && !PER.busy);
  // import programmes and projects from CSV
  await page.click('#fwNav [data-fwt="port"]');
  const csv = "Programme,Programme code,Project,Project code,Manager,Status,Sector,Contract type\nCoastal Flood Defences,CFD,Seawall north,CFD-N,A. Patel,Active,Water,NEC4 ECC C\nCoastal Flood Defences,CFD,Seawall south,CFD-S,B. Lee,Planned,Water,NEC4 ECC A\n";
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('#fwWrap [data-fw="import"]')]);
  await fc.setFiles({ name: "portfolio.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.click(".modal [data-ok]");
  await page.waitForFunction(() => PER.projects.filter((p) => /^CFD-/.test(p.code)).length === 2 && !PER.busy);
  const p = await page.evaluate(() => { const x = PER.projects.find((p) => p.code === "CFD-S"); return [x.status, x.attrs.sector, x.attrs.contract, (PER.programmes.find((g) => g.id === x.programmeId) || {}).code]; });
  expect(p).toEqual(["planned", "Water", "NEC4 ECC A", "CFD"]);
  // edit a project's attribute in the form
  await page.click('#fwWrap [data-fwsel^="proj:"]:has-text("Seawall north")');
  await page.fill('#fwWrap [data-fwattr="bac"]', "12500000");
  await page.click('#fwWrap .fw-form button.primary');
  await page.waitForFunction(() => PER.projects.find((p) => p.code === "CFD-N").attrs.bac === 12500000);
  // add an interface between the two new projects and see it offered on risks
  await page.click('#fwNav [data-fwt="ifc"]');
  await page.click('#fwWrap [data-fwi="add"]');
  await page.locator('#fwWrap [data-fwik="code"]').last().fill("IF-CFD-01");
  await page.locator('#fwWrap [data-fwik="title"]').last().fill("North wall tie-in to south wall");
  const ids = await page.evaluate(() => PER.projects.filter((p) => /^CFD-/.test(p.code)).sort((a, b) => a.code.localeCompare(b.code)).map((p) => p.id));
  await page.locator('#fwWrap [data-fwik="g"]').last().selectOption(ids[0]);
  await page.locator('#fwWrap [data-fwik="r"]').last().selectOption(ids[1]);
  await page.click('#fwWrap [data-fwi="save"]');
  await page.waitForFunction(() => fwIfcItems().some((x) => x.code === "IF-CFD-01" && x.g && x.r));
  w.check();
});

test("hosted: structures are saved per company", async ({ page }) => {
  const w = watchErrors(page);
  await hostedAs(page, { id: "u-b", email: "boss@first.com", name: "Boss", company_id: "co-a" }, "admin", "__DB.companies.push({id:'co-a',name:'First Co',status:'active',branding:{}})");
  await toFramework(page);
  await page.click('#fwNav [data-fwt="str"]'); await page.click('#fwWrap [data-fw="std"]');
  await expect.poll(() => page.evaluate(() => (__DB.structures || []).map((s) => s.kind).sort().join(","))).toBe("attrs,cbs,code,obs,rbs,wbs");
  w.check();
});
