import { chainAnswer, circleStatus, RULES_TEXT } from "@/lib/chain-facts";
import { getScore } from "@/lib/score";

const BASE = process.env.NEAR_AI_BASE_URL ?? "https://cloud-api.near.ai/v1";

/** Read-only tools. There is deliberately no tool that signs or sends a transaction. */
const TOOLS = [
  { type: "function", function: { name: "circle_status", description: "Read the live status, rules, members, current round and deadline of a circle from the NEAR testnet contract.", parameters: { type: "object", properties: { circle: { type: "integer" } }, required: ["circle"] } } },
  { type: "function", function: { name: "rules_text", description: "Plain-language rules for missed payments, slashing, safety pot and credentials.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "member_score", description: "Cowrie Score and inputs for a testnet account.", parameters: { type: "object", properties: { account: { type: "string" } }, required: ["account"] } } },
];

async function runTool(name: string, args: Record<string, unknown>, circle: number) {
  if (name === "circle_status") return await circleStatus(Number(args.circle ?? circle));
  if (name === "rules_text") return RULES_TEXT;
  if (name === "member_score") return await getScore(String(args.account));
  return { error: "unknown tool" };
}

const SYSTEM = "You are the Cowrie circle secretary. Answer ONLY from tool output; if the tools do not contain the answer, say you do not know. You are read-only: refuse any request to send, move, pay, join, settle or change anything, and say the user must do that in their wallet. Be brief and give amounts as returned by the tools.";

export type Mode = "model" | "rules";
export async function ask(circle: number, question: string): Promise<{ answer: string; mode: Mode; model?: string; note?: string }> {
  const key = process.env.NEAR_AI_API_KEY;
  if (key) {
    try {
      const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
      // The model is chosen at runtime from the provider's list, never hard-coded.
      let model = process.env.NEAR_AI_MODEL;
      if (!model) {
        const ms = await (await fetch(`${BASE}/models`, { headers, signal: AbortSignal.timeout(8000) })).json();
        model = ms.data?.[0]?.id;
      }
      if (!model) throw new Error("no model available");
      const messages: Array<Record<string, unknown>> = [{ role: "system", content: SYSTEM }, { role: "user", content: `Circle ${circle}. ${question}` }];
      for (let step = 0; step < 4; step++) {
        const r = await fetch(`${BASE}/chat/completions`, { method: "POST", headers, signal: AbortSignal.timeout(20000), body: JSON.stringify({ model, messages, tools: TOOLS, temperature: 0 }) });
        if (!r.ok) throw new Error(`model api ${r.status}`);
        const m = (await r.json()).choices?.[0]?.message;
        if (!m) throw new Error("empty model reply");
        if (!m.tool_calls?.length) return { answer: String(m.content ?? "").trim(), mode: "model", model };
        messages.push(m);
        for (const tc of m.tool_calls) {
          let out: unknown;
          try { out = await runTool(tc.function.name, JSON.parse(tc.function.arguments || "{}"), circle); } catch (e) { out = { error: String(e) }; }
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        }
      }
      throw new Error("too many tool steps");
    } catch (e) {
      return { answer: await chainAnswer(circle, question), mode: "rules", note: "Model mode failed; answered by the rules-based secretary." };
    }
  }
  return { answer: await chainAnswer(circle, question), mode: "rules", note: "Model mode is off (no NEAR AI Cloud key on this deployment)." };
}
