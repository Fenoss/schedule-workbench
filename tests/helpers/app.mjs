import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
export const STANDALONE = new URL("../../dist/workbench.html", import.meta.url).href;
export const HOSTED = new URL("../../site/index.html", import.meta.url).href;
export const MOCK = fileURLToPath(new URL("./mock-supabase.js", import.meta.url));
// Fails the test on any script error. Network errors (fonts, CDNs) are ignored: tests run offline.
export function watchErrors(page) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  return { check: () => expect(errs, "script errors").toEqual([]) };
}
export async function offline(page) {
  await page.goto(STANDALONE);
  await page.click("#authOff");
  await page.waitForFunction(() => typeof PER !== "undefined" && PER.mode === "local");
}
export async function samplePortfolio(page) {
  await page.click('[data-po="sample"]');
  await page.waitForFunction(() => !PER.busy && PER.projects.length >= 8 && PER.projects.every((p) => p.summary), null, { timeout: 90000 });
}
export async function hostedAs(page, user, role, setup = "") {
  await page.route("**/config.js", (r) => r.fulfill({ body: "window.SW_CONFIG={supabaseUrl:'https://abc.supabase.co',supabaseAnonKey:'sb_publishable_x',ai:true};", contentType: "application/javascript" }));
  await page.addInitScript({ path: MOCK });
  await page.goto(HOSTED);
  await page.evaluate(({ user, role, setup }) => { eval(setup); __mock.setUser(user, role); PER.sb.auth._cb("SIGNED_IN", { user: { id: user.id, email: user.email } }); }, { user, role, setup });
  await page.waitForFunction(() => PER.mode === "supa");
}
