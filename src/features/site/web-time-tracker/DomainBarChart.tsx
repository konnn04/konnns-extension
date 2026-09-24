import { useState } from "react";
import { useTranslation } from "react-i18next";
import { faviconUrl } from "./engine/domain";
import { formatDuration } from "./engine/session";
import type { DomainTotal } from "./engine/store";

/**
 * Ranking bars, not a categorical chart — dataviz skill's "identity vs
 * magnitude" split. Every bar shares ONE hue (the page's accent color): this
 * is a single series (time spent) ranked by domain, and a domain's identity
 * is already carried by its label and favicon, not by a color. Assigning a
 * different hue per domain would be color used for identity on data whose
 * job is magnitude — exactly the anti-pattern the skill calls out, and it
 * would also break down the moment there are more domains than a palette
 * has good hues for.
 */
export function DomainBarChart({
  data,
  selected,
  onSelect,
}: {
  data: DomainTotal[];
  selected: string | null;
  onSelect: (domain: string) => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="wtt__empty">{t("timeTracker.noData")}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.totalMs));

  return (
    <ul className="wtt__bars" role="list">
      {data.map((d) => (
        <li key={d.domain} className="wtt__bar-row">
          <button
            type="button"
            className={`wtt__bar-btn ${selected === d.domain ? "wtt__bar-btn--active" : ""}`}
            onClick={() => onSelect(d.domain)}
            onMouseEnter={() => setHovered(d.domain)}
            onMouseLeave={() => setHovered((h) => (h === d.domain ? null : h))}
          >
            <img className="wtt__favicon" src={faviconUrl(d.domain)} alt="" width={16} height={16} />
            <span className="wtt__bar-label">{d.domain}</span>
            <span className="wtt__bar-track">
              <span className="wtt__bar-fill" style={{ width: `${Math.max(2, (d.totalMs / max) * 100)}%` }} />
            </span>
            <span className="wtt__bar-value">{formatDuration(d.totalMs)}</span>
          </button>
          {hovered === d.domain && (
            <div className="wtt__tooltip" role="tooltip">
              {formatDuration(d.totalMs)} · {t("timeTracker.visits", { count: d.visits })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
