/**
 * Cowrie secretary, rules-based mode.
 *
 * Read-only by construction: it takes a circle snapshot and returns text.
 * It has no reference to any function that changes a circle. The NEAR AI Cloud
 * mode (pending) wraps the same read-only facts in a language model.
 */
import { Circle, currentRound, canSettle, collateralRequired } from "./circle";

export const fmt = (units: number) => (units / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
const short = (id: string) => id.split(".")[0];

function findMember(c: Circle, q: string): string | null {
  const lower = q.toLowerCase();
  for (const m of c.members) if (lower.includes(short(m.id).toLowerCase())) return m.id;
  for (const e of c.events) if (e.kind === "seat_transferred" && lower.includes(short(String(e.to)).toLowerCase())) return String(e.to);
  return null;
}

export function answer(c: Circle, question: string, now: number): string {
  const q = question.toLowerCase();
  const r = currentRound(c);
  const who = findMember(c, q);
  const C = c.params.contribution;

  if (/(miss|skip|forget|late|fail|don'?t pay|not pay).*(pay|contribut)|what happens if/.test(q) && !who) {
    const col = collateralRequired(c.params, 0);
    return `If you miss a payment, after the deadline plus ${c.params.graceSecs}s grace anyone can settle the round. Your autopay balance is used first, then your locked collateral (up to ${fmt(C)} USDC per missed round, you have ${fmt(col)} locked at the start), then the safety pot. The recipient is still paid. A default is recorded on your credential. After two defaults you lose your turn if you have not been paid yet.`;
  }
  if (/(whose|who'?s|who is|who gets|next).*(turn|next|recipient|pot|payout|receive)|who receives|who is next/.test(q)) {
    if (c.status === "completed") return "The circle is complete. Every eligible member has received their payout.";
    if (!r) return "No round is pending.";
    const next = c.order.find((id, i) => i >= r.index && !c.members.find((m) => m.id === id)!.received && !c.members.find((m) => m.id === id)!.removed);
    return `Round ${r.index + 1} of ${c.params.members}: the recipient is ${next ? short(next) : "nobody (all remaining members were removed)"}.`;
  }
  if (/(who|which).*(not paid|unpaid|ha(ve|sn)'?t paid|yet to pay|owe|pending|outstanding)|not paid yet/.test(q) || /(who).*(paid)/.test(q)) {
    if (!r) return "No round is pending.";
    const unpaid = c.members.filter((m) => !r.paid[m.id]).map((m) => short(m.id));
    if (/who.*paid/.test(q) && !/not|n't|nt paid|yet/.test(q)) {
      const paid = c.members.filter((m) => r.paid[m.id]).map((m) => short(m.id));
      return paid.length ? `Paid in round ${r.index + 1}: ${paid.join(", ")}.` : `Nobody has paid in round ${r.index + 1} yet.`;
    }
    return unpaid.length ? `Not yet paid in round ${r.index + 1}: ${unpaid.join(", ")}.` : `Everyone has paid in round ${r.index + 1}. Anyone can settle it now.`;
  }
  if (!/(safety|reserve)/.test(q) && /(how much|what).*(pot|payout|receive)|size of the pot|pot size/.test(q)) {
    const net = c.params.members * C - Math.floor((c.params.members * C * c.params.reserveBps) / 10000);
    return `A full pot is ${fmt(net)} USDC (${c.params.members} x ${fmt(C)} minus the ${(c.params.reserveBps / 100).toFixed(1)}% safety-pot share).`;
  }
  if (/(how much|what).*(contribut|pay each|per round|due)|contribution/.test(q)) {
    return `Each member pays ${fmt(C)} USDC per round, every ${c.params.periodSecs}s in this demo.`;
  }
  if (/(deadline|due|time left|when|how long)/.test(q)) {
    if (!r) return "No round is pending.";
    const left = Math.max(0, r.dueAt - now);
    return left > 0 ? `Round ${r.index + 1} is due in ${left}s. After that there is a ${c.params.graceSecs}s grace period.` : canSettle(c, now) ? `Round ${r.index + 1} is past its deadline and grace period: anyone can settle it now.` : `Round ${r.index + 1} is in its grace period.`;
  }
  if (/collateral/.test(q)) {
    if (who) {
      const m = c.members.find((x) => x.id === who)!;
      return `${short(who)} has ${fmt(m.collateral)} USDC collateral locked.`;
    }
    return `Collateral at join is ${c.params.collateralPct}% of what you could owe: ${fmt(collateralRequired(c.params, 0))} USDC. Members with ${c.params.minCredentials}+ credentials get ${c.params.discountPct}% off.`;
  }
  if (/(safety pot|reserve)/.test(q)) {
    return `The safety pot holds ${fmt(c.reserve)} USDC. It covers shortfalls after collateral and pays settler tips; whatever is left is returned equally at the end.`;
  }
  if (/default/.test(q)) {
    if (who) {
      const m = c.members.find((x) => x.id === who)!;
      return `${short(who)} has ${m.defaults} default${m.defaults === 1 ? "" : "s"}${m.removed ? " and has been removed from future payouts" : ""}.`;
    }
    const d = c.members.filter((m) => m.defaults > 0).map((m) => `${short(m.id)} (${m.defaults})`);
    return d.length ? `Defaults so far: ${d.join(", ")}.` : "No defaults so far.";
  }
  if (/(received|got paid|has .* been paid)/.test(q) && who) {
    const m = c.members.find((x) => x.id === who)!;
    return m.received ? `${short(who)} has already received their payout.` : `${short(who)} has not received their payout yet.`;
  }
  if (/(status|state|round|progress)/.test(q)) {
    if (c.status === "completed") return "The circle is complete.";
    return `The circle is ${c.status}. ${r ? `Round ${r.index + 1} of ${c.params.members}.` : ""}`;
  }
  if (/(move|send|withdraw|transfer|take).*(fund|money|usdc)|can you (pay|send)/.test(q)) {
    return "I cannot move funds. I only read the circle's public state. Payments always come from you, signed in your wallet.";
  }
  return "I can answer: whose turn it is, who has not paid, the deadline, what happens if you miss a payment, collateral, the safety pot, and defaults.";
}
