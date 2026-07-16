import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * 3 built-in clock styles (digital / text / analog) — docs/core-he-thong/01 §2.
 * The analog clock animates hands with CSS transform only (no SVG re-render per tick).
 */

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function DigitalClock({
  showSeconds,
  hour24,
}: {
  showSeconds: boolean;
  hour24: boolean;
}) {
  const now = useNow(1000);
  const { i18n } = useTranslation();
  const time = now.toLocaleTimeString(i18n.language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: !hour24,
  });
  const date = now.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="clock clock--digital">
      <div className="clock__time">{time}</div>
      <div className="clock__date">{date}</div>
    </div>
  );
}

export function TextClock({ hour24 }: { hour24: boolean }) {
  const now = useNow(1000);
  const { t, i18n } = useTranslation();
  const hour = hour24 ? now.getHours() : now.getHours() % 12 || 12;
  const minute = now.getMinutes().toString().padStart(2, "0");
  const date = now.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="clock clock--text">
      <div className="clock__time">{t("clock.textFormat", { hour, minute })}</div>
      <div className="clock__date">{date}</div>
    </div>
  );
}

export function AnalogClock({ showSeconds }: { showSeconds: boolean }) {
  const now = useNow(showSeconds ? 1000 : 10_000);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;

  return (
    <div className="clock clock--analog">
      <svg viewBox="0 0 100 100" width="180" height="180" role="img" aria-label="clock">
        <circle cx="50" cy="50" r="48" className="analog__face" />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="6"
            x2="50"
            y2={i % 3 === 0 ? "13" : "10"}
            className="analog__tick"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="28"
          className="analog__hand analog__hand--hour"
          style={{ transform: `rotate(${h * 30}deg)` }}
        />
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="18"
          className="analog__hand analog__hand--minute"
          style={{ transform: `rotate(${m * 6}deg)` }}
        />
        {showSeconds && (
          <line
            x1="50"
            y1="54"
            x2="50"
            y2="14"
            className="analog__hand analog__hand--second"
            style={{ transform: `rotate(${s * 6}deg)` }}
          />
        )}
        <circle cx="50" cy="50" r="2.4" className="analog__pin" />
      </svg>
    </div>
  );
}
