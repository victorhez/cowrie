// Deploys a fresh circle contract (clean state) to a sub-account of the existing circle account,
// points the credential contract at it, and updates src/data/deployment.json.
// Used after contract fixes so that the live testnet deployment matches the code in this repo.
import fs from "node:fs";
import path from "node:path";
import { KeyPair } from "near-api-js";
import { accountFromKey, call, view, sleep, accountExists } from "./near.mjs";

const D = JSON.parse(fs.readFileSync("src/data/deployment.json", "utf8"));
const keys = JSON.parse(fs.readFileSync(".keys/testnet.json", "utf8"));
const parent = D.circle.includes(".cowrie-circle-") ? D.circle.split(".").slice(1).join(".") : D.circle;
const n = (Number(process.env.GEN ?? 0) || Math.floor(Date.now() / 1000)).toString(36);
const id = `c${n}.${parent}`;
const kp = KeyPair.fromRandom("ed25519");
const owner = accountFromKey(parent, keys[parent]);
console.log("creating", id);
await owner.createAccount(id, kp.getPublicKey().toString(), 3_300_000_000_000_000_000_000_000n);
for (let i = 0; i < 20 && !(await accountExists(id)); i++) await sleep(1000);
const acct = accountFromKey(id, kp.toString());
await acct.deployContract(fs.readFileSync(path.resolve("contracts/out/cowrie_circle.wasm")));
await call(acct, id, "new", { credential: D.credential });
const credOwner = accountFromKey(D.credential, keys[D.credential]);
await call(credOwner, D.credential, "set_minter", { minter: id });
keys[id] = kp.toString();
fs.writeFileSync(".keys/testnet.json", JSON.stringify(keys, null, 1));
await sleep(2000);
console.log("credential minter is now", await view(D.credential, "minter"));
D.circle = id;
D.deployedAt = new Date().toISOString();
fs.writeFileSync("src/data/deployment.json", JSON.stringify(D, null, 2) + "\n");
console.log("updated deployment.json ->", id);
