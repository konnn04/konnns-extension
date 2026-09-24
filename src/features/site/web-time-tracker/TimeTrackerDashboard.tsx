import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { IconButton } from "@/shared/ui";
import * as store from "./engine/store";
import { dateKey, formatDuration } from "./engine/session";
import { rangeToDates, type DashboardRange } from "./engine/range";
import { defaultTrackerSettings, type ActivitySession, type TrackerSettings } from "./engine/types";
import { RangeSwitch } from "./RangeSwitch";
import { DomainBarChart } from "./DomainBarChart";
import { DailyBarChart, type DayPoint } from "./DailyBarChart";
import { RecentSessionsList } from "./RecentSessionsList";
import { SettingsPanel } from "./SettingsPanel";
import "./web-time-tracker.css";

/** A normal page-level poll, not the MV3 background timer this tool is careful about elsewhere. */
const REFRESH_MS = 20000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Site app root — docs/roadmap/04-web-time-tracker.md §2, §3.
 * Everything here only READS via `engine/store.ts`; the actual recording
 * happens entirely in `background/activityTracker.ts`, whether or not this
 * page is ever open.
 */
export default function TimeTrackerDashboard() {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardRange>("today");
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TrackerSettings>(defaultTrackerSettings());
  const [domains, setDomains] = useState<store.DomainTotal[]>([]);
  const [daily, setDaily] = useState<DayPoint[]>([]);
  const [recent, setRecent] = useState<ActivitySession[]>([]);

  const reload = useCallback(async () => {
    const s = await store.getTrackerSettings();
    setSettings(s);
    if (!s.enabled) return;

    const { from, to } = rangeToDates(range);
    const [top, totals, sessions] = await Promise.all([
      store.topDomains(from, to, 10),
      store.dailyTotalsInRange(from, to),
      store.recentSessions(30),
    ]);
    setDomains(top);
    setRecent(sessions);

    const byDate = new Map<string, number>();
    for (const row of totals) {
      if (filterDomain && row.domain !== filterDomain) continue;
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.totalMs);
    }
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T00:00:00`).getTime();
    const days: DayPoint[] = [];
    for (let cursor = fromTime; cursor <= toTime; cursor += DAY_MS) {
      const key = dateKey(cursor);
      days.push({ date: key, totalMs: byDate.get(key) ?? 0 });
    }
    setDaily(days);
  }, [range, filterDomain]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // dropping range/domain filters that no longer make sense after a reload
  // (e.g. the filtered domain fell out of the top 10) is deliberately NOT
  // done automatically — losing a filter you just clicked into, with no
  // action from you, would be more surprising than a chart briefly empty.

  const filteredTotal = filterDomain
    ? (domains.find((d) => d.domain === filterDomain)?.totalMs ?? daily.reduce((n, d) => n + d.totalMs, 0))
    : daily.reduce((n, d) => n + d.totalMs, 0);

  return (
    <div className="wtt">
      <header className="wtt__header">
        <h1>{t("site.apps.web-time-tracker.name")}</h1>
        <div className="wtt__header-actions">
          <RangeSwitch value={range} onChange={setRange} />
          <IconButton
            label={t("timeTracker.settings")}
            className={showSettings ? "wtt__icon--on" : ""}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings size={16} />
          </IconButton>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel settings={settings} onSettingsChange={() => void reload()} />
      ) : !settings.enabled ? (
        <div className="wtt__disabled">
          <p>{t("timeTracker.disabledHint")}</p>
          <button type="button" className="wtt__disabled-link" onClick={() => setShowSettings(true)}>
            {t("timeTracker.goToSettings")}
          </button>
        </div>
      ) : (
        <div className="wtt__body">
          {filterDomain && (
            <button type="button" className="wtt__breadcrumb" onClick={() => setFilterDomain(null)}>
              ← {t("timeTracker.allDomains")}
            </button>
          )}

          <section className="wtt__section">
            <h2>{t("timeTracker.topDomains")}</h2>
            <DomainBarChart data={domains} selected={filterDomain} onSelect={setFilterDomain} />
          </section>

          <section className="wtt__section">
            <div className="wtt__section-head">
              <h2>{filterDomain ?? t("timeTracker.allDomainsCombined")}</h2>
              <span className="wtt__total">{formatDuration(filteredTotal)}</span>
            </div>
            <DailyBarChart data={daily} />
          </section>

          <section className="wtt__section">
            <h2>{t("timeTracker.recent")}</h2>
            <RecentSessionsList sessions={recent} />
          </section>
        </div>
      )}
    </div>
  );
}
