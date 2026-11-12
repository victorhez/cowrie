"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEPLOY, SummaryJ, isDeployed, view, short } from "@/lib/near";
import { useWallet } from "@/components/Wallet";
import GasNotice from "@/components/GasNotice";
import { checkOutcome, friendly, returnedFromWallet, txLink } from "@/lib/tx";

export default function Circles() {
  const { accountId, call, connect } = useWallet();
  const [list, setList] = useState<SummaryJ[] | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "Market Women Ajo", members: 5, amount: 10, period: 3600, grace: 600, col: 100, bps: 200, tip: 0.1 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "err"; text: string; hash?: string } | null>(null);

  const load = () => {
    if (!isDeployed()) return;
    setErr("");
    view<SummaryJ[]>(DEPLOY.circle!, "list_circles", { from_index: 0, limit: 50 }).then(setList).catch(() => setErr("Could not reach the NEAR testnet RPC. It may be slow or down."));
  };
  useEffect(load, []);
  useEffect(() => {
    const r = returnedFromWallet();
    if (r.error) setStatus({ kind: "err", text: friendly(r.error) });
    else if (r.hash) { setStatus({ kind: "ok", text: "Your wallet sent the transaction. If it succeeded, the new circle appears in the list above.", hash: r.hash }); setTimeout(load, 3000); }
  }, []);

  const create = async () => {
    if (!accountId) return connect();
    const problem =
      !f.name.trim() ? "Give the circle a name." :
      !(f.members >= 2 && f.members <= 12) ? "Members must be between 2 and 12." :
      !(f.amount > 0) ? "Contribution must be more than 0." :
      !(f.period >= 60) ? "Round length must be at least 60 seconds." :
      f.grace >= f.period ? "The grace period must be shorter than the round length." : "";
    if (problem) return setStatus({ kind: "err", text: problem });
    setBusy(true);
    setStatus({ kind: "info", text: "Waiting for your wallet. Approve the transaction in the wallet window (check for a blocked pop-up if nothing appears)." });
    const slow = setTimeout(() => setStatus({ kind: "info", text: "Still waiting for your wallet. If no window opened, allow pop-ups for this site, or press Create circle again." }), 20000);
    try {
      const out = await call(DEPLOY.circle!, "create_circle", {
        name: f.name.trim(), token: DEPLOY.token, members: f.members, contribution: String(Math.round(f.amount * 1e6)),
        period_secs: f.period, grace_secs: f.grace, collateral_pct: f.col, reserve_bps: f.bps,
        tip_cap: String(Math.round(f.tip * 1e6)), random_order: false, min_credentials: 1, discount_pct: 50,
      }, { gas: "100000000000000" });
      const hash = checkOutcome(out);
      setStatus({ kind: "ok", text: "Circle created on NEAR testnet. Refreshing the list…", hash: hash ?? undefined });
      setTimeout(load, 3000);
    } catch (e) {
      setStatus({ kind: "err", text: friendly(e) });
    } finally { clearTimeout(slow); setBusy(false); }
  };

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: Number(e.target.value) });

  return (
    <main className="wrap" style={{ paddingTop: 50 }}>
      <div className="kicker">On-chain · NEAR testnet</div>
      <h2>Circles on <span className="lime">testnet</span></h2>
      {!isDeployed() ? (
        <div className="notice">Contracts are not configured in this build.</div>
      ) : (
        <>
          <p className="sub">
            Everything below is read straight from the contract at{" "}
            <a className="lime" href={`${DEPLOY.explorer}/address/${DEPLOY.circle}`} target="_blank" rel="noreferrer">{DEPLOY.circle}</a>. No wallet is needed to look.
          </p>
          {err && <div className="notice">{err} <button className="btn small" onClick={load}>Try again</button></div>}
          <GasNotice />
          <div className="grid g3" style={{ marginBottom: 30 }}>
            {list === null ? <div className="card">{err ? "Circles could not be loaded." : "Loading circles from testnet…"}</div> : list.length === 0 ? <div className="card">No circles yet. Create the first one below.</div> :
              list.map((c) => (
                <Link key={c.id} href={`/circle/${c.id}`} className="card hot">
                  <h3>{c.name}</h3>
                  <div className="kv"><span>Status</span><b>{c.status}</b></div>
                  <div className="kv"><span>Seats</span><b>{c.joined}/{c.members}</b></div>
                  <div className="kv"><span>Round</span><b>{c.current_round === null ? "-" : c.current_round + 1}</b></div>
                  <p className="mute" style={{ fontSize: 12, marginTop: 8 }}>by {short(c.creator)}</p>
                </Link>
              ))}
          </div>
          <div className="card">
            <h3>Create a circle</h3>
            <div className="row2" style={{ marginTop: 12 }}>
              <div><label>Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div><label>Members (2 to 12)</label><input type="number" min={2} max={12} value={f.members} onChange={num("members")} /></div>
              <div><label>Contribution (mock-usdc)</label><input type="number" min={1} value={f.amount} onChange={num("amount")} /></div>
              <div><label>Round length (seconds)</label><input type="number" min={60} value={f.period} onChange={num("period")} /></div>
              <div><label>Grace period (seconds)</label><input type="number" min={0} value={f.grace} onChange={num("grace")} /></div>
              <div><label>Collateral</label><select value={f.col} onChange={num("col")}><option value={0}>0%</option><option value={50}>50%</option><option value={100}>100%</option></select></div>
              <div><label>Safety pot</label><select value={f.bps} onChange={num("bps")}><option value={0}>0%</option><option value={200}>2%</option><option value={500}>5%</option></select></div>
              <div><label>Settler tip cap (mock-usdc)</label><input type="number" min={0} step={0.1} value={f.tip} onChange={num("tip")} /></div>
            </div>
            <p className="mute" style={{ fontSize: 13, margin: "10px 0" }}>Not sure what to pick? The <Link className="lime" href="/create">planner</Link> recommends collateral and safety pot from the Circle Lab tables.</p>
            <button className="btn solid" onClick={create} disabled={busy}>{busy ? "Waiting for wallet…" : accountId ? "Create circle" : "Connect wallet to create"}</button>
            {status && (
              <div className="notice" role="status" style={{ marginTop: 14, borderColor: status.kind === "err" ? "var(--warn)" : undefined }}>
                {status.text}
                {status.hash && <> <a className="lime" href={txLink(status.hash)} target="_blank" rel="noreferrer">View transaction</a></>}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
