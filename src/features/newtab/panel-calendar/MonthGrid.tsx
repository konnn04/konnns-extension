import { solarToLunar } from "./lunar";

/** Month calendar grid (week starts Monday). Shows solar day + optional lunar. */
export function MonthGrid({
  year,
  month,
  selected,
  onSelect,
  showLunar,
  eventDays,
  weekdayLabels,
}: {
  year: number;
  month: number; // 0-11
  selected: Date;
  onSelect: (d: Date) => void;
  showLunar: boolean;
  eventDays: Set<string>;
  weekdayLabels: string[];
}) {
  const first = new Date(year, month, 1);
  // Monday-first offset (JS getDay: 0=Sun)
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = today.toDateString();
  const selectedKey = selected.toDateString();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="cal-grid">
      <div className="cal-grid__weekdays">
        {weekdayLabels.map((w) => (
          <span key={w} className="cal-grid__weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="cal-grid__days">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} className="cal-cell cal-cell--empty" />;
          const lunar = showLunar
            ? solarToLunar(date.getDate(), month + 1, year)
            : null;
          const isToday = date.toDateString() === todayKey;
          const isSelected = date.toDateString() === selectedKey;
          const hasEvent = eventDays.has(date.toDateString());
          return (
            <button
              key={date.toDateString()}
              type="button"
              className={[
                "cal-cell",
                isToday && "cal-cell--today",
                isSelected && "cal-cell--selected",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(date)}
            >
              <span className="cal-cell__solar">{date.getDate()}</span>
              {lunar && (
                <span className="cal-cell__lunar">
                  {lunar.day === 1 ? `${lunar.day}/${lunar.month}` : lunar.day}
                </span>
              )}
              {hasEvent && <span className="cal-cell__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
