import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "./Select";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = value !== undefined ? startOfDay(new Date(value)) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? startOfDay(new Date()));

  useEffect(() => {
    if (open) setViewDate(selected ?? startOfDay(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = startOfDay(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewDate);

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(d);
  });

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: new Date(year, month, 1 - (startOffset - i)), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay), outside: true });
    nextDay++;
  }

  const pick = (d: Date) => {
    onChange(startOfDay(d).getTime());
    setOpen(false);
  };

  const label = selected
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(selected)
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-datepicker-trigger ${className}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Calendar size={13} className="ui-datepicker-trigger__icon" />
        <span className={label ? "" : "ui-datepicker-trigger__placeholder"}>
          {label ?? placeholder ?? ""}
        </span>
        {label && (
          <X
            size={12}
            className="ui-datepicker-trigger__clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          />
        )}
      </button>
      {open && (
        <Dropdown
          anchor={triggerRef.current}
          onClose={() => setOpen(false)}
          matchTriggerWidth={false}
          className="ui-datepicker"
          role="dialog"
        >
          <div className="ui-datepicker__header">
            <button
              type="button"
              className="ui-datepicker__nav"
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="ui-datepicker__month">{monthLabel}</span>
            <button
              type="button"
              className="ui-datepicker__nav"
              aria-label="Next month"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="ui-datepicker__weekdays">
            {weekdayLabels.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="ui-datepicker__grid">
            {cells.map(({ date, outside }) => {
              const isSelected = !!selected && sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={[
                    "ui-datepicker__day",
                    outside && "ui-datepicker__day--outside",
                    isSelected && "ui-datepicker__day--selected",
                    isToday && "ui-datepicker__day--today",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="ui-datepicker__footer">
            <button type="button" className="ui-datepicker__action" onClick={() => pick(new Date())}>
              {t("datepicker.today")}
            </button>
            {label && (
              <button
                type="button"
                className="ui-datepicker__action"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                {t("datepicker.clear")}
              </button>
            )}
          </div>
        </Dropdown>
      )}
    </>
  );
}
