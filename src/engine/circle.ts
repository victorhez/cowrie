/**
 * Cowrie circle engine: the reference implementation of the circle rules.
 *
 * Pure, deterministic and dependency-free. Amounts are integers in the token's
 * smallest unit (mock-usdc uses 6 decimals). Time is passed in explicitly so
 * deadlines, grace periods and defaults are fully testable.
 *
 * The on-chain contract (contracts/circle) is specified to follow this
 * state machine rule for rule; see docs/RULES.md.
 */

export type OrderMode = "creator" | "random";
export type Status = "open" | "active" | "completed" | "cancelled";

export interface Params {
  members: number; // N, 2..24
  contribution: number; // C per member per round
  periodSecs: number;
  graceSecs: number;
  collateralPct: 0 | 50 | 100;
  reserveBps: number; // share of each contribution moved to the safety pot
  tipCap: number; // max settler tip, paid from the safety pot
  orderMode: OrderMode;
  minCredentials: number; // credentials needed for the discount
  discountPct: number; // collateral discount for credentialed members (0..100)
}

export interface Member {
  id: string;
  position: number;
  collateral: number;
  prepaid: number;
  defaults: number;
  owed: number;
  onTime: number;
  received: boolean;
  removed: boolean;
}

export type PaidVia = "direct" | "autopay" | "slashed" | "reserve" | "short";

export interface Round {
  index: number;
  dueAt: number;
  paid: Record<string, PaidVia>;
  pot: number;
  settled: boolean;
  recipient: string | null;
  payout: number;
}

export interface Credential {
  circle: string;
  member: string;
  rounds: number;
  onTime: number;
  defaults: number;
}

export type Event = { t: number; kind: string; [k: string]: unknown };

export interface Circle {
  id: string;
  creator: string;
  params: Params;
  status: Status;
  startedAt: number | null;
  members: Member[];
  order: string[]; // member ids by turn
  rounds: Round[];
  reserve: number;
  ledger: { in: number; out: number };
  credentials: Credential[];
  events: Event[];
  seed: number;
}

export class CircleError extends Error {
  constructor(public code: string, msg?: string) {
    super(msg ?? code);
  }
}
const fail = (code: string, msg?: string): never => {
  throw new CircleError(code, msg);
};

export function defaultParams(over: Partial<Params> = {}): Params {
  return {
    members: 5,
    contribution: 100_000_000,
    periodSecs: 120,
    graceSecs: 30,
    collateralPct: 100,
    reserveBps: 200,
    tipCap: 1_000_000,
    orderMode: "creator",
    minCredentials: 1,
    discountPct: 50,
    ...over,
  };
}

export function createCircle(id: string, creator: string, params: Params, seed = 1): Circle {
  if (params.members < 2 || params.members > 24) fail("bad_members");
  if (!Number.isInteger(params.contribution) || params.contribution <= 0) fail("bad_contribution");
  if (![0, 50, 100].includes(params.collateralPct)) fail("bad_collateral");
  if (params.reserveBps < 0 || params.reserveBps > 1000) fail("bad_reserve");
  if (params.discountPct < 0 || params.discountPct > 100) fail("bad_discount");
  const c: Circle = {
    id,
    creator,
    params,
    status: "open",
    startedAt: null,
    members: [],
    order: [],
    rounds: [],
    reserve: 0,
    ledger: { in: 0, out: 0 },
    credentials: [],
    events: [],
    seed,
  };
  c.events.push({ t: 0, kind: "created", id, creator });
  return c;
}

export function collateralRequired(p: Params, credentials = 0): number {
  const full = Math.floor((p.contribution * (p.members - 1) * p.collateralPct) / 100);
  return credentials >= p.minCredentials && p.collateralPct > 0
    ? Math.floor((full * (100 - p.discountPct)) / 100)
    : full;
}

const member = (c: Circle, id: string): Member => c.members.find((m) => m.id === id) ?? fail("not_member", id);

export function join(c: Circle, id: string, now: number, credentials = 0): void {
  if (c.status !== "open") fail("not_open");
  if (c.members.some((m) => m.id === id)) fail("already_member");
  if (c.members.length >= c.params.members) fail("full");
  const col = collateralRequired(c.params, credentials);
  c.members.push({
    id,
    position: -1,
    collateral: col,
    prepaid: 0,
    defaults: 0,
    owed: 0,
    onTime: 0,
    received: false,
    removed: false,
  });
  c.ledger.in += col;
  c.events.push({ t: now, kind: "joined", member: id, collateral: col });
}

/** Before the circle starts a member can leave and get collateral back in full. */
export function leave(c: Circle, id: string, now: number): void {
  if (c.status !== "open") fail("not_open");
  const m = member(c, id);
  c.members = c.members.filter((x) => x !== m);
  c.ledger.out += m.collateral + m.prepaid;
  c.events.push({ t: now, kind: "left", member: id, refunded: m.collateral + m.prepaid });
}

