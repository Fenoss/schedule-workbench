// Schedule Workbench AI proxy (Supabase Edge Function).
// Keeps your Anthropic API key on the server: the web page sends the conversation here,
// this function checks the person is signed in and approved, then streams Claude's reply back.
//
// Deploy:   supabase functions deploy ai-proxy --no-verify-jwt
//           (this function checks the caller's sign-in itself, which works with the new publishable keys)
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional: MODEL_QUICK, MODEL_DEFAULT, MODEL_COMPLEX to choose models; MAX_TOKENS_CAP (default 32000).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELS: Record<string, string> = {
  quick: Deno.env.get("MODEL_QUICK") ?? "claude-haiku-5-5",
  default: Deno.env.get("MODEL_DEFAULT") ?? "claude-sonnet-5-5",
  complex: Deno.env.get("MODEL_COMPLEX") ?? "claude-opus-5-5",
};
const CAP = Number(Deno.env.get("MAX_TOKENS_CAP") ?? 32000);

// The project's public key: the new publishable key if present, otherwise the legacy anon key.
function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (keys && typeof keys.default === "string") return keys.default;
    const first = keys && Object.values(keys).find((v) => typeof v === "string");
    if (first) return first as string;
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function fail(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("bad_request", "Use POST.", 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return fail("sampling_disabled", "AI is not set up: add the ANTHROPIC_API_KEY secret to this function.", 503);

  // Who is calling? Uses the caller's own sign-in token, so the database's access rules apply.
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail("session_expired", "Sign in again to use AI.", 401);
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || prof.role === "pending") return fail("not_granted", "Your account is waiting for an admin to approve it.", 403);

  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request", "Body must be JSON.", 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return fail("bad_request", "messages is required.", 400);

  const payload: Record<string, unknown> = {
    model: MODELS[body.tier] ?? MODELS.default,
    max_tokens: Math.max(256, Math.min(Number(body.max_tokens) || 8000, CAP)),
    messages: body.messages,
    stream: true,
  };
  if (typeof body.system === "string" && body.system) payload.system = body.system;
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    const code = upstream.status === 429 || upstream.status === 529 ? "rate_limited"
      : /prompt is too long|too many tokens|request_too_large/i.test(text) || upstream.status === 413 ? "prompt_too_large"
      : upstream.status === 401 ? "sampling_disabled"
      : "upstream_error";
    console.error("anthropic error", upstream.status, text.slice(0, 500));
    return fail(code, text.slice(0, 400), upstream.status === 401 ? 503 : upstream.status);
  }

  // Pass Claude's server-sent events straight through to the page.
  return new Response(upstream.body, {
    headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
});
