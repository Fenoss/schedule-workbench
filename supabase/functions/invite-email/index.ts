// Schedule Workbench: email an invitation (Supabase Edge Function).
// The page first saves the invitation row (the database checks the caller may invite to that company),
// then calls this function to send the sign-in email. Deploy with --no-verify-jwt: it checks the caller itself.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
function pick(envName: string, legacy: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(envName) ?? "{}");
    if (keys && typeof keys.default === "string") return keys.default;
    const first = keys && Object.values(keys).find((v) => typeof v === "string");
    if (first) return first as string;
  } catch { /* fall through */ }
  return Deno.env.get(legacy) ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, pub = pick("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), secret = pick("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const asCaller = createClient(url, pub, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "Sign in again." }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ error: "Body must be JSON." }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase(), redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "That isn't an email address." }, 400);
  // The caller must be able to see an invitation for this email: the access rules only show invitations to admins of that company (or owners).
  const { data: inv } = await asCaller.from("invitations").select("id, company_id, role, accepted_at").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!inv) return json({ error: "No invitation for that email that you can send." }, 403);
  if (!secret) return json({ error: "The invite service isn't configured (no service key)." }, 503);
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: co } = await admin.from("companies").select("name").eq("id", inv.company_id).maybeSingle();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { invited_to: co?.name ?? "" } });
  if (!error) return json({ sent: "invite" });
  // Already has an account: send a magic sign-in link instead.
  if (/already|registered|exists/i.test(error.message)) {
    const anon = createClient(url, pub, { auth: { persistSession: false } });
    const r = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
    if (!r.error) return json({ sent: "magiclink" });
    return json({ error: r.error.message }, 502);
  }
  return json({ error: error.message }, /rate/i.test(error.message) ? 429 : 502);
});
