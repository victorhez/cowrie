// Shared helpers for the testnet scripts. Plain ESM so it runs with just `node`.
import { Account, KeyPair, KeyPairSigner, providers } from "near-api-js";

export const RPC = process.env.NEAR_RPC ?? "https://test.rpc.fastnear.com";
export const HELPER = "https://helper.testnet.near.org";
export const provider = new providers.JsonRpcProvider({ url: RPC });
export const TGAS = (n) => BigInt(n) * 1_000_000_000_000n;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const tag = () => Math.random().toString(16).slice(2, 8);
export const usdc = (v) => (Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });

export async function view(contractId, method, args = {}) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "query",
      params: { request_type: "call_function", finality: "optimistic", account_id: contractId, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    }),
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error(`view ${contractId}.${method}: ${j.result?.error ?? JSON.stringify(j.error)}`);
  return JSON.parse(Buffer.from(j.result.result).toString());
}

export async function accountExists(id) {
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }),
  });
  const j = await res.json();
  return j.result && !j.error && !j.result.error ? j.result : null;
}

/**
 * Creates a funded testnet account. First choice: the public faucet helper (free, rate limited per IP).
 * Fallback: if .keys/testnet.json holds the deployer's keys, create a sub-account funded from the
 * deployer's own testnet NEAR. Returns { id, secretKey, account }.
 */
export async function newAccount(name, fundNear = 0.2) {
  const kp = KeyPair.fromRandom("ed25519");
  const pub = kp.getPublicKey().toString();
  const base = `${name}-${tag()}`;
  let id = `${base}.testnet`;
  let created = false;
  for (let attempt = 1; attempt <= 3 && !created; attempt++) {
    try {
      const res = await fetch(`${HELPER}/account`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ newAccountId: id, newAccountPublicKey: pub }),
      });
      if (res.ok) created = true;
      else if (res.status === 429) break; // rate limited: go straight to the fallback
      else await sleep(1500 * attempt);
    } catch { await sleep(1500 * attempt); }
  }
  if (!created) {
    const fs = await import("node:fs");
    if (!fs.existsSync(".keys/testnet.json")) throw new Error("Testnet faucet is rate limited and no deployer keys were found. Try again later.");
    const keys = JSON.parse(fs.readFileSync(".keys/testnet.json", "utf8"));
    let funderId = null, best = 0n;
    for (const k of Object.keys(keys)) {
      const v = await accountExists(k);
      const free = v ? BigInt(v.amount) - BigInt(v.storage_usage) * 10_000_000_000_000_000_000n : 0n;
      if (free > best) { best = free; funderId = k; }
    }
    const want = BigInt(Math.round(fundNear * 1e6)) * 10n ** 18n;
    if (!funderId || best < want + 50_000_000_000_000_000_000_000n) throw new Error("Faucet is rate limited and the deployer accounts are low on testnet NEAR.");
    const funder = accountFromKey(funderId, keys[funderId]);
    id = `${base}.${funderId}`;
    await funder.createAccount(id, pub, want);
  }
  for (let i = 0; i < 30; i++) { if (await accountExists(id)) break; await sleep(1000); }
  return { id, secretKey: kp.toString(), account: new Account(id, provider, new KeyPairSigner(kp)) };
}

export function accountFromKey(id, secretKey) {
  return new Account(id, provider, new KeyPairSigner(KeyPair.fromString(secretKey)));
}

export async function call(account, contractId, methodName, args = {}, { gas = TGAS(100), deposit = 0n } = {}) {
  return account.callFunction({ contractId, methodName, args, gas, deposit });
}
