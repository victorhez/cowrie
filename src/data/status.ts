export type State = "done" | "partial" | "pending";
export interface Item { id: string; name: string; state: State; note: string }

/** Single source of truth for the Status page. Mirrored in README.md. */
export const STATUS: Item[] = [
  { id: "engine", name: "Circle rules engine (reference implementation)", state: "done", note: "TypeScript state machine: join, leave, start, contribute, autopay, settle, default, slash, safety pot, offsets, skipped turns, seat transfer, finish, credentials." },
  { id: "tests", name: "Unit and property tests", state: "done", note: "20 unit tests; property tests over thousands of random circles checking conservation, one payout per round, bounded slashing, idempotence, tip cap." },
  { id: "lab", name: "Circle Lab (Monte Carlo) and recommender", state: "done", note: "Drives the real engine. 48 configurations, published tables, wizard reads them." },
  { id: "equiv", name: "Equivalence check against an independent oracle", state: "done", note: "6 scenarios compared with closed-form arithmetic." },
  { id: "web", name: "Web app: landing, demo mode, create wizard, public circle view", state: "done", note: "Runs without a wallet. Demo uses accelerated 2-minute rounds." },
  { id: "secretary-rules", name: "Secretary, rules-based mode (read-only)", state: "done", note: "30-question eval. Questions were written by the authors, so this is a regression check, not an independent benchmark." },
  { id: "score", name: "Cowrie Score formula", state: "done", note: "Published formula and function; no on-chain view yet." },
  { id: "contracts", name: "NEAR smart contracts (factory, circle, soulbound credential, mock-usdc)", state: "pending", note: "Not written or deployed yet. The engine is the executable specification they must match." },
  { id: "wallet", name: "NEAR wallet connection and testnet transactions", state: "pending", note: "Blocked on contracts." },
  { id: "ai", name: "Secretary on NEAR AI Cloud", state: "pending", note: "Rules-based mode ships now. Model mode needs an API key." },
  { id: "gas", name: "Gas sponsorship (NEP-366 relayer or testnet drip)", state: "pending", note: "Needs contracts first." },
  { id: "mcp", name: "Score API, MCP server, x402 endpoint", state: "pending", note: "x402 package on NEAR not yet verified." },
  { id: "intents", name: "Fund from any chain with NEAR Intents", state: "pending", note: "Stretch goal." },
  { id: "mainnet", name: "Mainnet demo circle and security audit", state: "pending", note: "Only after contracts are tested and reviewed." },
];
