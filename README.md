# Cowrie

**Savings circles on NEAR, where the rules are code and the history is proof.**

Built at NEAR HACKATHON 2026 (Nov 1 to Nov 14). Tracks: Social Money, Real-World Money, NFTs That Do Something.

Live demo (no wallet needed): https://cowrie-rho.vercel.app

> **Status in one line:** the rules run on NEAR testnet today (three Rust contracts, a complete circle played on-chain, results logged in [`docs/testnet-run.log`](docs/testnet-run.log)), backed by a reference engine, property tests and a published simulation. The wallet buttons in the web app are wired but not yet tested with a real wallet, and gas sponsorship, the NEAR AI Cloud secretary, the score API and mainnet are pending. See [What works and what is pending](#what-works-and-what-is-pending).

## What it is

A rotating savings circle (ROSCA) is a group where everyone pays a fixed amount each period and one member takes the whole pot each round, until everyone has received it once. It is called *ajo* or *esusu* in Nigeria, *susu* in Ghana, *tanda* in Latin America, *chama* or *stokvel* elsewhere in Africa.

Cowrie is a protocol and app that runs the circle through a contract instead of a notebook:

- the contract holds the money; no organizer does
- the contract enforces the schedule and slashes the collateral of members who miss a payment
- a safety pot, funded by a small share of each contribution, covers shortfalls after collateral
- anyone can settle a round after its deadline and earns a small tip, so the circle keeps moving
- on completion each member receives a non-transferable credential recording rounds, on-time payments and defaults; the credential lowers the collateral required in future circles

## The problem

Circles run on trust and record-keeping by hand. Four failures recur:

1. A member stops paying and nothing enforces the rule.
2. The organizer who holds the pot disappears with it.
3. Members who have already received their payout stop contributing.
4. Years of reliable saving leave no portable proof that a bank, lender or the next circle can read.

Cowrie targets each of these directly. Collateral and the safety pot are not set by guesswork: they come from a published Monte Carlo study (Circle Lab) run through the same engine that defines the rules.

## What works and what is pending

| Area | State | Notes |
|---|---|---|
| Circle rules engine (`src/engine/circle.ts`) | Done | join, leave, cancel, start, contribute, prepay/autopay, settle, defaults, slashing, safety pot, offsets, two-default removal, seat transfer, finish, credentials, score |
| NEAR contracts: `circle`, `credential` (soulbound), `mock-usdc` | Done, on testnet | Rust, near-sdk 5. See [`docs/CONTRACTS.md`](docs/CONTRACTS.md) |
| Contract rules match the reference engine | Done | Rust engine replays 300 generated scenarios (2,073 settled rounds) with identical payouts, recipients, balances and ledgers |
| Full circle on testnet | Done | `npm run demo`: slash, tip, finish, credentials, soulbound check, collateral discount |
| Unit and property tests (TypeScript) | Done | 20 unit tests; property tests on 5,500 random circles |
| Circle Lab simulator and recommender | Done | 72 configurations (4 default rates x 3 collateral levels x 3 safety-pot levels x 2 group sizes), tables in [`docs/CIRCLE_LAB.md`](docs/CIRCLE_LAB.md) |
| Equivalence check vs independent oracle | Done | 6 of 6 scenarios match |
| Web app: landing, demo, planner, Circle Lab, status | Done | works without a wallet |
| On-chain pages `/circles`, `/circle/[id]` (read-only) | Done | read straight from the testnet contract, no wallet |
| Wallet actions (join, pay, settle, finish, create) | **Partial** | wired to the contracts with NEAR Wallet Selector; not yet exercised with a real wallet |
| Secretary, rules-based mode | Done | read-only; 30/30 on the authors' own questions but only 3/10 on 10 differently worded questions (see caveat below) |
| Cowrie Score | Done | formula in the engine and an on-chain `score` view on the credential contract |
| Sub-account-per-circle factory | Pending | v1 holds many circles in one contract; 12 members max on-chain (engine supports 24) |
| Gas for judges | Partial | faucet instructions beside every wallet action; a testnet drip endpoint (`/api/drip`) is built and turns on when the host sets `COWRIE_DRIP_ACCOUNT` and `COWRIE_DRIP_KEY`. It is a drip, not gas sponsorship; a NEP-366 relayer is roadmap |
| Secretary on NEAR AI Cloud | Partial | model mode (`/api/secretary`) is built with read-only tools and falls back to rules-based; it is off unless `NEAR_AI_API_KEY` is set and has not been run against the live API |
| Score API and MCP server | Partial | `GET /api/score/<account>` and an MCP stdio server (`npm run mcp`); x402 not built |
| NEAR Intents funding, mainnet demo, audit | Pending | stretch |

The same list is on the site at `/status`.

## Try it in 3 minutes

**No wallet, no install.**

1. Open https://cowrie-rho.vercel.app/demo and press **Play next round**. See each member pay, the pot go to the next member, and `Conservation check` read `OK`.
2. Keep pressing. In round 3 the member `dayo` misses the deadline. See: the round settles after the grace period, `dayo`'s collateral is slashed, and the recipient is still paid in full.
3. After round 5 press **Finish circle**. See: collateral and leftover safety pot returned, credentials minted, a Cowrie Score on each member card.
4. Open `/circles`, then a circle. See: a real circle read from the NEAR testnet contract (members, rounds, payouts, a ledger that balances), no wallet needed.
5. Open `/create`, change the group size and trust level. See: recommended collateral and safety pot from the simulation, and the share of simulated circles that pay every pot in full.

**Run the whole thing on NEAR testnet yourself** (Node 20 or newer, nothing else; it creates its own testnet accounts):

```bash
git clone https://github.com/victorhez/cowrie
cd cowrie
npm install
MEMBERS=2 PERIOD=30 GRACE=5 npm run demo     # about 90 seconds
```

See: a circle is created, members join and lock collateral, one member misses a payment and is slashed, a keeper settles and earns a tip, the circle finishes, credentials with a Cowrie Score are minted, a credential transfer is rejected, and the returning member joins a second circle with half the collateral. `npm run demo` with no flags runs the 5-member version (about 3 minutes). A committed run is in [`docs/testnet-run.log`](docs/testnet-run.log).

The public NEAR testnet faucet limits account creation per IP address. If it refuses, wait for the limit to reset.

Run the web app locally:

```bash
npm run dev        # http://localhost:3000
```

## Verify the claims

| Claim | Command | Expected output |
|---|---|---|
| Rules behave as specified (TypeScript) | `npm test` | 20 tests passed |
| Invariants hold on random circles | `npm run fuzz` | 2 tests passed (5,000 circles up to 12 members; 500 up to 24 members), about 35 s |
| Contracts match the reference engine | `cd contracts && cargo test --release` | `replayed 300 vectors, 2073 settled rounds, all identical to the TypeScript engine`; 6 more unit tests pass |
| Vectors are reproducible | `npm run vectors` | rewrites `contracts/circle/tests/vectors.json` identically |
| Collateral and safety-pot recommendations | `npm run simulate` | prints the recommendation table; rewrites `docs/CIRCLE_LAB.md` and `src/data/circle-lab.json` |
| Engine matches an independent oracle | `npm run equivalence` | `All 6 scenarios match.` |
| Secretary answers correctly | `npm run eval:secretary` | `33/40 correct = 82.5%` (30/30 original, 3/10 extra; misses listed) |
| Full circle on testnet | `npm run demo` | see above |
| Contracts build to wasm | `npm run build:contracts` | wasm files in `contracts/out/` (Rust with the `wasm32-unknown-unknown` target) |

Results from the last run on the submitted commit:

| Suite | Result |
|---|---|
| TypeScript unit tests | 20 / 20 passed |
| Property tests | 2 / 2 passed (5,500 random circles) |
| Rust: engine vs TypeScript vectors | 1 / 1 passed (300 scenarios, 2,073 settled rounds, identical) |
| Rust: credential and mock-usdc unit tests | 6 / 6 passed |
| Equivalence scenarios | 6 / 6 matched |
| Secretary eval | 30 / 30 on the original questions; 3 / 10 on the extra questions (misses published by the script) |
| Testnet run (2-member, `docs/testnet-run.log`) | passed: slash 100, tip 1, payouts 198 and 196, funds left in circle 0, scores 720 and 270, soulbound transfer rejected, discounted collateral 50 vs 100 |
| Production build and type check | passed |
| Browser check: `/demo` three rounds, and `/circle/2` read from testnet | passed |

**Bug found by the testnet run.** The first on-chain run failed in a round that paid both a recipient and a settler tip: NEAR does not allow a function to return a joint promise. The unit tests could not catch it because it depends on the runtime. It was fixed by firing the transfers as independent receipts, the contract was redeployed, and the run above passed. Circle #1 on the live contract is an abandoned 5-member run (its test accounts ran out of testnet NEAR for gas in round 1) and circle #3 is the open circle left by the discount step of the demo. Circles cannot be deleted, so both stay listed.

**Caveats.** The original 30 secretary questions were written by the same authors who wrote the answerer, so 100% shows no regressions, not general language ability. 10 extra questions worded differently (written by an AI, not by a human third party) score 3/10; the rules-based secretary only matches known phrasings. The property-test harness drives the engine with random behaviour; it does not replace formal verification or an audit. The wallet buttons in the web app have not been tested with a real wallet. On-chain runs so far use 2 members; the 5-member on-chain path ran through round 2 before the fix, and the 12-member gas path was not exercised.

## Circle Lab

`npm run simulate` runs thousands of circles through the real engine for group sizes 5 and 10, per-round default rates of 2%, 5%, 10% and 20%, collateral of 0%, 50% and 100%, and safety-pot shares of 0%, 2% and 5%. Each round every member independently misses with the stated probability. Full tables: [`docs/CIRCLE_LAB.md`](docs/CIRCLE_LAB.md).

Selected rows, 5 members, 10% per-round default rate:

| Collateral | Safety pot | Circles where every pot is paid in full | Average shortfall |
|---|---|---|---|
| 0% | 0% | 7.6% | 12.40% |
| 50% | 0% | 97.5% | 0.10% |
| 100% | 0% | 100.0% | 0.00% |

What the tables say: collateral does most of the work; the safety pot is a smaller improvement that matters most when collateral is low. Defaults are modelled as independent, while real groups default together in a bad month, so treat the numbers as optimistic bounds.

## How NEAR is used

| NEAR feature | Role | State |
|---|---|---|
| Smart contracts (Rust, near-sdk 5) | circle rules, credential, test token | Deployed to testnet |
| NEP-141 fungible token (`ft_transfer_call`) | contributions, collateral and prepaid balances arrive as token transfers with a JSON message; payouts leave as `ft_transfer` | Done |
| NEP-171-style soulbound token | credential; `nft_transfer` always panics; only the circle contract can mint | Done |
| Cross-contract calls and callbacks | join checks `credential_count` for the collateral discount; finish mints credentials | Done |
| NEP-297 events | structured logs for every state change | Done |
| NEAR Wallet Selector | wallet connection in the web app | Wired, untested with a real wallet |
| Sub-account per circle, NEP-366 meta transactions, NEAR AI Cloud, Intents | see roadmap | Pending |

Deployed on testnet:

| Contract | Account |
|---|---|
| circle | `cto4o69.cowrie-circle-b07415.testnet` |
| credential | `cowrie-cred-b07415.testnet` |
| mock-usdc (test token, 6 decimals, capped faucet) | `cowrie-usdc-b07415.testnet` |

## Architecture

```
src/engine/circle.ts      reference rules engine (pure, deterministic)
src/engine/secretary.ts   read-only question answering over circle state
src/engine/demo.ts        seeded demo circle with accelerated rounds
src/app/                  Next.js app: /, /demo, /circles, /circle/[id], /create, /lab, /status
contracts/circle          Rust circle contract; engine.rs is the rules port
contracts/credential      Rust soulbound credential
contracts/mock-usdc       Rust test token
contracts/out/            compiled wasm of the deployed contracts
scripts/                  build, deploy and testnet demo scripts
tools/simulate/           Circle Lab and equivalence check
tools/gen-vectors.ts      test vectors for the Rust engine
tools/secretary-eval/     30-question eval
tests/                    unit tests and property-test harness
docs/                     RULES.md, CIRCLE_LAB.md, SUBMISSION.md
```

Rules summary and the mapping from invariants to tests: [`docs/RULES.md`](docs/RULES.md).

## Who can touch the testnet contracts

The circle contract has no admin withdrawal function, but its deploy account key is held by the author (testnet only). The credential contract has one owner who can set the minter. Details and what was and was not reviewed: [`docs/security-notes.md`](docs/security-notes.md). "Same rules on NEAR" means: join, contribute, settle, defaults, slashing, safety pot, tip and credentials run on-chain; seat transfer, exit and prepaid autopay exist in the engine and contract code but are not yet verified on-chain.

## Gas

Members pay gas themselves. Get free testnet NEAR from https://near-faucet.io/ . There is no sponsorship or relayer. If the host sets `COWRIE_DRIP_ACCOUNT` and `COWRIE_DRIP_KEY` (secrets, never in the repo), a "Get test funds" button appears and `POST /api/drip` sends 0.1 testnet NEAR and 1,000 mock-usdc to an existing testnet account, limited to one per account and five per IP per day, with `COWRIE_DRIP_DISABLED=1` as a kill switch. Limits are kept per server instance. This is a testnet drip, not gas sponsorship.

## Score API, MCP server and secretary model mode

- Score: `GET /api/score/<account>.testnet` returns the Cowrie Score, the credentials and the formula terms, read from the credential contract.
- MCP (stdio, read-only, no keys): `npm run mcp`. Client config:
  ```json
  { "mcpServers": { "cowrie": { "command": "npx", "args": ["tsx", "tools/mcp/server.ts"], "cwd": "/path/to/cowrie" } } }
  ```
  Tools: `cowrie_score` and `cowrie_circle_status`. The handshake and tool list were tested locally; live chain reads need network access to the NEAR RPC.
- Secretary: `POST /api/secretary {circle, question}`. With `NEAR_AI_API_KEY` set it calls the OpenAI-compatible NEAR AI Cloud API (`https://cloud-api.near.ai/v1`, model chosen from `/models` at runtime unless `NEAR_AI_MODEL` is set) with read-only tools and answers only from their output; with no key, or on any failure, it uses the rules-based secretary. It has no tool that signs or sends a transaction. It has not been run against the live API, and no recorded fixtures exist yet because no key was available.

## Comparison with related projects

Based on each project's public page as read in November 2026. I did not run their products or read their code.

| | AjoAI (Celo) | ROSA (Arbitrum) | Cowrie |
|---|---|---|---|
| Non-custodial circle, rotating payouts | Yes | Yes | Yes (testnet) |
| Collateral with automatic slashing | Penalties | Yes | Yes (testnet) |
| Collateral chosen from published simulations | Not stated | Not stated | Yes |
| Published invariant tests | Not stated | Not stated | Yes (engine) |
| Portable credential or score | Yes | Planned | Yes: soulbound credential and on-chain score (testnet) |
| Live on a public network | Mainnet | Testnets | No |
| Yield, marketplace, proof of personhood | Not stated | Receivables marketplace and auctions | No (not built) |

AjoAI is live on mainnet and ROSA on testnets; Cowrie is on NEAR testnet only. Cowrie is not the first savings circle on a blockchain and some related projects are broader. Cowrie's difference is the measured safety margin and the credential that reduces collateral.

## Roadmap

| When | Milestone |
|---|---|
| Nov 2026 | Hackathon prototype: engine, tests, Circle Lab, app, testnet contracts and a full on-chain run. |
| Q1 2027 | Testnet beta: factory with a contract per circle and 24-member circles; gas sponsorship; real-wallet testing; pilot with 3 to 5 real groups using test funds; independent review. |
| Q2 2027 | Mainnet beta after audit, with capped circles; naira on and off ramp partners; Pidgin, Yoruba, Hausa and Igbo secretary. |
| H2 2027 | Revenue: a small protocol share of each payout set at creation and visible to members; pay-per-query Cowrie Score API for lenders; white-label circles for cooperatives and employers. |
| 2028 | Credential-backed micro-credit from third-party lenders; yield on idle balances with strict limits; cross-chain funding through NEAR Intents. |

Dates are plans. No revenue feature is live.

## Limits

- Collateral and the safety pot are not insurance. If too many members default, payouts can be short.
- Random turn order can be influenced by block producers; use creator order for anything beyond low stakes.
- The code is unaudited. Use only with people you know.
- v1 contracts cap circles at 12 members and send payouts as fire-and-forget transfers; see [`docs/CONTRACTS.md`](docs/CONTRACTS.md).
- Savings circles may be regulated where you live. This is not legal or financial advice.
- Cowrie does not hold customer funds; the contract does.

## Disclosures

- All product code was written during the hackathon window.
- Code was written with AI assistance (Claude Code) and reviewed by the author.
- Libraries (all pre-existing open source): Next.js, React, TypeScript, Vitest, fast-check, tsx, near-api-js, NEAR Wallet Selector, near-sdk and near-contract-standards (Rust; the NEP-141 token reuses `near-contract-standards`). No template or boilerplate was copied.
- No other project has been submitted from this repository.

## License

MIT. See [`LICENSE`](LICENSE).
