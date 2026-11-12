import { DEPLOY, view } from "@/lib/near";

export interface CredentialJ { token_id: string; owner_id: string; circle: string; rounds: number; on_time: number; defaults: number; issued_at: number }

/** Same formula as cowrieScore() in the engine and score_of() in the credential contract (docs/RULES.md). */
export function scoreBreakdown(creds: CredentialJ[]) {
  const rounds = creds.reduce((s, x) => s + x.rounds, 0);
  const onTime = creds.reduce((s, x) => s + x.on_time, 0);
  const defaults = creds.reduce((s, x) => s + x.defaults, 0);
  const rate = rounds ? onTime / rounds : 0;
  const volume = Math.min(1, rounds / 30);
  const penalty = Math.min(0.5, defaults * 0.1);
  const score = creds.length === 0 || rounds === 0 ? 0 : Math.max(0, Math.round(1000 * (0.7 * rate + 0.3 * volume - penalty)));
  return { score, inputs: { credentials: creds.length, rounds, onTime, defaults }, terms: { onTimeRate: rate, volume, penalty }, formula: "round(1000 * max(0, 0.7*onTimeRate + 0.3*min(1, rounds/30) - min(0.5, 0.1*defaults)))" };
}

export async function getScore(account: string) {
  const creds = await view<CredentialJ[]>(DEPLOY.credential!, "credentials_of", { account_id: account });
  const onChain = await view<number>(DEPLOY.credential!, "score", { account_id: account });
  return { account, ...scoreBreakdown(creds), onChainScore: onChain, credentialContract: DEPLOY.credential, network: DEPLOY.network, credentials: creds };
}
