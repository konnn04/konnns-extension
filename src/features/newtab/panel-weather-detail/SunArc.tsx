import { Sunrise, Sunset } from "lucide-react";

/**
 * Modern sun-arc visual: an arc from sunrise → sunset with the sun at its
 * current position along the arc (fraction of daytime elapsed). Below-horizon
 * (night) dims the sun and pins it to the edge.
 */
export function SunArc({ sunrise, sunset }: { sunrise: string; sunset: string }) {
  const rise = new Date(sunrise).getTime();
  const set = new Date(sunset).getTime();
  const now = Date.now();
  const span = Math.max(1, set - rise);
  const f = Math.min(1, Math.max(0, (now - rise) / span));
  const isDay = now >= rise && now <= set;

  const R = 100;
  const CX = 120;
  const CY = 100;
  const L = Math.PI * R;
  const theta = Math.PI * (1 - f);
  const sx = CX + R * Math.cos(theta);
  const sy = CY - R * Math.sin(theta);

  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="sunarc">
      {/* top padding in the viewBox so the sun + rays never clip at the arc peak */}
      <svg viewBox="0 -18 240 122" className="sunarc__svg" role="img" aria-label="Sun position">
        <line x1="8" y1="100" x2="232" y2="100" className="sunarc__horizon" />
        <path d={`M20 100 A${R} ${R} 0 0 1 220 100`} className="sunarc__track" />
        <path
          d={`M20 100 A${R} ${R} 0 0 1 220 100`}
          className="sunarc__prog"
          strokeDasharray={`${(f * L).toFixed(1)} ${L.toFixed(1)}`}
        />
        <g className={isDay ? "sunarc__sun" : "sunarc__sun sunarc__sun--night"}>
          <circle cx={sx} cy={sy} r="7" />
          {isDay &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (Math.PI * 2 * i) / 8;
              return (
                <line
                  key={i}
                  x1={sx + Math.cos(a) * 10}
                  y1={sy + Math.sin(a) * 10}
                  x2={sx + Math.cos(a) * 13}
                  y2={sy + Math.sin(a) * 13}
                  className="sunarc__ray"
                />
              );
            })}
        </g>
      </svg>
      <div className="sunarc__labels">
        <span>
          <Sunrise size={15} /> {fmt(rise)}
        </span>
        <span>
          <Sunset size={15} /> {fmt(set)}
        </span>
      </div>
    </div>
  );
}