export function cancel(c: Circle, by: string, now: number): void {
  if (c.status !== "open") fail("not_open");
  if (by !== c.creator) fail("creator_only");
  for (const m of c.members) {
    c.ledger.out += m.collateral + m.prepaid;
    m.collateral = 0;
    m.prepaid = 0;
  }
  c.status = "cancelled";
  c.events.push({ t: now, kind: "cancelled" });
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Starts the circle once every seat is filled. Fixes order and the schedule. */
export function start(c: Circle, now: number, order?: string[]): void {
  if (c.status !== "open") fail("not_open");
  if (c.members.length !== c.params.members) fail("not_full");
  const ids = c.members.map((m) => m.id);
  let ord = order ?? ids;
  if (ord.length !== ids.length || new Set(ord).size !== ids.length || !ord.every((x) => ids.includes(x)))
    fail("bad_order");
  if (c.params.orderMode === "random") {
    const r = rng(c.seed);
    ord = [...ids];
    for (let i = ord.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [ord[i], ord[j]] = [ord[j], ord[i]];
    }
  }
  c.order = ord;
  ord.forEach((id, i) => (member(c, id).position = i));
  c.rounds = ord.map((_, i) => ({
    index: i,
    dueAt: now + (i + 1) * c.params.periodSecs,
    paid: {},
    pot: 0,
    settled: false,
    recipient: null,
    payout: 0,
  }));
  c.status = "active";
  c.startedAt = now;
  c.events.push({ t: now, kind: "started", order: ord });
}

export function currentRound(c: Circle): Round | null {
  return c.rounds.find((r) => !r.settled) ?? null;
}

function reserveShare(c: Circle, amount: number): number {
  return Math.floor((amount * c.params.reserveBps) / 10_000);
}

/** A member pays their contribution for the current round. Exactly C, once. */
export function contribute(c: Circle, id: string, round: number, amount: number, now: number): void {
  if (c.status !== "active") fail("not_active");
  const r = currentRound(c);
  if (!r || r.index !== round) fail("wrong_round");
  const m = member(c, id);
  if (amount !== c.params.contribution) fail("wrong_amount");
  if (r!.paid[m.id]) fail("already_paid");
  const rs = reserveShare(c, amount);
  c.ledger.in += amount;
  c.reserve += rs;
  r!.pot += amount - rs;
  r!.paid[m.id] = "direct";
  m.onTime += 1;
  c.events.push({ t: now, kind: "contributed", member: id, round, amount });
}

/** Prepay future rounds into an autopay balance held by the circle. */
export function prepay(c: Circle, id: string, amount: number, now: number): void {
  if (c.status !== "active" && c.status !== "open") fail("not_active");
  if (!Number.isInteger(amount) || amount <= 0) fail("bad_amount");
  member(c, id).prepaid += amount;
  c.ledger.in += amount;
  c.events.push({ t: now, kind: "prepaid", member: id, amount });
}

export function canSettle(c: Circle, now: number): boolean {
  const r = currentRound(c);
  if (c.status !== "active" || !r) return false;
  const allPaid = c.members.every((m) => r.paid[m.id]);
  return allPaid || now >= r.dueAt + c.params.graceSecs;
}

function pickRecipient(c: Circle, r: Round): Member | null {
  const n = c.order.length;
  for (let k = 0; k < n; k++) {
    const m = member(c, c.order[(r.index + k) % n]);
    if (!m.removed && !m.received) return m;
  }
  return null;
}

/**
 * Settle the current round. Callable by anyone once everybody paid, or once the
 * deadline plus grace has passed. A settled round cannot settle again.
 */
export function settle(c: Circle, caller: string, now: number): { payout: number; recipient: string | null } {
  if (c.status !== "active") fail("not_active");
  const r = currentRound(c) ?? fail("nothing_to_settle");
  if (!canSettle(c, now)) fail("too_early");
  const C = c.params.contribution;
  const lateSettle = !c.members.every((m) => r.paid[m.id]);

  for (const m of c.members) {
    if (r.paid[m.id]) continue;
    // 1. autopay balance
    const draw = Math.min(m.prepaid, C);
    let missing = C - draw;
    if (draw > 0) {
      m.prepaid -= draw;
      const rs = reserveShare(c, draw);
      c.reserve += rs;
      r.pot += draw - rs;
    }
    if (missing === 0) {
      r.paid[m.id] = "autopay";
      m.onTime += 1;
      c.events.push({ t: now, kind: "autopaid", member: m.id, round: r.index, amount: draw });
      continue;
    }
    // 2. default recorded; slash collateral, then the safety pot, then record what is owed
    m.defaults += 1;
    c.events.push({ t: now, kind: "defaulted", member: m.id, round: r.index });
    const slash = Math.min(missing, m.collateral);
    if (slash > 0) {
      m.collateral -= slash;
      r.pot += slash;
      missing -= slash;
      c.events.push({ t: now, kind: "slashed", member: m.id, round: r.index, amount: slash });
    }
    let via: PaidVia = "slashed";
    if (missing > 0) {
      const fromReserve = Math.min(missing, c.reserve);
      if (fromReserve > 0) {
        c.reserve -= fromReserve;
        r.pot += fromReserve;
        missing -= fromReserve;
        c.events.push({ t: now, kind: "reserve_used", round: r.index, amount: fromReserve });
        via = "reserve";
      }
    }
    if (missing > 0) {
      m.owed += missing;
      via = "short";
    }
    r.paid[m.id] = via;
    // two defaults: removed from future payouts if not yet paid out
    if (m.defaults >= 2 && !m.received) m.removed = true;
  }

  // Recipient and payout (offset what the recipient owes back into the safety pot)
  const rec = pickRecipient(c, r);
  let payout = 0;
  if (rec) {
    const offset = Math.min(rec.owed, r.pot);
    rec.owed -= offset;
    c.reserve += offset;
    payout = r.pot - offset;
    rec.received = true;
    r.recipient = rec.id;
  } else {
    c.reserve += r.pot; // nobody eligible: pot joins the safety pot, returned at finish
  }
  r.payout = payout;
  c.ledger.out += payout;
  r.pot = 0;
  r.settled = true;
  c.events.push({ t: now, kind: "settled", round: r.index, recipient: r.recipient, payout });

  // Settler tip: only on a late settle, only from the safety pot, capped
  if (lateSettle && c.params.tipCap > 0 && caller) {
    const tip = Math.min(c.params.tipCap, c.reserve);
    if (tip > 0) {
      c.reserve -= tip;
      c.ledger.out += tip;
      c.events.push({ t: now, kind: "tip", to: caller, amount: tip });
    }
  }
  return { payout, recipient: r.recipient };
}

/** After the last round: return collateral, prepaid and leftover reserve, mint credentials. */
export function finish(c: Circle, now: number): void {
  if (c.status === "completed") return; // idempotent
  if (c.status !== "active") fail("not_active");
  if (c.rounds.some((r) => !r.settled)) fail("rounds_pending");
  for (const m of c.members) {
    c.ledger.out += m.collateral + m.prepaid;
    m.collateral = 0;
    m.prepaid = 0;
  }
  const n = c.members.length;
  const share = Math.floor(c.reserve / n);
  const dust = c.reserve - share * n;
  c.members.forEach((m, i) => {
    const amt = share + (i === 0 ? dust : 0);
    c.ledger.out += amt;
    c.events.push({ t: now, kind: "reserve_returned", member: m.id, amount: amt });
  });
  c.reserve = 0;
  for (const m of c.members) {
    c.credentials.push({
      circle: c.id,
      member: m.id,
      rounds: c.params.members,
      onTime: m.onTime,
      defaults: m.defaults,
    });
    c.events.push({ t: now, kind: "credential_minted", member: m.id });
  }
  c.status = "completed";
  c.events.push({ t: now, kind: "finished" });
}

/** Seat transfer after start, with creator approval. Position, owed and collateral move together. */
export function transferSeat(c: Circle, from: string, to: string, approvedBy: string, now: number): void {
  if (c.status !== "active") fail("not_active");
  if (approvedBy !== c.creator) fail("creator_only");
  if (c.members.some((m) => m.id === to)) fail("already_member");
  const m = member(c, from);
  const idx = c.order.indexOf(from);
  m.id = to;
  c.order[idx] = to;
  for (const r of c.rounds) {
    if (r.paid[from]) {
      r.paid[to] = r.paid[from];
      delete r.paid[from];
    }
    if (r.recipient === from) r.recipient = to;
  }
  c.events.push({ t: now, kind: "seat_transferred", from, to });
}

/** Tokens the circle holds, computed from its own books. */
export function held(c: Circle): number {
  return (
    c.members.reduce((s, m) => s + m.collateral + m.prepaid, 0) +
    c.reserve +
    c.rounds.reduce((s, r) => s + (r.settled ? 0 : r.pot), 0)
  );
}

export function conserved(c: Circle): boolean {
  return c.ledger.in === c.ledger.out + held(c);
}

/** Cowrie Score, 0..1000. Published formula: see docs/RULES.md. */
export function cowrieScore(creds: Credential[]): number {
  if (creds.length === 0) return 0;
  const rounds = creds.reduce((s, x) => s + x.rounds, 0);
  const onTime = creds.reduce((s, x) => s + x.onTime, 0);
  const defaults = creds.reduce((s, x) => s + x.defaults, 0);
  const rate = rounds ? onTime / rounds : 0;
  const volume = Math.min(1, rounds / 30);
  const penalty = Math.min(0.5, defaults * 0.1);
  return Math.max(0, Math.round(1000 * (0.7 * rate + 0.3 * volume - penalty)));
}
