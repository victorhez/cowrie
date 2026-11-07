import { describe, it, expect } from "vitest";
import {
  createCircle, defaultParams, join, leave, cancel, start, contribute, prepay, settle, finish, cowrieScore,
  collateralRequired, transferSeat, conserved, currentRound, canSettle,
} from "@/engine/circle";
import { startedCircle, expectErr, acct } from "./harness";

const C = 100_000_000;

function payAll(c: ReturnType<typeof startedCircle>, except: number[] = []) {
  const r = currentRound(c)!;
  c.members.forEach((m, i) => { if (!except.includes(i)) contribute(c, m.id, r.index, C, 0); });
  return r;
}

describe("joining and starting", () => {
  it("locks collateral = C x (N-1) x pct", () => {
    const c = createCircle("a", acct(0), defaultParams({ members: 5, collateralPct: 100 }));
    join(c, acct(0), 0);
    expect(c.members[0].collateral).toBe(C * 4);
    const h = createCircle("b", acct(0), defaultParams({ members: 5, collateralPct: 50 }));
    join(h, acct(0), 0);
    expect(h.members[0].collateral).toBe(C * 2);
  });
  it("credentialed members get a discount", () => {
    const p = defaultParams({ members: 5, collateralPct: 100, discountPct: 50, minCredentials: 1 });
    expect(collateralRequired(p, 0)).toBe(C * 4);
    expect(collateralRequired(p, 1)).toBe(C * 2);
  });
  it("rejects duplicates, overfill and early start", () => {
    const c = createCircle("a", acct(0), defaultParams({ members: 2 }));
    join(c, acct(0), 0);
    expectErr(() => join(c, acct(0), 0), "already_member");
    expectErr(() => start(c, 0), "not_full");
    join(c, acct(1), 0);
    expectErr(() => join(c, acct(2), 0), "full");
  });
  it("a member can leave before start with a full refund", () => {
    const c = createCircle("a", acct(0), defaultParams({ members: 3 }));
    join(c, acct(0), 0); join(c, acct(1), 0);
    leave(c, acct(1), 1);
    expect(c.members.length).toBe(1);
    expect(conserved(c)).toBe(true);
  });
  it("creator can cancel before start only", () => {
    const c = createCircle("a", acct(0), defaultParams({ members: 3 }));
    join(c, acct(0), 0);
    expectErr(() => cancel(c, acct(1), 0), "creator_only");
    cancel(c, acct(0), 0);
    expect(c.status).toBe("cancelled");
    expect(c.ledger.in).toBe(c.ledger.out);
  });
  it("random order is deterministic for a seed and a permutation", () => {
    const a = startedCircle({ orderMode: "random" }, 42);
    const b = startedCircle({ orderMode: "random" }, 42);
    expect(a.order).toEqual(b.order);
    expect([...a.order].sort()).toEqual([0, 1, 2, 3, 4].map(acct).sort());
  });
});

describe("a clean circle", () => {
  it("pays every member the full pot exactly once and returns everything", () => {
    const c = startedCircle({ reserveBps: 0 });
    for (let k = 0; k < 5; k++) {
      const r = payAll(c);
      const out = settle(c, "any", 1);
      expect(out.payout).toBe(C * 5);
      expect(out.recipient).toBe(c.order[k]);
      expect(r.settled).toBe(true);
    }
    finish(c, 10);
    expect(c.ledger.in).toBe(c.ledger.out);
    expect(c.credentials).toHaveLength(5);
    expect(c.credentials.every((x) => x.defaults === 0 && x.onTime === 5)).toBe(true);
  });
  it("reserve share is skimmed from each contribution and returned at finish", () => {
    const c = startedCircle({ reserveBps: 200 });
    payAll(c);
    expect(c.reserve).toBe(5 * Math.floor((C * 200) / 10000));
    const out = settle(c, "any", 1);
    expect(out.payout).toBe(5 * C - c.reserve);
    expect(c.events.some((e) => e.kind === "tip")).toBe(false); // on-time settle pays no tip
  });
  it("cannot contribute twice, wrong amount, or wrong round", () => {
    const c = startedCircle();
    contribute(c, acct(0), 0, C, 0);
    expectErr(() => contribute(c, acct(0), 0, C, 0), "already_paid");
    expectErr(() => contribute(c, acct(1), 0, C - 1, 0), "wrong_amount");
    expectErr(() => contribute(c, acct(1), 1, C, 0), "wrong_round");
  });
});

