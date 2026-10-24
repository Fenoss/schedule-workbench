// Builds the single-file app from src/.
//   node build.mjs           writes site/index.html (hosted, loads config.js) and dist/workbench.html (standalone)
//   node build.mjs --check   fails if site/index.html is out of date (used in CI)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
const rd = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const js = readdirSync(new URL("src/js/", import.meta.url)).filter((f) => f.endsWith(".js")).sort().map((f) => rd("src/js/" + f)).join("");
const page = rd("src/head.html") + "<style>\n" + rd("src/styles.css") + "</style>\n" + rd("src/body.html") + "<script>\n" + js + "</script>\n" + rd("src/tail.html");
const hosted = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + page.replace("\n<script>\n", '\n<script src="config.js"></script>\n<script>\n');
if (process.argv.includes("--check")) {
  const cur = existsSync(new URL("site/index.html", import.meta.url)) ? rd("site/index.html") : "";
  if (cur !== hosted) { console.error("site/index.html is out of date: run node build.mjs and commit."); process.exit(1); }
  console.log("site/index.html is up to date.");
} else {
  mkdirSync(new URL("dist/", import.meta.url), { recursive: true });
  writeFileSync(new URL("site/index.html", import.meta.url), hosted);
  writeFileSync(new URL("dist/workbench.html", import.meta.url), page);
  console.log(`Built site/index.html and dist/workbench.html (${(page.length / 1024).toFixed(0)} KB).`);
}
