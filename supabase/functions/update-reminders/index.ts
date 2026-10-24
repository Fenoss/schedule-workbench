// Schedule Workbench: weekly "updates due" reminder emails (Supabase Edge Function).
// Called weekly by a pg_cron job with the x-reminder-key header; the key lives in the database vault (see schema.sql).
// Sends through Resend when RESEND_API_KEY and REMINDER_FROM are set; otherwise returns what it would send.
// Secrets: RESEND_API_KEY, REMINDER_FROM (e.g. "Schedule Workbench <updates@yourdomain.com>"), SITE_URL.
import { createClient } from "jsr:@supabase/supabase-js@2";

function pick(envName: string, legacy: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(envName) ?? "{}");
    if (keys && typeof keys.default === "string") return keys.default;
    const first = keys && Object.values(keys).find((v) => typeof v === "string");
    if (first) return first as string;
  } catch { /* fall through */ }
  return Deno.env.get(legacy) ?? "";
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b, null, 1), { status, headers: { "content-type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const DAY = 86400000;

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, pick("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const given = req.headers.get("x-reminder-key") ?? "";
  const { data: okKey } = await sb.rpc("check_reminder_key", { k: given });
  if (!given || okKey !== true) return json({ error: "Not allowed." }, 403);
  const [{ data: cos }, { data: sets }, { data: projs }, { data: admins }] = await Promise.all([
    sb.from("companies").select("id, name, status").eq("status", "active"),
    sb.from("company_settings").select("company_id, site"),
    sb.from("projects").select("id, name, code, manager, status, space, company_id, last_dd, created_at, summary").eq("status", "active").eq("space", "team"),
    sb.from("profiles").select("email, name, company_id").eq("role", "admin"),
  ]);
  const site = new Map((sets ?? []).map((s: any) => [s.company_id, s.site ?? {}]));
  const now = Date.now(), out: Record<string, { to: string; company: string; items: any[] }> = {};
  for (const c of cos ?? []) {
    const s: any = site.get(c.id) ?? {};
    if (s.reminders === false) continue;
    const cycle = Math.max(7, Math.min(120, Number(s.cycle) || 35));
    const due = (projs ?? []).filter((p: any) => p.company_id === c.id).map((p: any) => {
      const last = p.last_dd != null ? Number(p.last_dd) : null, age = Math.floor((now - (last ?? Date.parse(p.created_at))) / DAY);
      return { ...p, age, never: last == null };
    }).filter((p: any) => p.age > cycle);
    if (!due.length) continue;
    const add = (email: string, items: any[]) => { if (!email || !items.length) return; const k = c.id + "|" + email.toLowerCase(); (out[k] ??= { to: email, company: c.name, items: [] }).items.push(...items.filter((i) => !out[k].items.includes(i))); };
    (admins ?? []).filter((a: any) => a.company_id === c.id).forEach((a: any) => add(a.email, due));
    due.forEach((p: any) => { const m = /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.exec(p.manager || ""); if (m) add(m[0], [p]); });
  }
  const mails = Object.values(out), site_url = Deno.env.get("SITE_URL") ?? "", resend = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("REMINDER_FROM");
  if (!resend || !from) return json({ dryRun: true, reason: "Set RESEND_API_KEY and REMINDER_FROM to send.", mails: mails.map((m) => ({ to: m.to, company: m.company, projects: m.items.map((i) => i.name) })) });
  const results = [];
  for (const m of mails) {
    const rows = m.items.map((p) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${esc(p.name)}</b>${p.code ? ` <span style="color:#666">${esc(p.code)}</span>` : ""}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${p.never ? "No update saved yet" : `Last update ${p.age} days ago${p.summary?.label ? ` (${esc(p.summary.label)})` : ""}`}</td></tr>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><p>These ${m.company ? esc(m.company) + " " : ""}projects are due a schedule update:</p><table style="border-collapse:collapse">${rows}</table>${site_url ? `<p><a href="${esc(site_url)}">Open Schedule Workbench</a> and choose Update on the project, or upload the latest XER files.</p>` : ""}<p style="color:#888;font-size:12px">Sent weekly while updates are due. Company admins can change the update cycle or switch reminders off under Admin → Features.</p></div>`;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resend}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [m.to], subject: `${m.items.length} schedule update${m.items.length === 1 ? "" : "s"} due${m.company ? " · " + m.company : ""}`, html }) });
    results.push({ to: m.to, ok: r.ok, status: r.status });
  }
  return json({ sent: results });
});
