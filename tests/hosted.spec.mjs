import { test, expect } from "@playwright/test";
import { hostedAs, watchErrors } from "./helpers/app.mjs";
const OWNER = { id: "u-a", email: "owner@x.com", name: "Owner", company_id: "co-a", is_owner: true };
const SETUP = "__DB.companies.push({id:'co-a',name:'First Co',status:'active',branding:{}}); __DB.profiles.push({id:'u-z',email:'zed@new.com',name:'Zed',role:'pending',company_id:null,is_owner:false,created_at:new Date().toISOString()})";

test("owner creates a company, invites its admin and places people", async ({ page }) => {
  const w = watchErrors(page);
  await hostedAs(page, OWNER, "admin", SETUP);
  await expect(page.locator("#tabAdmin")).toBeVisible();
  await page.click("#tabAdmin");
  await page.click('[data-adm="wb-companies"]');
  await page.fill('[data-admform="newco"] [name=name]', "Acme Build");
  await page.fill('[data-admform="newco"] [name=admin]', "ann@acme.com");
  await page.click('[data-admform="newco"] button');
  await expect.poll(() => page.evaluate(() => __DB.invitations.map((i) => i.email + ":" + i.role))).toEqual(["ann@acme.com:admin"]);
  expect(await page.evaluate(() => (window.__fn || []).map((f) => f[0]))).toEqual(["invite-email"]);
  const acme = await page.evaluate(() => __DB.companies.find((c) => c.name === "Acme Build").id);
  await page.click('[data-adm="wb-people"]');
  await page.selectOption('[data-coco="u-z"]', acme);
  await expect.poll(() => page.evaluate(() => __DB.profiles.find((p) => p.id === "u-z").company_id)).toBe(acme);
  w.check();
});

test("company admin sets branding and switches AI off", async ({ page }) => {
  const w = watchErrors(page);
  await hostedAs(page, { id: "u-b", email: "boss@first.com", name: "Boss", company_id: "co-a" }, "admin", SETUP);
  await page.click("#tabAdmin");
  await expect(page.locator('[data-adm="wb-overview"]')).toHaveCount(0);
  await page.click('[data-adm="co-brand"]');
  await page.fill('[data-admform="brand"] [name=title]', "First Controls");
  await page.click('[data-admform="brand"] button.primary');
  await expect(page.locator(".top .brand")).toContainText("First Controls");
  await page.click('[data-adm="co-features"]');
  await page.uncheck('[data-admform="features"] [name=ai]');
  await page.click('[data-admform="features"] button');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("no-ai"))).toBe(true);
  w.check();
});

test("someone with no company is told to ask for an invitation", async ({ page }) => {
  await page.route("**/config.js", (r) => r.fulfill({ body: "window.SW_CONFIG={supabaseUrl:'https://abc.supabase.co',supabaseAnonKey:'sb_publishable_x'};", contentType: "application/javascript" }));
  await page.addInitScript({ path: (await import("./helpers/app.mjs")).MOCK });
  await page.goto((await import("./helpers/app.mjs")).HOSTED);
  await page.evaluate(() => { __mock.setUser({ id: "u-n", email: "new@x.com", name: "New" }, "pending"); __DB.profiles.find((p) => p.id === "u-n").company_id = null; PER.sb.auth._cb("SIGNED_IN", { user: { id: "u-n", email: "new@x.com" } }); });
  await expect(page.locator("#authId")).toContainText("Not part of a company yet");
});
