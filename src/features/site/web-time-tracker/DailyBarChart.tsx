import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration } from "./engine/session";

export interface DayPoint {
  /** "YYYY-MM-DD" */
  date: string;
  totalMs: number;
}

/** Single series again (see DomainBarChart) — one hue, magnitude by height, hover for the exact value. */
export function DailyBarChart({ data }: { data: DayPoint[] }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.every((d) => d.totalMs === 0)) {
    return <p className="wtt__empty">{t("timeTracker.noData")}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.totalMs));

  return (
    <div className="wtt__daily" role="img" aria-label={t("timeTracker.dailyChartLabel")}>
      {data.map((d, i) => (
        <div
          key={d.date}
          className="wtt__daily-col"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
        >
          {hovered === i && (
            <div className="wtt__tooltip wtt__tooltip--top" role="tooltip">
              {formatDuration(d.totalMs)}
            </div>
          )}
          <div className="wtt__daily-bar-track">
            <div className="wtt__daily-bar-fill" style={{ height: `${Math.max(2, (d.totalMs / max) * 100)}%` }} />
          </div>
          <span className="wtt__daily-label">{dayOfMonth(d.date)}</span>
        </div>
      ))}
    </div>
  );
}

/** Day-of-month number ("23"), not a localized weekday — stays compact and unambiguous at 30 bars wide. */
function dayOfMonth(date: string): string {
  return String(Number(date.slice(-2)));
}
