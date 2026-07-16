import type { ContribDay } from "./api";

/**
 * GitHub-style contribution heatmap, hand-drawn SVG (no chart dep). Cell color
 * = accent at increasing opacity per level, so it stays theme-aware.
 */
export function ContribGraph({ weeks }: { weeks: ContribDay[][] }) {
  const cell = 11;
  const gap = 3;
  const H = 7 * (cell + gap);

  // last ~26 weeks so cells stay legible in a narrow panel
  const shown = weeks.slice(-26);
  const shownW = shown.length * (cell + gap);

  const levelOpacity = [0.08, 0.35, 0.55, 0.78, 1];

  return (
    <svg
      className="gh__contrib"
      viewBox={`0 0 ${shownW} ${H}`}
      role="img"
      aria-label="GitHub contributions"
    >
      {shown.map((week, x) =>
        week.map((day, y) => (
          <rect
            key={day.date}
            x={x * (cell + gap)}
            y={y * (cell + gap)}
            width={cell}
            height={cell}
            rx={2}
            fill="var(--accent)"
            fillOpacity={levelOpacity[day.level]}
            stroke="var(--border)"
            strokeWidth={day.level === 0 ? 0.5 : 0}
          >
            <title>{`${day.date}: ${day.count}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}
