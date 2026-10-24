// Downloads every file in the "xer" storage bucket into the folder given on the command line.
// Used by the nightly backup workflow. Needs SUPABASE_URL and SECRET_KEY in the environment.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
const out = process.argv[2] || "xer";
const sb = createClient(process.env.SUPABASE_URL, process.env.SECRET_KEY, { auth: { persistSession: false } });
async function walk(prefix) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from("xer").list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const e of data) { const p = prefix ? `${prefix}/${e.name}` : e.name; if (e.id) files.push(p); else files.push(...await walk(p)); }
    if (data.length < 1000) break;
  }
  return files;
}
const files = await walk("");
let n = 0;
for (const p of files) {
  const { data, error } = await sb.storage.from("xer").download(p);
  if (error) throw error;
  const dest = join(out, p); await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await data.arrayBuffer())); n++;
}
console.log(`Copied ${n} files.`);
