import type { HourlyPoint } from "@/features/newtab/clock-weather/weather";

/**
 * Minimal hand-drawn SVG line chart for the next-24h temperature — avoids a
 * charting dependency (docs/phase-2 §1). Single accent series over a muted
 * baseline, tabular labels, accessible summary.
 */
export function TempChart({ hourly }: { hourly: HourlyPoint[] }) {
  if (hourly.length < 2) return null;

  const W = 320;
  const H = 96;
  const padX = 8;
  const padY = 18;
  const temps = hourly.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = Math.max(1, max - min);

  const x = (i: number) => padX + (i * (W - padX * 2)) / (hourly.length - 1);
  const y = (t: number) => padY + (1 - (t - min) / range) * (H - padY * 2);

  const linePts = hourly.map((h, i) => `${x(i).toFixed(1)},${y(h.temp).toFixed(1)}`).join(" ");
  const areaPts = `${padX},${H - padY} ${linePts} ${W - padX},${H - padY}`;

  const maxI = temps.indexOf(max);
  const minI = temps.indexOf(min);
  const hourLabel = (iso: string) => new Date(iso).getHours();

  return (
    <svg
      className="temp-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Temperature next 24h, from ${min}° to ${max}°`}
    >
      <polygon className="temp-chart__area" points={areaPts} />
      <polyline className="temp-chart__line" points={linePts} />

      {/* high / low callouts */}
      <text className="temp-chart__value" x={x(maxI)} y={y(max) - 5} textAnchor="middle">
        {max}°
      </text>
      <text className="temp-chart__value" x={x(minI)} y={y(min) + 10} textAnchor="middle">
        {min}°
      </text>

      {/* hour ticks every 6 hours */}
      {hourly.map((h, i) =>
        i % 6 === 0 ? (
          <text
            key={h.time}
            className="temp-chart__label"
            x={x(i)}
            y={H - 4}
            textAnchor={i === 0 ? "start" : "middle"}
          >
            {hourLabel(h.time)}h
          </text>
        ) : null,
      )}
    </svg>
  );
}
