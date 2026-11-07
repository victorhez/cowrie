import lab from "@/data/circle-lab.json";

export const metadata = { title: "Circle Lab · Cowrie" };

interface Cell { members: number; p: number; collateralPct: number; reserveBps: number; fullPayoutRate: number; avgShortfallPct: number; recoveryPct: number }

export default function Lab() {
  const cells = lab.cells as Cell[];
  return (
    <main className="wrap" style={{ paddingTop: 60 }}>
      <div className="kicker">Circle Lab</div>
      <h2>Collateral and safety pot, <span className="lime">measured</span></h2>
      <p className="sub">
        {lab.generatedWith.circlesPerCell} simulated circles per row, driven by the real engine. Each round every member independently
        misses with the stated probability. &quot;Fully paid&quot; is the share of circles where every recipient received the entire pot.
        Real defaults are correlated, so read these as optimistic bounds. Reproduce with <code>npm run simulate</code>.
      </p>
      {[5, 10].map((n) => (
        <div key={n} style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 22, marginBottom: 12 }}>{n} members</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Default rate</th><th>Collateral</th><th>Safety pot</th><th>Circles fully paid</th><th>Avg shortfall</th><th>Recovery</th></tr></thead>
              <tbody>
                {cells.filter((c) => c.members === n).map((c, i) => (
                  <tr key={i}>
                    <td>{(c.p * 100).toFixed(0)}%</td>
                    <td>{c.collateralPct}%</td>
                    <td>{(c.reserveBps / 100).toFixed(0)}%</td>
                    <td className={c.fullPayoutRate >= 0.95 ? "yes" : c.fullPayoutRate < 0.5 ? "no" : "part"}>{(c.fullPayoutRate * 100).toFixed(1)}%</td>
                    <td>{c.avgShortfallPct.toFixed(2)}%</td>
                    <td>{c.recoveryPct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </main>
  );
}
