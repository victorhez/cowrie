import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div>
          <b className="display lime">Cowrie</b>
          <p>Built for NEAR HACKATHON 2026. Unaudited prototype. Not insurance, not financial or legal advice.</p>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <Link href="/status">Build status</Link>
          <Link href="/lab">Circle Lab</Link>
          <a href="https://github.com/victorhez/cowrie">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
