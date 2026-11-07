# Cowrie

**Savings circles on NEAR, where the rules are code and the history is proof.**

Built at NEAR HACKATHON 2026 (Nov 1 to Nov 14). Tracks: Social Money, Real-World Money, NFTs That Do Something.

Live demo (no wallet needed): https://cowrie.vercel.app

> **Status in one line:** the rules engine, tests, simulations and web app are working and verifiable today. The NEAR smart contracts are **not written or deployed yet**; the demo is a labelled in-browser simulation of the reference engine. See [What works and what is pending](#what-works-and-what-is-pending).

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
| Unit tests | Done | 20 passing |
| Property tests (invariants) | Done | 5,500 random circles per run, all passing |
| Circle Lab simulator and recommender | Done | 48 configurations, tables in [`docs/CIRCLE_LAB.md`](docs/CIRCLE_LAB.md) |
| Equivalence check vs independent oracle | Done | 6 of 6 scenarios match |
| Web app: landing, live demo, create planner, Circle Lab, status | Done | works without a wallet |
| Secretary, rules-based mode | Done | read-only; 30/30 on a self-authored eval (see caveat below) |
| Cowrie Score formula | Done | function and published formula; no on-chain view yet |
| NEAR contracts: factory, circle, soulbound credential, mock-usdc | **Pending** | not started; the engine is the executable specification |
| Wallet connection, testnet circle, `npm run demo` on testnet | **Pending** | blocked on contracts |
| Secretary on NEAR AI Cloud | **Pending** | rules-based mode ships now |
| Gas sponsorship (NEP-366 relayer or testnet drip) | **Pending** | |
| Score API, MCP server, x402 endpoint | **Pending** | x402 package on NEAR not yet verified |
| NEAR Intents funding, mainnet demo, audit | **Pending** | stretch |

The same list is on the site at `/status`.

## Try it in 3 minutes

1. Open the live demo at `/demo`. Press **Play next round**. See each member pay, the pot go to the next member, and the ledger line `Conservation check` read `OK`.
2. Keep pressing. In round 3 the member `dayo` misses the deadline. See: the round settles after the grace period, `dayo`'s collateral is slashed (100 USDC), and the recipient is still paid in full.
3. After round 5 press **Finish circle**. See: collateral and leftover safety pot returned, credentials minted, a Cowrie Score on each member card.
4. In **Ask the secretary** press *What happens if I miss a payment?* and *Can you send my funds to someone?*. See: answers drawn from circle state, and a refusal to move funds.
5. Open `/create`, change the group size and trust level. See: recommended collateral and safety pot, with the share of simulated circles that pay every pot in full.

Run it locally:

```bash
git clone https://github.com/victorhez/cowrie
cd cowrie
npm install
npm run dev        # http://localhost:3000
```

Requires Node 20 or newer.

## Verify the claims

| Claim | Command | Expected output |
|---|---|---|
| Rules behave as specified | `npm test` | 20 tests passed |
| Invariants hold on random circles | `npm run fuzz` | 2 tests passed (5,000 circles up to 12 members; 500 up to 24 members), about 35 s |
| Collateral and safety-pot recommendations | `npm run simulate` | prints the recommendation table and rewrites `docs/CIRCLE_LAB.md` and `src/data/circle-lab.json` (about 25 s at the default 2,000 circles per cell) |
| Engine matches an independent oracle | `npm run equivalence` | `All 6 scenarios match.` |
| Secretary answers correctly | `npm run eval:secretary` | `30/30 correct = 100.0%` |

Test results from the last run on the submitted commit:

| Suite | Result |
|---|---|
| Unit tests | 20 / 20 passed |
| Property tests | 2 / 2 passed (5,500 random circles) |
| Equivalence scenarios | 6 / 6 matched |
| Secretary eval | 30 / 30 correct |
| Production build (`next build`) and type check | passed |
| Browser check of `/demo`: three rounds played, default slashed, no console errors | passed |

**Caveats.** The secretary questions were written by the same authors who wrote the answerer, so 100% shows no regressions, not general language ability. The property-test harness drives the engine with random behaviour; it does not replace formal verification or an audit.

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
| Sub-account per circle (`<id>.cowrie.testnet`) | isolates each circle's funds | Planned |
| NEP-141 fungible token | contributions, collateral, payouts | Planned (mock-usdc for tests) |
| NEP-171 non-fungible token, transfers disabled | soulbound credential | Planned |
| Cross-contract calls | circle mints credentials on finish | Planned |
| NEP-366 meta transactions | gas sponsorship | Planned |
| NEAR AI Cloud | secretary | Planned |
| NEAR Intents | fund from other chains | Stretch |

Nothing in the NEAR column is deployed yet. This is the main gap in the current submission and the first item on the roadmap.

## Architecture

```
src/engine/circle.ts      reference rules engine (pure, deterministic)
src/engine/secretary.ts   read-only question answering over circle state
src/engine/demo.ts        seeded demo circle with accelerated rounds
src/app/                  Next.js app: /, /demo, /create, /lab, /status
tools/simulate/           Circle Lab and equivalence check
tools/secretary-eval/     30-question eval
tests/                    unit tests and property-test harness
docs/                     RULES.md, CIRCLE_LAB.md, SUBMISSION.md
```

Rules summary and the mapping from invariants to tests: [`docs/RULES.md`](docs/RULES.md).

## Comparison with related projects

Based on each project's public page as read in November 2026. I did not run their products or read their code.

| | AjoAI (Celo) | ROSA (Arbitrum) | Cowrie |
|---|---|---|---|
| Non-custodial circle, rotating payouts | Yes | Yes | Engine done, contracts pending |
| Collateral with automatic slashing | Penalties | Yes | Engine done, contracts pending |
| Collateral chosen from published simulations | Not stated | Not stated | Yes |
| Published invariant tests | Not stated | Not stated | Yes (engine) |
| Portable credential or score | Yes | Planned | Formula done, on-chain pending |
| Live on a public network | Mainnet | Testnets | No |

AjoAI and ROSA are deployed; Cowrie is not yet. Cowrie's difference is the measured safety margin and the credential that reduces collateral.

## Roadmap

| When | Milestone |
|---|---|
| Nov 2026 | Hackathon prototype: engine, tests, Circle Lab, app. Contracts and testnet flow in progress. |
| Q1 2027 | Testnet beta: factory, circle, credential and token contracts; gas sponsorship; pilot with 3 to 5 real groups using test funds; independent review. |
| Q2 2027 | Mainnet beta after audit, with capped circles; naira on and off ramp partners; Pidgin, Yoruba, Hausa and Igbo secretary. |
| H2 2027 | Revenue: a small protocol share of each payout set at creation and visible to members; pay-per-query Cowrie Score API for lenders; white-label circles for cooperatives and employers. |
| 2028 | Credential-backed micro-credit from third-party lenders; yield on idle balances with strict limits; cross-chain funding through NEAR Intents. |

Dates are plans. No revenue feature is live.

## Limits

- Collateral and the safety pot are not insurance. If too many members default, payouts can be short.
- Random turn order can be influenced by block producers; use creator order for anything beyond low stakes.
- The code is unaudited. Use only with people you know.
- Savings circles may be regulated where you live. This is not legal or financial advice.
- Cowrie does not hold customer funds; the contract does.

## Disclosures

- All product code was written during the hackathon window.
- Code was written with AI assistance (Claude Code) and reviewed by the author.
- Libraries: Next.js, React, TypeScript, Vitest, fast-check, tsx (all pre-existing open source). No template or boilerplate was copied.
- No other project has been submitted from this repository.

## License

MIT. See [`LICENSE`](LICENSE).
