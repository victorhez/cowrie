import deployment from "@/data/deployment.json";

export const DEPLOY = deployment as {
  network: string; rpc: string; explorer: string;
  circle: string | null; credential: string | null; token: string | null; deployedAt: string | null;
};

export const isDeployed = () => Boolean(DEPLOY.circle && DEPLOY.credential && DEPLOY.token);

/** Read-only contract call over JSON-RPC. No wallet needed. */
export async function view<T = unknown>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(DEPLOY.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "cowrie", method: "query",
      params: { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
    }),
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error(j.result?.error ?? j.error?.data ?? j.error?.message ?? "rpc error");
  const text = new TextDecoder().decode(new Uint8Array(j.result.result));
  return JSON.parse(text) as T;
}

export interface MemberJ { id: string; position: number; collateral: string; prepaid: string; defaults: number; owed: string; on_time: number; received: boolean; removed: boolean }
export interface RoundJ { index: number; due_at: number; paid: [string, string][]; pot: string; settled: boolean; recipient: string | null; payout: string }
export interface CircleJ {
  id: number; name: string; creator: string; token: string; status: "open" | "active" | "completed" | "cancelled";
  params: { members: number; contribution: string; period_secs: number; grace_secs: number; collateral_pct: number; reserve_bps: number; tip_cap: string; random_order: boolean; min_credentials: number; discount_pct: number };
  started_at: number; members: MemberJ[]; order: string[]; rounds: RoundJ[]; reserve: string; ledger_in: string; ledger_out: string;
}
export interface SummaryJ { id: number; name: string; creator: string; status: string; members: number; joined: number; current_round: number | null }

export const usdc = (v: string | number | bigint) => (Number(v) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const short = (id: string) => (id.length > 22 ? id.slice(0, 10) + "…" + id.slice(-8) : id);
export const TGAS = (n: number) => String(BigInt(n) * 1_000_000_000_000n);
