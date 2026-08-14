// ═══════════════════════════════════════════════════════════════════
// ALP — AI client
//
// Both AI features used to call api.anthropic.com directly from the
// browser. They now go through the ai-assist Edge Function, which holds
// the API key. Nothing here needs a credential: the Supabase client
// attaches the signed-in user's JWT, and the function checks it.
//
// Drop-in for App.jsx:
//
//   import { suggestGoals, askAlpAi } from "./ai.js";
//
//   // AIGoalGenerator.generate()
//   const goals = await suggestGoals({ grade, disability, domain, baseline, context });
//
//   // AIChatWidget.send()
//   const reply = await askAlpAi(history);
// ═══════════════════════════════════════════════════════════════════

import { supabase } from "./supabase.js";

/** Thrown with a message that is already safe and useful to show a user. */
export class AiUnavailable extends Error {}

async function invoke(payload) {
  if (!supabase) {
    throw new AiUnavailable("AI features need a connected account. Ask your administrator to finish setup.");
  }

  const { data, error } = await supabase.functions.invoke("ai-assist", { body: payload });

  if (error) {
    // FunctionsHttpError carries the response; our function always
    // replies with a { error } string written for a teacher to read.
    let msg = null;
    try { msg = (await error.context?.json?.())?.error; } catch { /* not JSON */ }
    throw new AiUnavailable(msg || "Could not reach the AI service. Check your connection and try again.");
  }
  if (data?.error) throw new AiUnavailable(data.error);
  return data?.text ?? "";
}

/**
 * Suggest three SMART goals.
 *
 * The student's name is deliberately NOT a parameter. The old client
 * sent it to Anthropic on every generation and never needed to — the
 * template returns a [Name] placeholder, which the caller substitutes
 * locally. Keep it that way: it is less data leaving your systems for
 * no loss of quality.
 */
export async function suggestGoals({ grade, disability, domain, baseline, context } = {}) {
  const text = await invoke({ mode: "goals", grade, disability, domain, baseline, context });

  // The model is asked for bare JSON but may still wrap it in prose or
  // a code fence, so pull out the array rather than trusting the shape.
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new AiUnavailable("The AI returned something unexpected. Try again.");

  let parsed;
  try { parsed = JSON.parse(match[0]); }
  catch { throw new AiUnavailable("The AI returned something unexpected. Try again."); }
  if (!Array.isArray(parsed)) throw new AiUnavailable("The AI returned something unexpected. Try again.");

  return parsed;
}

/** Substitute the real name into a suggested goal, in the browser. */
export function personaliseGoal(goalText, studentName) {
  if (!studentName) return goalText;
  return String(goalText).replace(/\[Name\]/g, studentName);
}

/**
 * One assistant turn. `history` is [{ role, content }] — the caller
 * keeps the conversation; the function caps it at the last 10 turns.
 */
export async function askAlpAi(history) {
  const messages = (history || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: String(m.content) }));
  return invoke({ mode: "chat", messages });
}
