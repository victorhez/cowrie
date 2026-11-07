import {
  Circle, Params, createCircle, defaultParams, join, start, contribute, prepay, settle, finish,
  currentRound, canSettle, transferSeat, conserved, CircleError,
} from "@/engine/circle";

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const acct = (i: number) => `m${i}.testnet`;

/** Build and start a full circle with `n` members. */
export function startedCircle(over: Partial<Params> = {}, seed = 7): Circle {
  const p = defaultParams(over);
  const c = createCircle("c1", acct(0), p, seed);
  for (let i = 0; i < p.members; i++) join(c, acct(i), 0);
  start(c, 0);
  return c;
}

export const expectErr = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof CircleError && e.code === code) return true;
    throw e;
  }
  throw new Error(`expected error ${code}`);
};

export interface RunReport {
  c: Circle;
  violations: string[];
}

/** Drive a whole circle with random behaviour, checking invariants after every step. */
export function randomRun(seed: number, opts: { maxMembers?: number } = {}): RunReport {
  const r = mulberry(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const n = 2 + Math.floor(r() * ((opts.maxMembers ?? 10) - 1));
  const p = defaultParams({
    members: n,
    contribution: 1 + Math.floor(r() * 500) * 1000,
    collateralPct: pick([0, 50, 100]) as 0 | 50 | 100,
    reserveBps: pick([0, 100, 200, 300, 1000]),
    tipCap: pick([0, 500, 100_000]),
    orderMode: pick(["creator", "random"]) as "creator" | "random",
    periodSecs: 100,
    graceSecs: 10,
  });
  const c = createCircle("fz", acct(0), p, Math.floor(r() * 1e9));
  const v: string[] = [];
  const check = (label: string) => {
    if (!conserved(c)) v.push(`I1 conservation broken after ${label}`);
    if (c.reserve < 0) v.push(`negative reserve after ${label}`);
    for (const m of c.members) {
      if (m.collateral < 0 || m.prepaid < 0 || m.owed < 0) v.push(`negative balance ${m.id} after ${label}`);
    }
  };
  const initialCollateral = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    join(c, acct(i), 0);
    initialCollateral.set(acct(i), c.members[i].collateral);
    check("join");
  }
  // some members prepay random amounts
  for (let i = 0; i < n; i++) if (r() < 0.3) { prepay(c, acct(i), Math.floor(r() * p.contribution * 3) + 1, 0); check("prepay"); }
  start(c, 0);
  check("start");

  let now = 0;
  const slashedBy = new Map<string, number>();
  const defaultProb = pick([0, 0.05, 0.2, 0.5, 0.9]);
  const received: string[] = [];
  let tipTotal = 0;
  let guard = 0;
  while (currentRound(c) && guard++ < 1000) {
    const round = currentRound(c)!;
    for (const m of [...c.members]) {
      if (r() > defaultProb) {
        const before = c.events.length;
        contribute(c, m.id, round.index, p.contribution, now);
        void before;
        check("contribute");
        // double pay must fail
        try {
          contribute(c, m.id, round.index, p.contribution, now);
          v.push("I-double contribute accepted");
        } catch { /* expected */ }
      }
    }
    // wrong amount must fail
    try {
      const m = pick(c.members);
      if (!round.paid[m.id]) {
        contribute(c, m.id, round.index, p.contribution + 1, now);
        v.push("wrong amount accepted");
      }
    } catch { /* expected */ }
    // maybe transfer a seat mid-game
    if (r() < 0.1 && c.status === "active") {
      const from = pick(c.members).id;
      const before = JSON.stringify([c.members.map((m) => [m.collateral, m.owed, m.prepaid]), c.ledger, c.reserve]);
      transferSeat(c, from, `new${guard}.testnet`, c.creator, now);
      const after = JSON.stringify([c.members.map((m) => [m.collateral, m.owed, m.prepaid]), c.ledger, c.reserve]);
      if (before !== after) v.push("I10 seat transfer changed totals");
      check("transfer");
    }
    now = round.dueAt + p.graceSecs + 1;
    if (!canSettle(c, now)) v.push("canSettle false after deadline+grace");
    const before = c.events.length;
    const tipsBefore = c.events.filter((e) => e.kind === "tip").length;
    settle(c, "keeper.testnet", now);
    check("settle");
    for (const e of c.events.slice(before)) {
      if (e.kind === "slashed") slashedBy.set(e.member as string, (slashedBy.get(e.member as string) ?? 0) + (e.amount as number));
      if (e.kind === "tip") { tipTotal += e.amount as number; if ((e.amount as number) > p.tipCap) v.push("I11 tip over cap"); }
    }
    void tipsBefore;
    // I2 / I6: a second settle of the same round must not pay twice
    const out = c.ledger.out;
    if (round.settled) {
      try {
        if (currentRound(c)) {
          // settling the next round early must be refused
          settle(c, "x", now);
        }
      } catch { /* expected too_early */ }
      if (c.ledger.out !== out && currentRound(c) && !canSettle(c, now)) v.push("early settle paid out");
    }
    if (round.recipient) received.push(round.recipient);
  }
  // I4 slashing never exceeds locked collateral
  for (const [id, s] of slashedBy) {
    const init = initialCollateral.get(id);
    if (init !== undefined && s > init) v.push(`I4 slashed ${id} more than locked`);
  }
  // I2 one payout per recipient
  if (new Set(received).size !== received.length) v.push("I2/I5 a member received two payouts");
  // I5 removed never receives; eligible receives
  for (const m of c.members) {
    if (m.removed && m.received) v.push("I5 removed member received");
    if (!m.removed && !m.received) v.push(`I5 eligible member ${m.id} never received`);
  }
  finish(c, now);
  check("finish");
  // I6 finish idempotent
  const snap = JSON.stringify([c.ledger, c.reserve, c.credentials.length]);
  finish(c, now);
  if (snap !== JSON.stringify([c.ledger, c.reserve, c.credentials.length])) v.push("I6 finish not idempotent");
  // I8 reserve conservation: everything returned
  if (c.reserve !== 0 || c.ledger.in !== c.ledger.out) v.push("I8 funds left after finish");
  // I7 credentials only after finish, one per member
  if (c.credentials.length !== c.members.length) v.push("I7 credential count");
  if (tipTotal < 0) v.push("negative tips");
  return { c, violations: v };
}
