/** The cowrie shell mark: used as logo and hero illustration. Placeholder until the final logo arrives. */
export function Shell({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6ff8a" />
          <stop offset="1" stopColor="#86e02b" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="60" rx="54" ry="38" transform="rotate(-18 60 60)" fill="url(#sg)" />
      <path d="M14 78 C 50 56 78 52 108 40" stroke="#04120a" strokeWidth="6" strokeLinecap="round" fill="none" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${28 + i * 12} ${72 - i * 4.6} l-3 -11 M${28 + i * 12} ${72 - i * 4.6} l-1 9`} stroke="#04120a" strokeWidth="3" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function HeroShell() {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Cowrie shell">
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2ffb0" />
          <stop offset=".5" stopColor="#c6ff3d" />
          <stop offset="1" stopColor="#3aa80f" />
        </linearGradient>
        <radialGradient id="gloss" cx=".3" cy=".25" r=".6">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="160" rx="170" ry="105" transform="rotate(-16 200 160)" fill="url(#hg)" />
      <ellipse cx="170" cy="120" rx="95" ry="40" transform="rotate(-16 170 120)" fill="url(#gloss)" />
      <path d="M45 215 C 150 150 250 140 355 96" stroke="#03100b" strokeWidth="16" strokeLinecap="round" fill="none" />
      {Array.from({ length: 12 }).map((_, i) => {
        const x = 70 + i * 24;
        const y = 200 - i * 9.4;
        return <path key={i} d={`M${x} ${y} l-6 -26 M${x} ${y} l-3 22`} stroke="#03100b" strokeWidth="7" strokeLinecap="round" />;
      })}
    </svg>
  );
}
