/**
 * Generates test vectors from the TypeScript reference engine.
 * The Rust contract engine replays them (contracts/circle/tests/vectors.rs) and must
 * reach identical payouts, recipients, balances and ledgers. Deterministic: same output every run.
 *
 * Usage: npm run vectors
 */
import fs from "node:fs";
import path from "node:path";
import {
  createCircle, defaultParams, join, start, contribute, prepay, settle, finish, currentRound, transferSeat, collateralRequired,
} from "../src/engine/circle.ts";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNT = Number(process.argv[2] ?? 300);
const vectors: unknown[] = [];

for (let k = 0; k < COUNT; k++) {
  const r = mulberry(1000 + k);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const n = 2 + Math.floor(r() * 11); // 2..12
  const params = defaultParams({
    members: n,
    contribution: 1000 + Math.floor(r() * 500) * 1000,
    collateralPct: pick([0, 50, 100]) as 0 | 50 | 100,
    reserveBps: pick([0, 100, 200, 300, 1000]),
    tipCap: pick([0, 500, 100_000]),
    orderMode: pick(["creator", "random"]) as "creator" | "random",
    periodSecs: 100,
    graceSecs: 10,
    minCredentials: pick([0, 1, 2]),
    discountPct: pick([0, 25, 50]),
  });
  const seed = Math.floor(r() * 4_000_000_000);
  const c = createCircle("v", "m0", params, seed);
  const ops: Record<string, unknown>[] = [];
  const ids = Array.from({ length: n }, (_, i) => `m${i}`);
  for (const id of ids) {
    const creds = pick([0, 0, 1, 2]);
    join(c, id, 0, creds);
    ops.push({ op: "join", id, credentials: creds });
  }
  for (const id of ids) if (r() < 0.3) {
    const amt = Math.floor(r() * params.contribution * 3) + 1;
    prepay(c, id, amt, 0);
    ops.push({ op: "prepay", id, amount: amt });
  }
  let order: string[] | undefined;
  if (params.orderMode === "creator" && r() < 0.5) {
    order = [...ids].sort(() => r() - 0.5);
  }
  const given = order ? [...order] : null; // engine keeps a reference and later mutates it on seat transfer
  start(c, 0, order ? [...order] : undefined);
  ops.push({ op: "start", now: 0, order: given });

  const dp = pick([0, 0.05, 0.2, 0.5, 0.9]);
  let guard = 0;
  let seatN = 0;
  while (currentRound(c) && guard++ < 100) {
    const rd = currentRound(c)!;
    for (const m of c.members) {
      if (r() > dp) {
        contribute(c, m.id, rd.index, params.contribution, 0);
        ops.push({ op: "contribute", id: m.id, round: rd.index, amount: params.contribution });
      }
    }
    if (r() < 0.1) {
      const from = c.members[Math.floor(r() * c.members.length)].id;
      const to = `new${seatN++}`;
      transferSeat(c, from, to, "m0", 0);
      ops.push({ op: "transfer_seat", from, to, by: "m0" });
    }
    const now = rd.dueAt + params.graceSecs + 1;
    const caller = pick(["keeper", "m1", ""]);
    const res = settle(c, caller, now);
    ops.push({ op: "settle", caller, now, expect: { payout: res.payout, recipient: res.recipient } });
  }
  finish(c, 1e9);
  ops.push({ op: "finish" });

  vectors.push({
    name: `scenario-${k}`,
    params: {
      members: params.members, contribution: params.contribution, period_secs: params.periodSecs, grace_secs: params.graceSecs,
      collateral_pct: params.collateralPct, reserve_bps: params.reserveBps, tip_cap: params.tipCap,
      random_order: params.orderMode === "random", min_credentials: params.minCredentials, discount_pct: params.discountPct,
    },
    seed,
    ops,
    expect: {
      order: c.order,
      ledger_in: c.ledger.in,
      ledger_out: c.ledger.out,
      reserve: c.reserve,
      members: c.members.map((m) => ({
        id: m.id, collateral: m.collateral, prepaid: m.prepaid, defaults: m.defaults, owed: m.owed,
        on_time: m.onTime, received: m.received, removed: m.removed,
      })),
      recipients: c.rounds.map((x) => x.recipient),
      payouts: c.rounds.map((x) => x.payout),
    },
  });
}
void collateralRequired;
const out = path.resolve("contracts/circle/tests/vectors.json");
fs.writeFileSync(out, JSON.stringify({ generated_by: "tools/gen-vectors.ts", engine: "src/engine/circle.ts", count: vectors.length, vectors }));
console.log(`wrote ${vectors.length} vectors to ${out}`);
