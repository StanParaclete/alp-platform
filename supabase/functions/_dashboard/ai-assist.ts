// ═══════════════════════════════════════════════════════════════════
// ai-assist — for the Supabase Dashboard editor
//
// No local imports, so this is byte-identical to
// supabase/functions/ai-assist/index.ts. Copied here only so both
// paste-ready functions sit in one place.
//
// Deploy: Edge Functions → Deploy a new function → Via Editor →
//         name it exactly "ai-assist" → paste this → Deploy.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ALP — AI assist
//
// Replaces two calls that App.jsx made from the browser straight to
// api.anthropic.com with `Content-Type` as their only header. No
// credential was ever sent, so in production both return 401 and the
// "AI Goal Suggestions" feature advertised on the landing page does
// nothing. It only ever appeared to work in a preview environment that
// injected a key.
//
// The obvious fix — VITE_ANTHROPIC_API_KEY — is worse than the bug.
// Vite inlines VITE_* at build time, so the key ships inside the JS
// bundle and anyone can read it out of devtools and spend against your
// account. The key has to live somewhere the browser cannot reach, and
// that is here.
//
// Deploy:
//   supabase functions deploy ai-assist
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://growwithalp.com,https://www.growwithalp.com,http://localhost:3000")
  .split(",").map((o) => o.trim());

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(headers: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ── Rate limiting ─────────────────────────────────────────────────
// An authenticated endpoint that spends money on every call needs a
// ceiling. Without one, a single compromised teacher login — or a
// retry loop in the client — becomes an unbounded invoice.
//
// In-memory per isolate: coarse, resets on cold start, and good enough
// to stop runaway loops and casual abuse. If you need a hard guarantee
// across isolates, move the counter into Postgres.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();   // crude guard against unbounded growth
  return recent.length > MAX_PER_WINDOW;
}

// ── Prompts ───────────────────────────────────────────────────────
// Kept server-side so the wording cannot be edited by the client. A
// browser-supplied system prompt is a jailbreak surface: the caller
// could otherwise repurpose your Anthropic spend for anything.
const SYSTEM = {
  goals:
    "You are an expert learning-support consultant helping teachers write SMART annual goals. " +
    "Goals must be Specific, Measurable, Achievable, Relevant and Time-bound, and must always " +
    "state a measurement method. Write in plain language families can understand. " +
    "Return ONLY valid JSON with no explanation.",
  chat:
    "You are ALP AI — a warm, expert assistant for teachers using the ALP (Accelerated Learning " +
    "Plan) platform. Help with SMART goals, present levels, intervention strategies, plan " +
    "sections and planning questions. Be concise (under 120 words), use bullet points for lists " +
    "and be encouraging. Avoid regulatory or legal language. Give practical, teacher-friendly advice.",
};

const MAX_TOKENS = { goals: 1600, chat: 500 };

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json(headers, { error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      // Explicit rather than a confusing upstream 401.
      return json(headers, {
        error: "AI features are not configured. Ask your administrator to set ANTHROPIC_API_KEY.",
      }, 503);
    }

    // ── Caller must be a signed-in user of this project ───────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(headers, { error: "Sign in to use AI features" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json(headers, { error: "Sign in to use AI features" }, 401);

    if (rateLimited(user.id)) {
      return json(headers, {
        error: "That's a lot of requests at once. Wait a minute and try again.",
      }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "chat" ? "chat" : "goals";

    // ── Build the user turn from structured input only ────────────
    // The client sends fields, never a finished prompt.
    let messages: Array<{ role: string; content: string }>;

    if (mode === "goals") {
      const { grade, disability, domain, baseline, context } = body ?? {};

      // PII minimisation. The old client sent the student's real name
      // to Anthropic on every generation; it was never needed — the
      // goal template uses a [Name] placeholder the client fills in
      // locally. Sending less is both safer and cheaper.
      messages = [{
        role: "user",
        content:
          `Write 3 different SMART annual goals for a learner.\n` +
          `Grade: ${String(grade ?? "K-12").slice(0, 40)}\n` +
          `Learning needs: ${String(disability ?? "additional learning needs").slice(0, 120)}\n` +
          `Domain: ${String(domain ?? "reading").replace(/_/g, " ").slice(0, 60)}\n` +
          `Current baseline: ${String(baseline ?? "below grade level").slice(0, 200)}\n` +
          (context ? `Additional context: ${String(context).slice(0, 500)}\n` : "") +
          `\nRefer to the learner as [Name] throughout — do not invent a name.\n` +
          `Return ONLY this JSON array:\n` +
          `[{"goalText":"By <date>, [Name] will <observable behaviour> in <conditions> with ` +
          `<accuracy/frequency>, as measured by <method>.","baseline":"current level",` +
          `"target":"specific endpoint","monitoring":"Weekly","domain":"${String(domain ?? "reading").slice(0, 60)}"}]`,
      }];
    } else {
      const turns = Array.isArray(body?.messages) ? body.messages : [];
      // Cap history: cost scales with it, and an unbounded array from
      // the client is a way to force an expensive request.
      messages = turns.slice(-10)
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (messages.length === 0) return json(headers, { error: "Nothing to send" }, 400);
      if (messages[0].role !== "user") messages.shift();   // Anthropic requires a user turn first
      if (messages.length === 0) return json(headers, { error: "Nothing to send" }, 400);
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,              // never leaves this function
        "anthropic-version": "2023-06-01", // required; the old client omitted it
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: MAX_TOKENS[mode],
        system: SYSTEM[mode],
        messages,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("anthropic error", upstream.status, detail.slice(0, 400));
      // Don't forward upstream error bodies — they can contain account
      // and billing details the browser has no business seeing.
      return json(headers, {
        error: upstream.status === 429
          ? "The AI service is busy. Try again shortly."
          : "The AI service could not be reached. Try again shortly.",
      }, upstream.status === 429 ? 429 : 502);
    }

    const data = await upstream.json();
    const text = data?.content?.[0]?.text ?? "";
    return json(headers, { text });

  } catch (err) {
    console.error("ai-assist", err);
    return json(headers, { error: "Something went wrong. Try again." }, 500);
  }
});
