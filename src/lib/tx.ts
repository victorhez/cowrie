import { DEPLOY } from "@/lib/near";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Turn raw wallet/RPC/contract errors into plain-language messages. */
export function friendly(e: unknown): string {
  const s = typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
  if (/storage_deposit|not registered|is not registered/i.test(s)) return "This account is not registered on the token yet. Press 'Get test mock-usdc' first.";
  if (/NotEnoughBalance|not enough (balance|tokens|funds)|insufficient|LackBalanceForState|exceeded the prepaid gas|GasExceeded/i.test(s)) return "Not enough testnet NEAR or tokens for this step. Get test funds (see the notice at the top of the page), then try again.";
  if (/reject|denied|cancel|declin|user closed|User closed/i.test(s)) return "The request was cancelled in the wallet. Nothing was sent.";
  if (/at most 12 members/i.test(s)) return "The contract supports at most 12 members per circle.";
  if (/name too long/i.test(s)) return "That name is too long (80 characters at most).";
  if (/network|fetch|timeout|Failed to fetch/i.test(s)) return "Network problem. Check your connection and try again.";
  if (/popup|blocked/i.test(s)) return "Your browser blocked the wallet window. Allow pop-ups for this site and try again.";
  return "That did not go through: " + s.slice(0, 220);
}

export const txLink = (hash: string) => `${DEPLOY.explorer}/txns/${hash}`;

/** Inspect a wallet outcome. Returns the tx hash, or throws if the transaction or any receipt failed. */
export function checkOutcome(o: any): string | null {
  if (!o || typeof o !== "object") return null; // redirect wallets return nothing; the result arrives on page return
  const fail = (x: any) => x?.status && typeof x.status === "object" && "Failure" in x.status;
  if (fail(o) || (o.receipts_outcome ?? []).some((r: any) => fail(r.outcome))) {
    const f = JSON.stringify(o.status?.Failure ?? (o.receipts_outcome ?? []).map((r: any) => r.outcome?.status?.Failure).filter(Boolean)[0] ?? "failed");
    throw new Error(f);
  }
  return o.transaction?.hash ?? o.transaction_outcome?.id ?? null;
}

/** Read what a redirect-style wallet (e.g. MyNearWallet) appended to the URL when it sent the user back. */
export function returnedFromWallet(): { hash?: string; error?: string } {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const hash = q.get("transactionHashes")?.split(",").pop() ?? undefined;
  const error = q.get("errorMessage") ?? q.get("errorCode") ?? undefined;
  if (hash || error) window.history.replaceState({}, "", window.location.pathname);
  return { hash, error: error ? decodeURIComponent(error) : undefined };
}
