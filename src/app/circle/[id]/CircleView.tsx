"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleJ, DEPLOY, TGAS, isDeployed, short, usdc, view } from "@/lib/near";
import { useWallet } from "@/components/Wallet";
import GasNotice from "@/components/GasNotice";
import { checkOutcome, friendly, returnedFromWallet, txLink } from "@/lib/tx";
import AskSecretary from "@/components/AskSecretary";

export default function CircleView({ id }: { id: number }) {
  const { accountId, call, connect } = useWallet();
  const [c, setC] = useState<CircleJ | null | undefined>(undefined);
  const [canSettle, setCanSettle] = useState(false);
  const [conserved, setConserved] = useState<boolean | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [msg, setMsg] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  useEffect(() => { const r = returnedFromWallet(); if (r.error) setMsg(friendly(r.error)); else if (r.hash) { setMsg("Your wallet sent the transaction. Refreshing…"); setTxHash(r.hash); } }, []);
  const [loadErr, setLoadErr] = useState(false);
  const [prepay, setPrepay] = useState(10);

  const load = useCallback(async () => {
    if (!isDeployed()) return;
    try {
      const x = await view<CircleJ | null>(DEPLOY.circle!, "get_circle", { circle: id });
      setC(x);
      setCanSettle(await view<boolean>(DEPLOY.circle!, "can_settle", { circle: id }));
      setConserved(await view<boolean>(DEPLOY.circle!, "conserved", { circle: id }));
      setLoadErr(false);
    } catch { setLoadErr(true); }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => { load(); setNow(Math.floor(Date.now() / 1000)); }, 5000);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [load]);

  if (!isDeployed()) return <main className="wrap" style={{ paddingTop: 50 }}><div className="notice">Contracts are not configured in this build.</div></main>;
  if (c === undefined) return (
    <main className="wrap" style={{ paddingTop: 50 }}>
      {loadErr ? <div className="notice">Could not read circle {id} from the NEAR testnet RPC. It may be slow or down. <button className="btn small" onClick={load}>Try again</button></div> : <>Loading circle {id} from testnet…</>}
    </main>
  );
  if (c === null) return <main className="wrap" style={{ paddingTop: 50 }}><div className="notice">Circle {id} does not exist.</div></main>;

  const p = c.params;
  const cur = c.rounds.find((r) => !r.settled);
  const me = c.members.find((m) => m.id === accountId);
  const done = c.rounds.filter((r) => r.settled).length;

  const run = (label: string, fn: () => Promise<unknown>) => async () => {
    if (!accountId) return connect();
    setMsg(label + ": waiting for your wallet. Approve it in the wallet window (check for a blocked pop-up).");
    try {
      const hash = checkOutcome(await fn());
      setMsg(label + " done. Refreshing…"); setTxHash(hash); setTimeout(load, 4000);
    } catch (e) { setTxHash(null); setMsg(friendly(e)); }
  };

  const ftCall = (amount: string, m: object) => call(DEPLOY.token!, "ft_transfer_call", { receiver_id: DEPLOY.circle, amount, msg: JSON.stringify(m) }, { deposit: "1", gas: TGAS(150) });

  const faucet = run("Getting 1,000 mock-usdc", () => call(DEPLOY.token!, "faucet", { account_id: accountId, amount: "1000000000" }, { gas: TGAS(30) }));
  const join = run("Joining", async () => {
    const creds = await view<number>(DEPLOY.credential!, "credential_count", { account_id: accountId });
    const req = await view<string>(DEPLOY.circle!, "collateral_required", { circle: id, credentials: creds });
    return ftCall(req, { action: "join", circle: id });
  });
  const contribute = run("Contributing", () => ftCall(p.contribution, { action: "contribute", circle: id, round: cur!.index }));
  const doPrepay = run("Prepaying", () => ftCall(String(Math.round(prepay * 1e6)), { action: "prepay", circle: id }));
  const settle = run("Settling", () => call(DEPLOY.circle!, "settle", { circle: id }, { gas: TGAS(200) }));
  const finish = run("Finishing", () => call(DEPLOY.circle!, "finish", { circle: id }, { gas: TGAS(300) }));
  const leave = run("Leaving", () => call(DEPLOY.circle!, "leave", { circle: id }, { gas: TGAS(60) }));

  const secsLeft = cur ? cur.due_at - now : 0;

  return (
    <main className="wrap" style={{ paddingTop: 50 }}>
      <GasNotice />
      <div className="kicker">Circle #{c.id} · public view, no wallet needed</div>
      <h2>{c.name}</h2>
      <p className="sub">
        {p.members} members · {usdc(p.contribution)} mock-usdc per round · {p.collateral_pct}% collateral · {p.reserve_bps / 100}% safety pot · created by {short(c.creator)} ·{" "}
        <a className="lime" href={`${DEPLOY.explorer}/address/${DEPLOY.circle}`} target="_blank" rel="noreferrer">contract</a>
      </p>

      <div className="card" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <b className="display lime" style={{ fontSize: 18 }}>{c.status === "open" ? `Open: ${c.members.length}/${p.members} seats filled` : c.status === "active" ? `Round ${(cur?.index ?? 0) + 1} of ${p.members}` : c.status}</b>
          {cur && <p className="mute" style={{ fontSize: 14 }}>{secsLeft > 0 ? `Due in ${secsLeft}s` : canSettle ? "Past deadline and grace: anyone can settle now." : "In grace period."}</p>}
          {msg && <p style={{ fontSize: 13, marginTop: 4 }}>{msg}{txHash && <> <a className="lime" href={txLink(txHash)} target="_blank" rel="noreferrer">View transaction</a></>}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn small" onClick={faucet}>Get test mock-usdc</button>
          {c.status === "open" && !me && <button className="btn solid small" onClick={join}>Join circle</button>}
          {c.status === "open" && me && <button className="btn small" onClick={leave}>Leave</button>}
          {c.status === "active" && me && cur && !cur.paid.some(([m]) => m === me.id) && <button className="btn solid small" onClick={contribute}>Pay this round</button>}
          {c.status === "active" && <button className="btn small" onClick={settle} disabled={!canSettle}>Settle round</button>}
          {c.status === "active" && done === p.members && <button className="btn solid small" onClick={finish}>Finish circle</button>}
        </div>
      </div>
      <div className="bar" style={{ margin: "16px 0 22px" }}><i style={{ width: `${(done / p.members) * 100}%` }} /></div>

      <div className="tiles">
        {c.members.map((m) => {
          const paid = cur?.paid.find(([id2]) => id2 === m.id)?.[1];
          return (
            <div key={m.id} className={`tile ${m.removed ? "removed" : ""}`}>
              <div className="avatar">{m.id[0].toUpperCase()}</div>
              <h4 style={{ textTransform: "none", wordBreak: "break-all" }}>{short(m.id)}</h4>
              <div className="row"><span>Turn</span><span>{m.position >= 0 ? "#" + (m.position + 1) : "-"}</span></div>
              <div className="row"><span>Collateral</span><span>{usdc(m.collateral)}</span></div>
              <div className="row"><span>Defaults</span><span style={{ color: m.defaults ? "var(--warn)" : undefined }}>{m.defaults}</span></div>
              {m.received ? <span className="pill rec">Received</span> : paid ? <span className="pill ok">{paid === "direct" ? "Paid" : paid}</span> : c.status === "active" ? <span className="pill no">Not paid</span> : null}
            </div>
          );
        })}
      </div>

      <AskSecretary circle={id} />

      <div className="demo">
        <div className="card">
          <h3>Rounds</h3>
          <div className="tablewrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>#</th><th>Due</th><th>Recipient</th><th>Paid out</th></tr></thead>
              <tbody>
                {c.rounds.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    <td>{new Date(r.due_at * 1000).toLocaleString()}</td>
                    <td>{r.settled ? (r.recipient ? short(r.recipient) : "none eligible") : "pending"}</td>
                    <td>{r.settled ? usdc(r.payout) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Ledger</h3>
          <div className="kv"><span>Safety pot</span><b>{usdc(c.reserve)}</b></div>
          <div className="kv"><span>Tokens in</span><b>{usdc(c.ledger_in)}</b></div>
          <div className="kv"><span>Tokens out</span><b>{usdc(c.ledger_out)}</b></div>
          <div className="kv"><span>Conservation (in = out + held)</span><b>{conserved === null ? "…" : conserved ? "OK" : "BROKEN"}</b></div>
          {me && c.status !== "completed" && (
            <div style={{ marginTop: 14 }}>
              <label>Prepay for autopay (mock-usdc)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" min={1} value={prepay} onChange={(e) => setPrepay(Number(e.target.value))} />
                <button className="btn small" onClick={doPrepay}>Prepay</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
