/**
 * Equivalence check: the engine against an independent closed-form oracle.
 * The oracle computes a single round's payout from first principles (no shared code).
 * Scenarios vary who misses, collateral, safety pot and prepaid balances.
 */
import { createCircle, defaultParams, join, start, contribute, prepay, settle } from "../../src/engine/circle";

const C = 100_000_000;
interface Scn { name: string; n: number; col: 0 | 50 | 100; bps: number; missing: number[]; reserveSeed: number; prepaid: Record<number, number> }

function oracle(s: Scn) {
  const rs = (x: number) => Math.floor((x * s.bps) / 10000);
  const collateral = Math.floor((C * (s.n - 1) * s.col) / 100);
  let pot = 0, reserve = s.reserveSeed, owed0 = 0;
  for (let i = 0; i < s.n; i++) {
    if (!s.missing.includes(i)) { pot += C - rs(C); reserve += rs(C); continue; }
    const draw = Math.min(s.prepaid[i] ?? 0, C);
    pot += draw - rs(draw); reserve += rs(draw);
    let miss = C - draw;
    const slash = Math.min(miss, collateral); pot += slash; miss -= slash;
    const fromRes = Math.min(miss, reserve); reserve -= fromRes; pot += fromRes; miss -= fromRes;
    if (i === 0) owed0 = miss; // position 0 is paid this round
  }
  return pot - Math.min(owed0, pot); // recipient offsets what they owe
}

const scenarios: Scn[] = [
  { name: "all pay, no reserve", n: 5, col: 100, bps: 0, missing: [], reserveSeed: 0, prepaid: {} },
  { name: "one misses, full collateral", n: 5, col: 100, bps: 0, missing: [2], reserveSeed: 0, prepaid: {} },
  { name: "two miss, half collateral, 2% pot", n: 6, col: 50, bps: 200, missing: [1, 4], reserveSeed: 0, prepaid: {} },
  { name: "miss with autopay covering", n: 5, col: 0, bps: 200, missing: [3], reserveSeed: 0, prepaid: { 3: 2 * C } },
  { name: "no collateral, safety pot absorbs", n: 5, col: 0, bps: 0, missing: [0, 1], reserveSeed: 0, prepaid: {} },
  { name: "three miss, 10 members, 50%", n: 10, col: 50, bps: 500, missing: [2, 5, 9], reserveSeed: 0, prepaid: { 5: C / 2 } },
];

let bad = 0;
for (const s of scenarios) {
  const c = createCircle("eq", "m0", defaultParams({ members: s.n, contribution: C, collateralPct: s.col, reserveBps: s.bps, tipCap: 0, periodSecs: 100, graceSecs: 0 }));
  for (let i = 0; i < s.n; i++) join(c, `m${i}`, 0);
  for (const [i, amt] of Object.entries(s.prepaid)) prepay(c, `m${i}`, amt, 0);
  start(c, 0);
  for (let i = 0; i < s.n; i++) if (!s.missing.includes(i)) contribute(c, `m${i}`, 0, C, 0);
  const got = settle(c, "", 101).payout;
  const want = oracle(s);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${s.name.padEnd(40)} engine=${got}  oracle=${want}`);
}
console.log(bad ? `\n${bad} mismatch(es)` : `\nAll ${scenarios.length} scenarios match.`);
process.exit(bad ? 1 : 0);
