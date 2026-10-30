import type { ArtId } from '../drills'

// Small diagrams for the drill briefings, in the brand palette and drawn to read at 390px.
// Labels are short words passed in, so they follow the language.
export default function DrillArt({ id, labels }: { id: ArtId; labels: string[] }) {
  const svg = 'h-auto w-full text-ink'
  const text = 'fill-ink font-sans text-[11px] font-semibold'
  switch (id) {
    // Acids come out first, then sweetness, then bitterness; the cup should stop in the middle
    case 'extraction':
      return (
        <svg viewBox="0 0 300 120" className={svg} aria-hidden="true">
          <rect x="10" y="20" width="93" height="70" className="fill-sage/50" />
          <rect x="103" y="20" width="94" height="70" className="fill-olive-soft/40" />
          <rect x="197" y="20" width="93" height="70" className="fill-terracotta/30" />
          <path d="M10 88 C 60 70, 90 40, 150 32 S 250 22, 290 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M150 20 V 90" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
          <text x="56" y="108" textAnchor="middle" className={text}>{labels[0]}</text>
          <text x="150" y="108" textAnchor="middle" className={text}>{labels[1]}</text>
          <text x="244" y="108" textAnchor="middle" className={text}>{labels[2]}</text>
          <path d="M10 90 H 290" stroke="currentColor" strokeWidth="2" />
          <path d="M282 85 L 290 90 L 282 95" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="150" y="13" textAnchor="middle" className={text}>{labels[3]}</text>
        </svg>
      )
    // Fine packs tight and holds the water; coarse lets it run through
    case 'grind':
      return (
        <svg viewBox="0 0 300 120" className={svg} aria-hidden="true">
          {[0, 1].map((side) => {
            const x0 = side === 0 ? 20 : 170
            const r = side === 0 ? 3 : 7
            const step = side === 0 ? 9 : 19
            const dots = []
            // staggered rows, kept inside the basket walls
            for (let y = 40, row = 0; y < 88; y += step, row++) {
              for (let x = x0 + 4 + r + (row % 2) * (step / 2); x <= x0 + 106 - r; x += step) dots.push([x, y])
            }
            return (
              <g key={side}>
                <rect x={x0} y="30" width="110" height="62" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
                {dots.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={r} className="fill-olive" />
                ))}
                {(side === 0 ? [75] : [50, 75, 100]).map((x) => (
                  <path key={x} d={`M${x0 + x - 20} 6 V 24 M${x0 + x - 26} 18 L ${x0 + x - 20} 24 L ${x0 + x - 14} 18`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ))}
                <text x={x0 + 55} y="110" textAnchor="middle" className={text}>{labels[side]}</text>
              </g>
            )
          })}
        </svg>
      )
    // The same dose, a short and a long yield
    case 'ratio':
      return (
        <svg viewBox="0 0 300 120" className={svg} aria-hidden="true">
          {[
            { x: 30, h: 27, label: labels[0] },
            { x: 120, h: 36, label: labels[1] },
            { x: 210, h: 45, label: labels[2] },
          ].map((c) => (
            <g key={c.x}>
              <rect x={c.x} y={90 - c.h} width="60" height={c.h} className="fill-olive-soft/70" />
              <path d={`M${c.x} 40 V 90 H ${c.x + 60} V 40`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <text x={c.x + 30} y="110" textAnchor="middle" className={text}>{c.label}</text>
            </g>
          ))}
          <text x="150" y="22" textAnchor="middle" className={text}>{labels[3]}</text>
        </svg>
      )
    // A puck in the basket with one channel the water rushes through
    case 'puck':
      return (
        <svg viewBox="0 0 300 120" className={svg} aria-hidden="true">
          <path d="M60 30 V 92 H 240 V 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <rect x="62" y="44" width="176" height="46" className="fill-olive" />
          <path d="M168 44 C 160 58, 176 70, 166 90" fill="none" className="stroke-cream" strokeWidth="5" strokeLinecap="round" />
          {[95, 130, 205].map((x) => (
            <path key={x} d={`M${x} 12 V 32 M${x - 5} 26 L ${x} 32 L ${x + 5} 26`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ))}
          <path d="M166 6 V 34 M159 27 L 166 34 L 173 27" fill="none" className="stroke-terracotta" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M166 96 V 110" className="stroke-terracotta" strokeWidth="3.5" strokeLinecap="round" />
          <text x="250" y="68" className={text}>{labels[0]}</text>
        </svg>
      )
  }
}
