import { STATUS } from "@/data/status";

export const metadata = { title: "Build status · Cowrie" };

export default function Status() {
  const d = STATUS.filter((s) => s.state === "done").length;
  return (
    <main className="wrap" style={{ paddingTop: 60 }}>
      <div className="kicker">Build status</div>
      <h2>{d} of {STATUS.length} items <span className="lime">shipped</span></h2>
      <p className="sub">Every claim on this site maps to a row below. Pending means it does not exist yet.</p>
      <div className="bar" style={{ marginBottom: 28 }}><i style={{ width: `${(d / STATUS.length) * 100}%` }} /></div>
      <div className="grid">
        {STATUS.map((s) => (
          <div className={`card ${s.state === "done" ? "" : ""}`} key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 17 }}>{s.name}</h3>
              <p>{s.note}</p>
            </div>
            <span className={`pill ${s.state === "done" ? "ok" : "wait"}`} style={{ alignSelf: "start" }}>{s.state === "done" ? "DONE" : s.state === "partial" ? "PARTIAL" : "PENDING"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
