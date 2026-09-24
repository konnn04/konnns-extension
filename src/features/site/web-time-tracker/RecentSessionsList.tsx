import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { browser } from "wxt/browser";
import { faviconUrl } from "./engine/domain";
import { formatDuration } from "./engine/session";
import type { ActivitySession } from "./engine/types";

/** Click opens the URL in a new tab — the "chuột làm được mọi việc" requirement for this list. */
export function RecentSessionsList({ sessions }: { sessions: ActivitySession[] }) {
  const { t } = useTranslation();
  if (sessions.length === 0) return <p className="wtt__empty">{t("timeTracker.noRecent")}</p>;

  return (
    <ul className="wtt__recent" role="list">
      {sessions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className="wtt__recent-row"
            onClick={() => void browser.tabs.create({ url: s.url })}
            title={s.url}
          >
            <img className="wtt__favicon" src={faviconUrl(s.domain)} alt="" width={16} height={16} />
            <span className="wtt__recent-title">{s.title || s.domain}</span>
            <span className="wtt__recent-time">{formatDuration(s.activeMs)}</span>
            <ExternalLink size={12} className="wtt__recent-icon" />
          </button>
        </li>
      ))}
    </ul>
  );
}
