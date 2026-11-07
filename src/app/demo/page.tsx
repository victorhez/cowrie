"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, conserved, currentRound, cowrieScore } from "../../engine/circle";
import { newDemo, stepDemo, DEMO_NAMES } from "../../engine/demo";
import { answer, fmt } from "../../engine/secretary";

const SUGGEST = [
  "Whose turn is it?",
  "Who has not paid yet?",
  "What happens if I miss a payment?",
  "How much is the pot?",
  "Can you send my funds to someone?",
];

export default function Demo() {
  const circle = useRef<Circle>(newDemo());
  const clock = useRef({ t: 0 });
  const [, setV] = useState(0);
  const [note, setNote] = useState("The circle is active. Round 1 is open.");
  const [auto, setAuto] = useState(false);
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [q, setQ] = useState("");
  const bump = () => setV((x) => x + 1);

  const c = circle.current;
  const r = currentRound(c);

  const step = () => {
    try {
      setNote(stepDemo(c, clock.current));
    } catch (e) {
      setNote(String(e));
    }
    bump();
  };
  const reset = () => {
    circle.current = newDemo();
    clock.current = { t: 0 };
    setChat([]);
    setAuto(false);
    setNote("Reset. Round 1 is open.");
    bump();
  };
  useEffect(() => {
    if (!auto) return;
    if (c.status === "completed") { setAuto(false); return; }
    const id = setTimeout(step, 1400);
    return () => clearTimeout(id);
  });

  const ask = (text: string) => {
    if (!text.trim()) return;
    setChat((h) => [...h, { q: text, a: answer(c, text, clock.current.t) }]);
    setQ("");
  };

  const done = c.rounds.filter((x) => x.settled).length;
  const slashed = c.events.filter((e) => e.kind === "slashed");
  const log = [...c.events].reverse().slice(0, 40);

  return (
    <main className="wrap" style={{ paddingTop: 50 }}>
      <div className="kicker">Live demo · no wallet needed</div>
      <h2>Watch a circle <span className="lime">enforce itself</span></h2>
      <div className="notice" style={{ marginBottom: 20 }}>
        <b>Labelled simulation.</b> This runs Cowrie&apos;s reference engine in your browser with accelerated 2-minute rounds and test
        amounts. The NEAR smart contracts are <b>pending</b>, so nothing here touches a blockchain.
      </div>

      <div className="card" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <b className="display lime" style={{ fontSize: 18 }}>
            {c.status === "completed" ? "Circle complete" : `Round ${(r?.index ?? 0) + 1} of ${c.params.members}`}
          </b>
          <p className="mute" style={{ fontSize: 14 }}>{note}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn solid" onClick={step} disabled={c.status === "completed" && !r}>
            {r ? "Play next round" : c.status === "completed" ? "Done" : "Finish circle"}
          </button>
          <button className="btn" onClick={() => setAuto((a) => !a)} disabled={c.status === "completed"}>{auto ? "Pause" : "Auto-play"}</button>
          <button className="btn" onClick={reset}>Reset</button>
        </div>
      </div>
      <div className="bar" style={{ margin: "16px 0 22px" }}><i style={{ width: `${(done / c.params.members) * 100}%` }} /></div>

      <div className="tiles">
        {c.members.map((m) => {
          const isTurn = r && !m.received && !m.removed && c.order.find((id) => { const mm = c.members.find((x) => x.id === id)!; return !mm.received && !mm.removed; }) === m.id;
          const paid = r ? r.paid[m.id] : undefined;
          return (
            <div key={m.id} className={`tile ${isTurn ? "turn" : ""} ${m.removed ? "removed" : ""}`}>
              <div className="avatar">{m.id[0].toUpperCase()}</div>
              <h4>{m.id.split(".")[0]}</h4>
              <div className="row"><span>Turn</span><span>#{m.position + 1}</span></div>
              <div className="row"><span>Collateral</span><span>{fmt(m.collateral)}</span></div>
              <div className="row"><span>Defaults</span><span style={{ color: m.defaults ? "var(--warn)" : undefined }}>{m.defaults}</span></div>
              {c.status === "completed" ? (
                <span className="pill ok">Score {cowrieScore(c.credentials.filter((x) => x.member === m.id))}</span>
              ) : m.received ? (
                <span className="pill rec">Received</span>
              ) : isTurn ? (
                <span className="pill wait">Next to receive</span>
              ) : paid ? (
                <span className="pill ok">Paid</span>
              ) : (
                <span className="pill no">Not paid</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="demo">
        <div className="grid">
          <div className="card">
            <h3>Ledger (public to every member)</h3>
            <div className="kv"><span>Safety pot</span><b>{fmt(c.reserve)} USDC</b></div>
            <div className="kv"><span>Tokens in</span><b>{fmt(c.ledger.in)}</b></div>
            <div className="kv"><span>Tokens out</span><b>{fmt(c.ledger.out)}</b></div>
            <div className="kv"><span>Conservation check (in = out + held)</span><b>{conserved(c) ? "OK" : "BROKEN"}</b></div>
            <div className="kv"><span>Slashed so far</span><b>{fmt(slashed.reduce((s, e) => s + (e.amount as number), 0))} USDC</b></div>
          </div>
          <div className="card">
            <h3>Event log</h3>
            <div className="log">
              {log.map((e, i) => (
                <div key={i} className={`k-${e.kind}`}>
                  <b>{e.kind.replace("_", " ")}</b>{" "}
                  {Object.entries(e).filter(([k]) => !["t", "kind", "order"].includes(k)).map(([k, v]) => `${k}: ${typeof v === "number" && v > 100000 ? fmt(v) : String(v).replace(".testnet", "")}`).join(" · ")}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Ask the secretary</h3>
          <p className="mute" style={{ fontSize: 13 }}>Read-only. Rules-based mode: answers come from the circle&apos;s state, and it has no way to move funds.</p>
          <div className="sugg">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          <div className="chat">
            {chat.map((m, i) => (
              <div key={i} style={{ display: "grid", gap: 6 }}>
                <div className="msg q">{m.q}</div>
                <div className="msg a">{m.a}</div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`e.g. Has ${DEMO_NAMES[2]} received the pot?`} />
            <button className="btn solid small" type="submit">Ask</button>
          </form>
        </div>
      </div>
    </main>
  );
}
