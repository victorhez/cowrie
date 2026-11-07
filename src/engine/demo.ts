import {
  Circle, createCircle, defaultParams, join, start, contribute, settle, finish, currentRound, canSettle,
} from "./circle";

export const DEMO_NAMES = ["ada", "bola", "chidi", "dayo", "efe"];
export const demoId = (n: string) => `${n}.testnet`;

export function newDemo(): Circle {
  const c = createCircle("lagos-traders", demoId("ada"), defaultParams({
    members: 5, contribution: 100_000_000, periodSecs: 120, graceSecs: 30,
    collateralPct: 100, reserveBps: 200, tipCap: 1_000_000,
  }), 11);
  for (const n of DEMO_NAMES) join(c, demoId(n), 0);
  start(c, 0);
  return c;
}

/**
 * Plays the next step of the demo: members pay, one member (dayo) misses round 3,
 * the round settles, and the circle finishes after the last round.
 * Returns a short human description of what happened.
 */
export function stepDemo(c: Circle, nowRef: { t: number }): string {
  if (c.status === "completed") return "Circle already complete.";
  const r = currentRound(c);
  if (!r) {
    finish(c, nowRef.t);
    return "Circle finished: collateral and leftover safety pot returned, credentials minted.";
  }
  const skip = r.index === 2 ? demoId("dayo") : null;
  for (const m of c.members) if (m.id !== skip && !r.paid[m.id]) contribute(c, m.id, r.index, c.params.contribution, nowRef.t);
  if (skip) {
    nowRef.t = r.dueAt + c.params.graceSecs + 1;
  } else nowRef.t = Math.max(nowRef.t, r.dueAt - 10);
  if (!canSettle(c, nowRef.t)) nowRef.t = r.dueAt + c.params.graceSecs + 1;
  const res = settle(c, "keeper.testnet", nowRef.t);
  return skip
    ? `Round ${r.index + 1}: dayo missed the deadline. Anyone settled it, dayo's collateral was slashed, and ${res.recipient?.split(".")[0]} was still paid in full.`
    : `Round ${r.index + 1}: everyone paid. ${res.recipient?.split(".")[0]} received the pot.`;
}
