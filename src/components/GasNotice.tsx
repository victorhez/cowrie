"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/Wallet";

/** Tells the user how to get gas. Offers a one-click testnet drip when the server has one configured. */
export default function GasNotice() {
  const { accountId } = useWallet();
  const [drip, setDrip] = useState<boolean>(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/drip").then((r) => r.json()).then((j) => setDrip(Boolean(j.enabled))).catch(() => setDrip(false)); }, []);

  const get = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: accountId }) });
      const j = await r.json();
      setMsg(r.ok ? `Sent ${j.sent.near} testnet NEAR and ${j.sent.mockUsdc} mock-usdc to ${accountId}. This is a testnet drip, not gas sponsorship.` : j.error);
    } catch { setMsg("Network problem. Try again."); }
    setBusy(false);
  };

  return (
    <div className="notice" style={{ marginBottom: 16 }}>
      <b>You need a little testnet NEAR for gas.</b> Cowrie does not sponsor gas (a real relayer is on the roadmap).{" "}
      {drip
        ? <>Press the button to get test funds from the Cowrie testnet drip (limited to one per account per day). </>
        : <>Get free testnet NEAR from the <a className="lime" href="https://near-faucet.io/" target="_blank" rel="noreferrer">NEAR testnet faucet</a>, then use <b>Get test mock-usdc</b> on a circle page. </>}
      Test funds have no value.
      {drip && accountId && <> <button className="btn small" onClick={get} disabled={busy}>{busy ? "Sending…" : "Get test funds"}</button></>}
      {drip && !accountId && <> Connect a wallet first.</>}
      {msg && <div style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
