import Link from "next/link";
import { HeroShell } from "@/components/Shell";
import { STATUS } from "@/data/status";

const done = STATUS.filter((s) => s.state === "done").length;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <div>
            <div className="badge"><span className="dot" /> Built for NEAR HACKATHON 2026 · Social Money</div>
            <h1>
              Your ajo,<br />
              <span className="lime">without the notebook.</span>
            </h1>
            <p className="lead">
              Cowrie puts the rotating savings circle (ajo, esusu, susu, tanda) on NEAR. A contract holds the money,
              enforces the schedule and slashes collateral from anyone who stops paying. Your history becomes a
              credential that lowers what you lock next time.
            </p>
            <div className="cta">
              <Link href="/demo" className="btn solid">Watch a circle run →</Link>
              <Link href="/create" className="btn">Plan your circle</Link>
            </div>
          </div>
          <div className="shellStage">
            <HeroShell />
            <div className="chip" style={{ top: 30, right: 0 }}><b>5 of 5</b>members paid</div>
            <div className="chip" style={{ bottom: 60, left: 0 }}><b>492 USDC</b>paid to Chidi</div>
            <div className="chip" style={{ bottom: 10, right: 20 }}><b>Dayo slashed</b>pot still paid in full</div>
          </div>
        </div>
        <div className="wrap">
          <div className="stats">
            <div className="stat"><b>0</b><span>organizers holding your money</span></div>
            <div className="stat"><b>48</b><span>risk configurations simulated</span></div>
            <div className="stat"><b>11</b><span>invariants property-tested</span></div>
            <div className="stat"><b>{done}/{STATUS.length}</b><span>build items shipped</span></div>
          </div>
        </div>
      </section>

      <section className="block" id="problem">
        <div className="wrap">
          <div className="kicker">The problem</div>
          <h2>Trust is the <span className="lime">whole product</span></h2>
          <p className="sub">
            Hundreds of millions of people save in rotating circles. They run on notebooks, WhatsApp groups and the
            organizer&apos;s good name. That is why they break.
          </p>
          <div className="grid g4">
            {[
              ["Missed payments", "One member stops paying and the circle stalls. Nobody has anything to enforce it with."],
              ["Vanishing organizer", "The person holding the pot is a single point of failure and a single point of theft."],
              ["Early-recipient risk", "Members who already received their payout have the least reason to keep paying."],
              ["No portable proof", "Years of reliable saving count for nothing to a bank, a lender or the next circle."],
            ].map(([t, d], i) => (
              <div className="card" key={t}>
                <span className="num">0{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="how">
        <div className="wrap">
          <div className="kicker">How it works</div>
          <h2>Seven steps, <span className="lime">no organizer</span></h2>
          <p className="sub">Every step below is implemented and tested in the reference engine and playable in the demo.</p>
          <div className="grid g3">
            {[
              ["Create", "Pick members, amount and period. The wizard recommends collateral and a safety pot from the Circle Lab tables."],
              ["Invite", "Share a link or WhatsApp message. Members join and lock collateral."],
              ["Start", "When every seat is filled the circle becomes active. Order and schedule are fixed."],
              ["Contribute", "Pay each round, or prepay so autopay covers you. One payment per member per round."],
              ["Settle", "Anyone can settle after the deadline and grace period and earns a small tip. Defaulters are slashed; the recipient is still paid."],
              ["Finish", "Leftover collateral and safety pot are returned. Each member gets a non-transferable credential."],
            ].map(([t, d], i) => (
              <div className={`card ${i === 4 ? "hot" : ""}`} key={t}>
                <span className="num">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="edge">
        <div className="wrap">
          <div className="kicker">Why Cowrie</div>
          <h2>A savings circle with a <span className="lime">measured safety margin</span></h2>
          <p className="sub">Collateral and safety pot come from published simulations. The rules are property-tested. A member&apos;s history lowers what they must lock.</p>
          <div className="grid g2">
            <div className="card">
              <h3>Measured, not guessed</h3>
              <p>Circle Lab runs thousands of circles through the real engine for each risk level. In the 5-member, 10% default scenario, 50% collateral pays every pot in full in about 97% of circles; with no collateral and no safety pot only about 8% of circles pay every pot in full. <Link href="/lab" className="lime">See the tables →</Link></p>
            </div>
            <div className="card">
              <h3>Credentials that do something</h3>
              <p>Finish a circle and earn a non-transferable credential: rounds, on-time count, defaults. Members with enough credentials lock less collateral next time. The Cowrie Score formula is public.</p>
            </div>
            <div className="card">
              <h3>No operator needed</h3>
              <p>Settle and finish are permissionless. A capped tip, paid from the safety pot, keeps rounds moving even if the creator disappears.</p>
            </div>
            <div className="card">
              <h3>A secretary that cannot touch money</h3>
              <p>Ask who is next, who has not paid, what happens if you miss. The secretary only reads circle state. It has no function that moves funds.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="status">
        <div className="wrap">
          <div className="kicker">Honest progress</div>
          <h2>What works, <span className="lime">what is pending</span></h2>
          <p className="sub">The rules engine, tests, simulations and app are done. The NEAR smart contracts are the main open item and are not yet deployed.</p>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Item</th><th>State</th></tr></thead>
              <tbody>
                {STATUS.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className={s.state === "done" ? "yes" : "part"}>{s.state === "done" ? "Done" : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}><Link href="/status" className="lime">Full status with notes →</Link></p>
        </div>
      </section>

      <section className="block" id="roadmap">
        <div className="wrap">
          <div className="kicker">Roadmap</div>
          <h2>From hackathon to <span className="lime">a company</span></h2>
          <p className="sub">Cowrie is designed to earn its keep without ever holding customer money.</p>
          <div className="road">
            {[
              ["Nov 2026", "Hackathon prototype", ["Reference engine, property tests, Circle Lab", "Web app and no-wallet demo", "Testnet contracts and wallet flow (in progress)"]],
              ["Q1 2027", "Testnet beta", ["Contracts for factory, circle, credential, token", "Gas sponsorship so members need no NEAR", "Pilot with 3 to 5 real groups in Lagos using test funds", "Independent contract review"]],
              ["Q2 2027", "Mainnet beta", ["Security audit, then capped mainnet circles", "Naira on and off ramp partners", "Pidgin, Yoruba, Hausa, Igbo secretary"]],
              ["H2 2027", "Revenue", ["Protocol fee of a small share of each payout, set at creation and visible to members", "Cowrie Score API for lenders and fintechs (pay per query)", "White-label circles for cooperatives and employers"]],
              ["2028", "Network", ["Credential-backed micro-credit from third-party lenders", "Yield on idle balances with strict limits", "Cross-chain funding via NEAR Intents"]],
            ].map(([when, title, items], i) => (
              <div className="step" key={String(when)}>
                <div className="when">{when as string}</div>
                <div className={`card ${i === 0 ? "hot" : ""}`}>
                  <h3>{title as string}</h3>
                  <ul className="tick">{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
          <p className="mute" style={{ marginTop: 14, fontSize: 14 }}>Dates are plans, not commitments. Revenue lines are proposals; none is live.</p>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="notice"><b>Honest limits.</b> Collateral and the safety pot are not insurance. If too many members default, payouts can be short. Random turn order can be influenced by block producers. The code is unaudited. Intended for small circles of people who know each other.</div>
        </div>
      </section>
    </main>
  );
}
