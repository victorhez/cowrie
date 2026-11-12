import { CircleJ, DEPLOY, usdc, view } from "@/lib/near";

/** Read-only facts about a circle, taken from the testnet contract. No function here can move funds. */
export async function circleStatus(id: number) {
  const c = await view<CircleJ | null>(DEPLOY.circle!, "get_circle", { circle: id });
  if (!c) return null;
  const cur = c.rounds.find((r) => !r.settled) ?? null;
  const now = Math.floor(Date.now() / 1000);
  const paid = new Set((cur?.paid ?? []).map((p) => p[0]));
  return {
    id: c.id, name: c.name, status: c.status,
    seats: `${c.members.length}/${c.params.members}`,
    contributionUsdc: usdc(c.params.contribution),
    rules: { periodSecs: c.params.period_secs, graceSecs: c.params.grace_secs, collateralPct: c.params.collateral_pct, safetyPotBps: c.params.reserve_bps },
    roundsSettled: c.rounds.filter((r) => r.settled).length,
    currentRound: cur && { number: cur.index + 1, dueInSecs: cur.due_at - now, recipient: c.order[cur.index] ?? null, paid: [...paid], notPaid: c.members.filter((m) => !paid.has(m.id) && !m.removed).map((m) => m.id) },
    members: c.members.map((m) => ({ id: m.id, defaults: m.defaults, onTime: m.on_time, collateralUsdc: usdc(m.collateral), received: m.received, removed: m.removed })),
    safetyPotUsdc: usdc(c.reserve),
    ledgerBalances: BigInt(c.ledger_in) >= BigInt(c.ledger_out),
  };
}

export const RULES_TEXT = "If a member misses a payment, after the deadline plus the grace period anyone can settle the round. The member's prepaid balance is used first, then locked collateral, then the safety pot, and the recipient is still paid. A default is recorded on the credential. Two defaults before being paid remove the member's turn. Anyone who settles earns a small tip. On finish, collateral and leftover safety pot are returned and non-transferable credentials are minted.";

/** Rules-based answer from chain facts (the default and the fallback when no model is available). */
export async function chainAnswer(id: number, question: string): Promise<string> {
  const s = await circleStatus(id);
  if (!s) return `Circle ${id} does not exist.`;
  const q = question.toLowerCase();
  const short = (a: string) => a.split(".")[0];
  const r = s.currentRound;
  if (/miss|late|default|what happens|slash/.test(q)) return RULES_TEXT;
  if (/turn|next|recipient|who (gets|receives)/.test(q)) return r ? `Round ${r.number}: the recipient is ${r.recipient ? short(r.recipient) : "not set yet"}.` : `The circle is ${s.status}; no round is pending.`;
  if (/not paid|unpaid|owe|yet to pay|hasn'?t paid|outstanding/.test(q)) return r ? (r.notPaid.length ? `Not yet paid in round ${r.number}: ${r.notPaid.map(short).join(", ")}.` : `Everyone has paid in round ${r.number}.`) : "No round is pending.";
  if (/who.*paid/.test(q)) return r ? (r.paid.length ? `Paid in round ${r.number}: ${r.paid.map(short).join(", ")}.` : `Nobody has paid in round ${r.number} yet.`) : "No round is pending.";
  if (/deadline|due|when|time left/.test(q)) return r ? (r.dueInSecs > 0 ? `Round ${r.number} is due in ${r.dueInSecs}s, then a ${s.rules.graceSecs}s grace period.` : `Round ${r.number} is past its deadline.`) : "No round is pending.";
  if (/contribut|how much.*pay/.test(q)) return `Each member pays ${s.contributionUsdc} mock-usdc per round.`;
  if (/safety|reserve/.test(q)) return `The safety pot holds ${s.safetyPotUsdc} mock-usdc.`;
  return `Circle ${s.id} "${s.name}" is ${s.status}, ${s.seats} seats, ${s.roundsSettled} rounds settled. Ask who is next, who has not paid, the deadline, or what happens if a payment is missed.`;
}
