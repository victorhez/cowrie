/**
 * Secretary eval: 30 questions with expected facts, asked against a seeded circle.
 * Prints accuracy and every miss. Mode: rules-based (NEAR AI Cloud mode is pending).
 */
import { newDemo, stepDemo, demoId } from "../../src/engine/demo";
import { contribute, currentRound } from "../../src/engine/circle";
import { answer } from "../../src/engine/secretary";

const c = newDemo();
const t = { t: 0 };
stepDemo(c, t); // round 1 done (ada paid)
stepDemo(c, t); // round 2 done (bola paid)
// round 3 in progress: ada, bola, chidi, efe have paid; dayo has not
const r = currentRound(c)!;
for (const n of ["ada", "bola", "chidi", "efe"]) contribute(c, demoId(n), r.index, c.params.contribution, t.t);
const now = r.dueAt - 40;

const qs: [string, string[]][] = [
  ["Whose turn is it?", ["chidi"]],
  ["Who is next to receive the pot?", ["chidi"]],
  ["Who gets paid this round?", ["chidi"]],
  ["Who has not paid yet?", ["dayo"]],
  ["Who hasn't paid?", ["dayo"]],
  ["Who still owes this round?", ["dayo"]],
  ["Who has paid?", ["ada", "bola", "chidi", "efe"]],
  ["What happens if I miss a payment?", ["collateral", "recorded"]],
  ["What if I forget to pay?", ["collateral"]],
  ["What happens if I don't pay on time?", ["grace"]],
  ["How much is the pot?", ["490"]],
  ["What is the pot size?", ["490"]],
  ["How much do I contribute each round?", ["100"]],
  ["What is the contribution?", ["100"]],
  ["When is the deadline?", ["40s"]],
  ["How long until the round is due?", ["40s"]],
  ["How much collateral do I need?", ["400"]],
  ["How much collateral does dayo have?", ["400"]],
  ["What is in the safety pot?", ["safety pot", "USDC"]],
  ["How much is in the reserve?", ["USDC"]],
  ["Has anyone defaulted?", ["No defaults"]],
  ["Does ada have any defaults?", ["0 defaults"]],
  ["Has ada received the payout already?", ["already received"]],
  ["Has chidi received their payout?", ["not received"]],
  ["Has bola been paid?", ["already received"]],
  ["What round are we in?", ["Round 3"]],
  ["What is the status of the circle?", ["active"]],
  ["Can you send my funds to someone?", ["cannot move funds"]],
  ["Can you withdraw the money for me?", ["cannot move funds"]],
  ["Who is efe?", ["can answer"]], // out of scope: must decline rather than invent
];

let ok = 0;
const misses: string[] = [];
for (const [q, expect] of qs) {
  const a = answer(c, q, now);
  const pass = expect.every((e) => a.toLowerCase().includes(e.toLowerCase()));
  if (pass) ok++; else misses.push(`Q: ${q}\n   expected: ${expect.join(" + ")}\n   got:      ${a}`);
}
console.log(`Secretary eval (rules-based mode): ${ok}/${qs.length} correct = ${((ok / qs.length) * 100).toFixed(1)}%`);
if (misses.length) { console.log("\nMisses:"); console.log(misses.join("\n")); }
process.exit(misses.length ? 1 : 0);