describe("defaults", () => {
  it("settle is refused before deadline plus grace", () => {
    const c = startedCircle();
    payAll(c, [2]);
    expectErr(() => settle(c, "x", 100), "too_early");
    expect(canSettle(c, 120 + 30)).toBe(true);
  });
  it("slashes collateral and still pays the recipient in full", () => {
    const c = startedCircle({ reserveBps: 0, tipCap: 0 });
    payAll(c, [3]);
    const out = settle(c, "keeper", 150);
    expect(out.payout).toBe(5 * C);
    expect(c.members[3].collateral).toBe(4 * C - C);
    expect(c.members[3].defaults).toBe(1);
    expect(conserved(c)).toBe(true);
  });
  it("uses the safety pot after collateral runs out, then records what is owed", () => {
    const c = startedCircle({ collateralPct: 0, reserveBps: 1000, tipCap: 0 });
    payAll(c); settle(c, "k", 1); // builds reserve = 5 * 10%
    const reserveBefore = c.reserve;
    payAll(c, [4]);
    const out = settle(c, "k", 300);
    expect(c.reserve).toBe(Math.max(0, reserveBefore + 4 * Math.floor(C / 10) - C));
    expect(out.payout).toBeGreaterThan(0);
    expect(conserved(c)).toBe(true);
  });
  it("shortfall is recorded as owed, never invented", () => {
    const c = startedCircle({ collateralPct: 0, reserveBps: 0, tipCap: 0 });
    payAll(c, [4]);
    const out = settle(c, "k", 300);
    expect(out.payout).toBe(4 * C);
    expect(c.members[4].owed).toBe(C);
  });
  it("recipient offsets what they owe", () => {
    const c = startedCircle({ collateralPct: 0, reserveBps: 0, tipCap: 0 });
    payAll(c, [1]); settle(c, "k", 300); // member 1 owes C
    payAll(c); const out = settle(c, "k", 600); // member 1 receives in round 2
    expect(c.order[1]).toBe(acct(1));
    expect(out.payout).toBe(5 * C - C);
    expect(c.members[1].owed).toBe(0);
    expect(conserved(c)).toBe(true);
  });
  it("two defaults remove a member who has not yet been paid; their turn is skipped", () => {
    const c = startedCircle({ collateralPct: 100, reserveBps: 0, tipCap: 0 });
    // member 4 defaults in rounds 0 and 1
    payAll(c, [4]); settle(c, "k", 300);
    payAll(c, [4]); settle(c, "k", 600);
    expect(c.members[4].removed).toBe(true);
    payAll(c); settle(c, "k", 900);
    payAll(c); settle(c, "k", 1200);
    payAll(c); const last = settle(c, "k", 1500);
    const recipients = c.rounds.map((r) => r.recipient);
    expect(recipients).not.toContain(acct(4));
    expect(last.recipient).toBe(null);
    expect(conserved(c)).toBe(true);
    finish(c, 1600);
    expect(c.ledger.in).toBe(c.ledger.out);
  });
  it("a settled round cannot be settled again, and finish is idempotent", () => {
    const c = startedCircle({ reserveBps: 0 });
    for (let k = 0; k < 5; k++) { payAll(c); settle(c, "k", 1); }
    expectErr(() => settle(c, "k", 2), "nothing_to_settle");
    finish(c, 5);
    const snap = JSON.stringify(c.ledger);
    finish(c, 6);
    expect(JSON.stringify(c.ledger)).toBe(snap);
  });
});

describe("tip, autopay, seat transfer, score", () => {
  it("late settle pays a capped tip from the reserve", () => {
    const c = startedCircle({ reserveBps: 1000, tipCap: 500 });
    payAll(c); settle(c, "any", 1);
    payAll(c, [0]);
    settle(c, "keeper.testnet", 400);
    const tip = c.events.find((e) => e.kind === "tip");
    expect(tip && (tip.amount as number)).toBeLessThanOrEqual(500);
    expect(tip && tip.to).toBe("keeper.testnet");
  });
  it("autopay covers a missed contribution without a default", () => {
    const c = startedCircle({ reserveBps: 0, tipCap: 0 });
    prepay(c, acct(2), 2 * C, 0);
    payAll(c, [2]);
    const out = settle(c, "k", 200);
    expect(out.payout).toBe(5 * C);
    expect(c.members[2].defaults).toBe(0);
    expect(c.members[2].prepaid).toBe(C);
    expect(c.members[2].onTime).toBe(1);
  });
  it("seat transfer moves position, owed and collateral together", () => {
    const c = startedCircle({ collateralPct: 0, reserveBps: 0, tipCap: 0 });
    payAll(c, [1]); settle(c, "k", 300);
    expectErr(() => transferSeat(c, acct(1), "new.testnet", acct(3), 301), "creator_only");
    transferSeat(c, acct(1), "new.testnet", acct(0), 301);
    expect(c.order[1]).toBe("new.testnet");
    expect(c.members.find((m) => m.id === "new.testnet")!.owed).toBe(C);
    expect(conserved(c)).toBe(true);
  });
  it("Cowrie Score rewards a clean record and penalises defaults", () => {
    const clean = Array.from({ length: 3 }, () => ({ circle: "x", member: "a", rounds: 10, onTime: 10, defaults: 0 }));
    const bad = Array.from({ length: 3 }, () => ({ circle: "x", member: "a", rounds: 10, onTime: 7, defaults: 3 }));
    expect(cowrieScore([])).toBe(0);
    expect(cowrieScore(clean)).toBe(1000);
    expect(cowrieScore(bad)).toBeLessThan(cowrieScore(clean));
  });
});
