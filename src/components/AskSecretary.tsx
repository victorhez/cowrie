"use client";

import { useState } from "react";

/** Read-only secretary for an on-chain circle. It cannot send transactions; it only reads the contract. */
export default function AskSecretary({ circle }: { circle: number }) {
  const [q, setQ] = useState("Who has not paid yet?");
  const [a, setA] = useState<{ answer: string; mode: string; note?: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr(""); setA(null);
    try {
      const r = await fetch("/api/secretary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ circle, question: q }) });
      const j = await r.json();
      if (r.ok) setA(j); else setErr(j.error ?? "Something went wrong.");
    } catch { setErr("Network problem. Try again."); }
    setBusy(false);
  };
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Ask the secretary</h3>
      <p className="mute" style={{ fontSize: 13 }}>Read-only: it answers from the live contract and cannot move funds.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} style={{ flex: 1, minWidth: 220 }} aria-label="Question" />
        <button className="btn small" onClick={go} disabled={busy || !q.trim()}>{busy ? "Asking…" : "Ask"}</button>
      </div>
      {err && <p style={{ marginTop: 8 }}>{err}</p>}
      {a && <p style={{ marginTop: 8 }}>{a.answer}<br /><span className="mute" style={{ fontSize: 12 }}>Mode: {a.mode === "model" ? "NEAR AI Cloud model" : "rules-based"}{a.note ? ` · ${a.note}` : ""}</span></p>}
    </div>
  );
}
