// End-to-end demo on NEAR testnet: a 5-member circle, one member misses a round,
// collateral is slashed, the recipient is still paid in full, the circle finishes,
// credentials are minted, and a returning member gets a collateral discount.
//
//   npm run demo                      (about 3 minutes)
//   PERIOD=30 GRACE=5 npm run demo    (faster rounds)
//
// Needs only Node 20+ and network access: it creates fresh testnet accounts through the public faucet helper.
import fs from "node:fs";
import { newAccount, call, view, tag, TGAS, sleep, usdc } from "./near.mjs";

const D = JSON.parse(fs.readFileSync("src/data/deployment.json", "utf8"));
if (!D.circle) throw new Error("No deployment found. Run npm run deploy:testnet first.");
const PERIOD = Number(process.env.PERIOD ?? 45);
const GRACE = Number(process.env.GRACE ?? 10);
const C = 100_000_000n; // 100 mUSDC
const log = (...a) => console.log(...a);
const short = (id) => id.split("-")[0];

const t = tag();
const names = ["ada", "bola", "chidi", "dayo", "efe"];
log(`\n== Cowrie testnet demo ==  circle contract: ${D.circle}\n`);
log("Creating funded testnet accounts through the faucet helper...");
const who = {};
for (const n of names) who[n] = await newAccount(n);
const keeper = await newAccount("keeper");
const id = (n) => who[n].id;

log("Getting test mock-usdc from the faucet (1,000 each)...");
for (const n of names) await call(who[n].account, D.token, "faucet", { account_id: id(n), amount: "1000000000" }, { gas: TGAS(30) });

const bal = async (acct) => BigInt((await view(D.token, "ft_balance_of", { account_id: acct })));
const ft = (n, amount, msg) => call(who[n].account, D.token, "ft_transfer_call", { receiver_id: D.circle, amount: String(amount), msg: JSON.stringify(msg) }, { gas: TGAS(150), deposit: 1n });

async function newCircle(name) {
  const before = (await view(D.circle, "list_circles", { from_index: 0, limit: 100 })).length;
  await call(who.ada.account, D.circle, "create_circle", {
    name, token: D.token, members: 5, contribution: String(C), period_secs: PERIOD, grace_secs: GRACE,
    collateral_pct: 100, reserve_bps: 200, tip_cap: "1000000", random_order: false, min_credentials: 1, discount_pct: 50,
  });
  const all = await view(D.circle, "list_circles", { from_index: 0, limit: 100 });
  return all[Math.max(before, all.length - 1)].id;
}

log("\n1. Create the circle (5 members, 100 mUSDC per round, 100% collateral, 2% safety pot)");
const cid = await newCircle(`Demo ajo ${t}`);
const need = BigInt(await view(D.circle, "collateral_required", { circle: cid, credentials: 0 }));
log(`   circle #${cid}; each member must lock ${usdc(need)} mUSDC`);

log("\n2. Members join and lock collateral (the circle starts when the last seat fills)");
for (const n of names) {
  await ft(n, need, { action: "join", circle: cid });
  log(`   ${n} joined`);
}
let c = await view(D.circle, "get_circle", { circle: cid });
log(`   status: ${c.status}; order: ${c.order.map(short).join(" > ")}`);
if (c.status !== "active") throw new Error("circle did not start");

for (let r = 0; r < 5; r++) {
  c = await view(D.circle, "get_circle", { circle: cid });
  const round = c.rounds[r];
  const skip = r === 2 ? "dayo" : null;
  log(`\n3.${r + 1} Round ${r + 1}: ${skip ? "dayo will miss the payment" : "everyone pays"}`);
  for (const n of names) {
    if (n === skip) continue;
    await ft(n, C, { action: "contribute", circle: cid, round: r });
  }
  if (skip) {
    const wait = Math.max(0, round.due_at + GRACE + 2 - Math.floor(Date.now() / 1000));
    log(`   waiting ${wait}s for the deadline and grace period...`);
    await sleep(wait * 1000);
    for (let i = 0; i < 20 && !(await view(D.circle, "can_settle", { circle: cid })); i++) await sleep(2000);
  }
  const tipBefore = await bal(keeper.id);
  await call(keeper.account, D.circle, "settle", { circle: cid }, { gas: TGAS(200) });
  await sleep(3000);
  c = await view(D.circle, "get_circle", { circle: cid });
  const rd = c.rounds[r];
  log(`   settled: recipient ${rd.recipient ? short(rd.recipient) : "none"} received ${usdc(rd.payout)} mUSDC`);
  if (skip) {
    const dm = c.members.find((m) => m.id === id("dayo"));
    log(`   dayo: defaults=${dm.defaults}, collateral now ${usdc(dm.collateral)} (slashed ${usdc(need - BigInt(dm.collateral))})`);
    log(`   keeper tip: ${usdc((await bal(keeper.id)) - tipBefore)} mUSDC from the safety pot`);
  }
  log(`   conservation (in = out + held): ${await view(D.circle, "conserved", { circle: cid })}`);
}

log("\n4. Finish: return collateral and the leftover safety pot, mint credentials");
await call(keeper.account, D.circle, "finish", { circle: cid }, { gas: TGAS(300) });
await sleep(6000);
c = await view(D.circle, "get_circle", { circle: cid });
log(`   status: ${c.status}; funds left in circle: ${usdc(BigInt(c.ledger_in) - BigInt(c.ledger_out))} mUSDC`);
for (const n of names) {
  const creds = await view(D.credential, "credentials_of", { account_id: id(n) });
  const score = await view(D.credential, "score", { account_id: id(n) });
  const k = creds[0];
  log(`   ${n.padEnd(6)} credential: ${k ? `${k.on_time}/${k.rounds} on time, ${k.defaults} default(s)` : "none"}  | Cowrie Score ${score}  | balance ${usdc(await bal(id(n)))} mUSDC`);
}

log("\n5. Soulbound check: transferring a credential must fail");
try {
  const tok = (await view(D.credential, "nft_tokens_for_owner", { account_id: id("ada") }))[0];
  await call(who.ada.account, D.credential, "nft_transfer", { receiver_id: id("bola"), token_id: tok.token_id }, { deposit: 1n });
  log("   UNEXPECTED: transfer succeeded");
  process.exitCode = 1;
} catch (e) {
  log("   transfer rejected (soulbound)");
}

log("\n6. Returning-member discount: ada (1 credential) joins a new circle");
const cid2 = await newCircle(`Second ajo ${t}`);
const need2 = BigInt(await view(D.circle, "collateral_required", { circle: cid2, credentials: 1 }));
log(`   collateral for a credentialed member: ${usdc(need2)} mUSDC (new members: ${usdc(need)})`);
await ft("ada", need2, { action: "join", circle: cid2 });
await sleep(4000);
const c2 = await view(D.circle, "get_circle", { circle: cid2 });
const adaLocked = c2.members.find((m) => m.id === id("ada"))?.collateral;
log(`   ada locked ${adaLocked ? usdc(adaLocked) : "0 (join refused)"} mUSDC`);
if (!adaLocked || BigInt(adaLocked) !== need2) process.exitCode = 1;

log(`\nDone. See it on chain: ${D.explorer}/address/${D.circle}`);
log(`Public page: circle #${cid} at /circle/${cid}\n`);
