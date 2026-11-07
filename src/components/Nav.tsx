import Link from "next/link";
import { Shell } from "./Shell";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <Link href="/" className="logo">
          <Shell /> Cowrie
        </Link>
        <ul>
          <li><Link href="/#how">How it works</Link></li>
          <li><Link href="/demo">Live demo</Link></li>
          <li><Link href="/create">Create</Link></li>
          <li><Link href="/lab">Circle Lab</Link></li>
          <li><Link href="/status">Status</Link></li>
          <li><Link href="/#roadmap">Roadmap</Link></li>
        </ul>
        <Link href="/demo" className="btn solid small">Try the demo</Link>
      </div>
    </nav>
  );
}
