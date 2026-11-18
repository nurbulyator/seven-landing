import type { DirectionArt as Art } from "@/content/site";

const delay = (s: number) => ({ animationDelay: `${s}s` });

/** Маленькие живые схемы для карточек направлений: только SVG и CSS-анимации. */
export function DirectionArt({ art }: { art: Art }) {
  return (
    <svg viewBox="0 0 120 120" className="size-24 text-accent sm:size-28" fill="none" stroke="currentColor" aria-hidden>
      {art === "network" && (
        <g strokeWidth="1.5">
          <path d="M60 24 26 58l34 34 34-34Z M60 24v68 M26 58h68" opacity="0.35" />
          {[
            [60, 24],
            [26, 58],
            [94, 58],
            [60, 92],
            [60, 58],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="6" fill="currentColor" className="art-pulse" style={delay(i * 0.35)} />
          ))}
        </g>
      )}
      {art === "cloud" && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={22 + i * 16}
              y={30}
              width="10"
              height="60"
              rx="3"
              fill="currentColor"
              stroke="none"
              className="art-rise"
              style={delay(i * 0.3)}
            />
          ))}
        </g>
      )}
      {art === "rack" && (
        <g strokeWidth="1.5">
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <rect x="22" y={26 + r * 24} width="76" height="18" rx="4" />
              {[0, 1, 2].map((l) => (
                <circle
                  key={l}
                  cx={34 + l * 9}
                  cy={35 + r * 24}
                  r="2.6"
                  fill="currentColor"
                  stroke="none"
                  className="art-blink"
                  style={delay((r * 3 + l) * 0.23)}
                />
              ))}
              <path d={`M64 ${35 + r * 24}h24`} opacity="0.4" />
            </g>
          ))}
        </g>
      )}
      {art === "ledger" && (
        <g strokeWidth="1.5" strokeLinecap="round">
          <rect x="28" y="20" width="64" height="80" rx="6" opacity="0.4" />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M40 ${40 + i * 14}h${i % 2 ? 26 : 40}`}
              pathLength={1}
              className="art-draw"
              strokeWidth="3"
              style={delay(i * 0.4)}
            />
          ))}
        </g>
      )}
      {art === "shield" && (
        <g strokeWidth="1.5">
          <clipPath id="shield-clip">
            <path d="M60 18 92 30v26c0 22-14 38-32 46-18-8-32-24-32-46V30Z" />
          </clipPath>
          <path d="M60 18 92 30v26c0 22-14 38-32 46-18-8-32-24-32-46V30Z" />
          <g clipPath="url(#shield-clip)">
            <rect x="20" y="58" width="80" height="3" fill="currentColor" stroke="none" className="art-scan" />
          </g>
          <path d="m47 60 9 9 18-18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {art === "code" && (
        <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 40 24 60l18 20 M78 40l18 20-18 20" />
          <path d="M66 34 54 86" opacity="0.4" />
          <rect x="58" y="88" width="10" height="3" fill="currentColor" stroke="none" className="art-caret" />
        </g>
      )}
      {art === "clock" && (
        <g strokeWidth="1.5" strokeLinecap="round">
          <circle cx="60" cy="60" r="38" opacity="0.4" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 26v6" transform={`rotate(${i * 30} 60 60)`} />
          ))}
          <path d="M60 60V38" strokeWidth="3" className="art-spin" />
          <circle cx="60" cy="60" r="3.5" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}
