import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Custom CSS clock (docs/phase-5 §1 + core/01 §2). User CSS is applied inside a
 * Shadow DOM so it is scoped to the clock and can't leak to the rest of NewTab.
 * CSS is sanitized (block @import / expression() / style-tag breakout) — the
 * required sandbox for a CSS-only custom clock.
 */

export const DEFAULT_CLOCK_CSS = `.cc {
  text-align: center;
  color: var(--text, #fff);
  font-family: "Segoe UI", system-ui, sans-serif;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.35);
}
.cc-time {
  font-size: 76px;
  font-weight: 800;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
}
.cc-c {
  opacity: 0.45;
  animation: blink 1s steps(1) infinite;
}
.cc-date {
  margin-top: 10px;
  font-size: 17px;
  opacity: 0.7;
  text-transform: capitalize;
}
@keyframes blink {
  50% { opacity: 0.1; }
}`;

export function sanitizeClockCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/javascript:/gi, "")
    .replace(/<\/?style/gi, "");
}

const MARKUP =
  '<div class="cc"><div class="cc-time">' +
  '<span class="cc-h"></span><span class="cc-c">:</span>' +
  '<span class="cc-m"></span><span class="cc-c">:</span>' +
  '<span class="cc-s"></span></div><div class="cc-date"></div></div>';

export function CustomClock({ css }: { css: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const parts = useRef<{
    style?: HTMLStyleElement;
    h?: HTMLElement;
    m?: HTMLElement;
    s?: HTMLElement;
    date?: HTMLElement;
  }>({});
  const { i18n } = useTranslation();

  // build the shadow root once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style></style>${MARKUP}`;
    parts.current = {
      style: root.querySelector("style") as HTMLStyleElement,
      h: root.querySelector(".cc-h") as HTMLElement,
      m: root.querySelector(".cc-m") as HTMLElement,
      s: root.querySelector(".cc-s") as HTMLElement,
      date: root.querySelector(".cc-date") as HTMLElement,
    };
  }, []);

  useEffect(() => {
    if (parts.current.style) parts.current.style.textContent = sanitizeClockCss(css);
  }, [css]);

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const update = () => {
      const now = new Date();
      const p = parts.current;
      if (p.h) p.h.textContent = pad(now.getHours());
      if (p.m) p.m.textContent = pad(now.getMinutes());
      if (p.s) p.s.textContent = pad(now.getSeconds());
      if (p.date)
        p.date.textContent = now.toLocaleDateString(
          i18n.language === "vi" ? "vi-VN" : "en-US",
          { weekday: "long", day: "numeric", month: "long" },
        );
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [i18n.language]);

  return <div ref={hostRef} />;
}
