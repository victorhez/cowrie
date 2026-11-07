// Deploys the three Cowrie contracts to NEAR testnet and writes src/data/deployment.json.
// Creates fresh funded testnet accounts through the public faucet helper. Keys are saved to .keys/ (gitignored, testnet only).
//   npm run build:contracts   (once, needs Rust)  then  npm run deploy:testnet
import fs from "node:fs";
import path from "node:path";
import { newAccount, call, view, tag, TGAS, sleep } from "./near.mjs";

const wasm = (n) => fs.readFileSync(path.resolve("contracts/out", n));
const t = tag();
const ids = { token: `cowrie-usdc-${t}.testnet`, credential: `cowrie-cred-${t}.testnet`, circle: `cowrie-circle-${t}.testnet` };

const keys = {};
const accts = {};
for (const [k, id] of Object.entries(ids)) {
  console.log(`creating ${id}`);
  const a = await newAccount(id);
  accts[k] = a.account;
  keys[id] = a.secretKey;
}
fs.mkdirSync(".keys", { recursive: true });
fs.writeFileSync(".keys/testnet.json", JSON.stringify(keys, null, 1));

console.log("deploying mock-usdc");
await accts.token.deployContract(wasm("mock_usdc.wasm"));
await call(accts.token, ids.token, "new", {});
console.log("deploying credential");
await accts.credential.deployContract(wasm("cowrie_credential.wasm"));
await call(accts.credential, ids.credential, "new", { minter: ids.circle });
console.log("deploying circle");
await accts.circle.deployContract(wasm("cowrie_circle.wasm"));
await call(accts.circle, ids.circle, "new", { credential: ids.credential });
await sleep(2000);

const meta = await view(ids.token, "ft_metadata");
const minter = await view(ids.credential, "minter");
console.log("token:", meta.symbol, meta.decimals, "| credential minter:", minter);

const out = {
  network: "testnet", rpc: "https://test.rpc.fastnear.com", explorer: "https://testnet.nearblocks.io",
  circle: ids.circle, credential: ids.credential, token: ids.token, deployedAt: new Date().toISOString(),
};
fs.writeFileSync("src/data/deployment.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote src/data/deployment.json", out);
