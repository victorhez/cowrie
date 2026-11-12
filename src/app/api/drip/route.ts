import { NextResponse } from "next/server";
import { DEPLOY } from "@/lib/near";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Testnet drip (NOT gas sponsorship): sends a little testnet NEAR and mock-usdc to an existing testnet account.
 * Configure with host environment variables (never in the repo):
 *   COWRIE_DRIP_ACCOUNT  funded testnet account id, kept small
 *   COWRIE_DRIP_KEY      its ed25519 secret key
 *   COWRIE_DRIP_DISABLED set to "1" to switch the endpoint off (kill switch)
 *   COWRIE_DRIP_NEAR     amount of NEAR per drip (default 0.1)
 * Without COWRIE_DRIP_ACCOUNT and COWRIE_DRIP_KEY the endpoint reports "not configured" and the app shows faucet instructions.
 * Limits: one drip per account per 24 h and 5 per IP per 24 h. Counters are per server instance (best effort).
 */
const DAY = 86_400_000;
const byAccount = new Map<string, number>();
const byIp = new Map<string, number[]>();
const ID = /^[a-z0-9][a-z0-9._-]{1,63}\.testnet$|^[0-9a-f]{64}$/;

const enabled = () => process.env.COWRIE_DRIP_DISABLED !== "1" && Boolean(process.env.COWRIE_DRIP_ACCOUNT && process.env.COWRIE_DRIP_KEY);

export async function GET() {
  return NextResponse.json({ enabled: enabled(), method: "testnet drip (not gas sponsorship)", near: process.env.COWRIE_DRIP_NEAR ?? "0.1" });
}

export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ error: "The drip is not available right now. Use the testnet faucet instead." }, { status: 503 });
  let account = "";
  try { account = String((await req.json()).account ?? "").trim().toLowerCase(); } catch { /* fall through */ }
  if (!ID.test(account)) return NextResponse.json({ error: "Enter a testnet account id ending in .testnet." }, { status: 400 });

  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (now - (byAccount.get(account) ?? 0) < DAY) return NextResponse.json({ error: "This account already got a drip in the last 24 hours." }, { status: 429 });
  const hits = (byIp.get(ip) ?? []).filter((t) => now - t < DAY);
  if (hits.length >= 5) return NextResponse.json({ error: "Too many drips from this network today." }, { status: 429 });

  try {
    const { Account, KeyPair, KeyPairSigner, providers } = await import("near-api-js");
    const provider = new providers.JsonRpcProvider({ url: DEPLOY.rpc });
    const drip = new Account(process.env.COWRIE_DRIP_ACCOUNT!, provider, new KeyPairSigner(KeyPair.fromString(process.env.COWRIE_DRIP_KEY! as never)));
    // The account must already exist: it is the judge's own wallet account.
    await provider.query({ request_type: "view_account", finality: "final", account_id: account });
    byAccount.set(account, now); byIp.set(ip, [...hits, now]); // reserve first so double clicks cannot double drip
    const near = BigInt(Math.round(Number(process.env.COWRIE_DRIP_NEAR ?? "0.1") * 1e6)) * 10n ** 18n;
    await drip.sendMoney(account, near);
    await drip.functionCall({ contractId: DEPLOY.token!, methodName: "faucet", args: { account_id: account, amount: "1000000000" }, gas: 30_000_000_000_000n, attachedDeposit: 0n });
    return NextResponse.json({ ok: true, sent: { near: process.env.COWRIE_DRIP_NEAR ?? "0.1", mockUsdc: "1000" }, note: "Testnet drip, not gas sponsorship." });
  } catch (e) {
    byAccount.delete(account);
    const m = String(e);
    if (/does not exist|UNKNOWN_ACCOUNT/i.test(m)) return NextResponse.json({ error: "That testnet account does not exist yet. Create it in your wallet first." }, { status: 404 });
    if (/cap reached/i.test(m)) return NextResponse.json({ error: "This account already received the maximum mock-usdc." }, { status: 429 });
    return NextResponse.json({ error: "The drip failed. Try the testnet faucet instead." }, { status: 502 });
  }
}
