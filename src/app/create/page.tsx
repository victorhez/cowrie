"use client";

import { useMemo, useState } from "react";
import lab from "../../data/circle-lab.json";
import { collateralRequired, defaultParams } from "../../engine/circle";
import { fmt } from "../../engine/secretary";

interface Cell { members: number; p: number; collateralPct: number; reserveBps: number; fullPayoutRate: number; avgShortfallPct: number }
const RISK = [
  { p: 0.02, label: "Very trusted (about 2% chance a member misses a round)" },
  { p: 0.05, label: "Friends and family (about 5%)" },
  { p: 0.1, label: "Co-workers or neighbours (about 10%)" },
  { p: 0.2, label: "Mixed or new group (about 20%)" },
];

export default function Create() {
  const [n, setN] = useState(8);
  const [amount, setAmount] = useState(50);
  const [period, setPeriod] = useState("monthly");
  const [risk, setRisk] = useState(0.05);
  const [name, setName] = useState("Market Women Ajo");

  const rec = useMemo(() => {
    const simN = n <= 7 ? 5 : 10; // tables exist for 5 and 10 members; nearest used
    const r = (lab.recommendations as Record<string, { collateralPct: number; reserveBps: number; fullPayoutRate: number; meetsTarget: boolean }>)[`${simN}:${risk}`];
    return { ...r, simN };
  }, [n, risk]);

  const [col, setCol] = useState<number | null>(null);
  const [res, setRes] = useState<number | null>(null);
  const colPct = (col ?? rec.collateralPct) as 0 | 50 | 100;
  const resBps = res ?? rec.reserveBps;
  const cell = (lab.cells as Cell[]).find((c) => c.members === rec.simN && c.p === risk && c.collateralPct === colPct && c.reserveBps === resBps);

  const p = defaultParams({ members: n, contribution: amount * 1_000_000, collateralPct: colPct, reserveBps: resBps });
  const collateral = collateralRequired(p, 0);
  const pot = n * p.contribution - Math.floor((n * p.contribution * resBps) / 10000);
  const link = `https://cowrie.vercel.app/join/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Join our savings circle "${name}" on Cowrie. ${n} members, ${amount} USDC ${period}. ${link}`)}`;

  return (
    <main className="wrap" style={{ paddingTop: 50 }}>
      <div className="kicker">Create wizard</div>
      <h2>Plan a circle that <span className="lime">won&apos;t break</span></h2>
      <div className="notice" style={{ marginBottom: 22 }}>
        <b>Planner only.</b> Deploying a circle needs the NEAR contracts, which are <b>pending</b>. The recommendations below are real, computed from the Circle Lab tables.
      </div>
      <div className="demo">
        <div className="card">
          <div className="row2">
            <div><label>Circle name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label>Members (2 to 24)</label><input type="number" min={2} max={24} value={n} onChange={(e) => setN(Math.min(24, Math.max(2, Number(e.target.value) || 2)))} /></div>
            <div><label>Contribution per round (USDC)</label><input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div><label>Period</label><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>weekly</option><option>monthly</option></select></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label>How well do members know each other?</label>
            <select value={risk} onChange={(e) => { setRisk(Number(e.target.value)); setCol(null); setRes(null); }}>
              {RISK.map((r) => <option key={r.p} value={r.p}>{r.label}</option>)}
            </select>
          </div>
          <div className="row2" style={{ marginTop: 14 }}>
            <div><label>Collateral (recommended {rec.collateralPct}%)</label>
              <select value={colPct} onChange={(e) => setCol(Number(e.target.value))}><option value={0}>0%</option><option value={50}>50%</option><option value={100}>100%</option></select></div>
            <div><label>Safety pot (recommended {rec.reserveBps / 100}%)</label>
              <select value={resBps} onChange={(e) => setRes(Number(e.target.value))}><option value={0}>0%</option><option value={200}>2%</option><option value={500}>5%</option></select></div>
          </div>
        </div>
        <div className="card hot">
          <h3>Your circle</h3>
          <div className="kv"><span>Each member locks</span><b>{fmt(collateral)} USDC</b></div>
          <div className="kv"><span>Each round pays out</span><b>{fmt(pot)} USDC</b></div>
          <div className="kv"><span>Duration</span><b>{n} {period === "weekly" ? "weeks" : "months"}</b></div>
          <div className="kv"><span>Pots paid in full</span><b>{cell ? (cell.fullPayoutRate * 100).toFixed(1) + "%" : "n/a"}</b></div>
          <div className="kv"><span>Avg shortfall when not</span><b>{cell ? cell.avgShortfallPct.toFixed(2) + "%" : "n/a"}</b></div>
          <p className="mute" style={{ fontSize: 13, margin: "12px 0" }}>
            Simulated with {rec.simN}-member tables (nearest available to {n}). {rec.meetsTarget ? "Recommended setting meets the 95% target." : "No setting reaches 95% at this risk; the best one is recommended."} Not insurance.
          </p>
          <a className="btn solid" href={wa} target="_blank" rel="noreferrer">Preview WhatsApp invite →</a>
        </div>
      </div>
    </main>
  );
}
