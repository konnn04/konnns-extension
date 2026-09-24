import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { browser } from "wxt/browser";
import { Toggle } from "@/shared/ui";
import { syncAlarm } from "./background/autoClear";
import { getSchedule, listLog, saveSchedule } from "./engine/store";
import type { ClearDataTypes, ClearLogEntry, ClearSchedule } from "./engine/types";
import { DataTypeToggles } from "./DataTypeToggles";
import { ScheduleSelect } from "./ScheduleSelect";
import { ExcludedDomains } from "./ExcludedDomains";
import { ClearNowButton } from "./ClearNowButton";
import { ClearLogTable } from "./ClearLogTable";
import "./auto-clear-cache.css";

export default function AutoClearCache() {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState<ClearSchedule | null>(null);
  const [log, setLog] = useState<ClearLogEntry[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<Set<keyof ClearDataTypes>>(new Set());

  useEffect(() => {
    void (async () => {
      setSchedule(await getSchedule());
      setLog(await listLog());
      try {
        const res = await browser.browsingData.settings();
        const blocked = new Set<keyof ClearDataTypes>();
        const permitted = res.dataRemovalPermitted;
        if (permitted.cache === false) blocked.add("cache");
        if (permitted.cookies === false) blocked.add("cookies");
        if (permitted.history === false) blocked.add("history");
        if (permitted.formData === false) blocked.add("formData");
        if (permitted.downloads === false) blocked.add("downloadHistory");
        setBlockedKeys(blocked);
      } catch {
        /* browsingData.settings() isn't available everywhere — proceed without the policy hint */
      }
    })();
  }, []);

  const persist = useCallback((next: ClearSchedule) => {
    setSchedule(next);
    void saveSchedule(next).then(() => syncAlarm());
  }, []);

  if (!schedule) return null;

  return (
    <div className="acc">
      <header className="acc__header">
        <h1>{t("autoClearCache.title")}</h1>
        <ClearNowButton onDone={(entry) => setLog((prev) => [entry, ...prev].slice(0, 50))} />
      </header>

      <section className="acc__section">
        <label className="acc__enable-row">
          <Toggle checked={schedule.enabled} onChange={(v) => persist({ ...schedule, enabled: v })} />
          <strong>{t("autoClearCache.enable")}</strong>
        </label>
        <p className="acc__section-desc">{t("autoClearCache.enableDesc")}</p>
      </section>

      {schedule.enabled && (
        <section className="acc__section">
          <h2>{t("autoClearCache.frequency")}</h2>
          <ScheduleSelect value={schedule.frequency} onChange={(v) => persist({ ...schedule, frequency: v })} />
        </section>
      )}

      <section className="acc__section">
        <h2>{t("autoClearCache.dataTypes")}</h2>
        <DataTypeToggles
          value={schedule.dataTypes}
          onChange={(v) => persist({ ...schedule, dataTypes: v })}
          blockedKeys={blockedKeys}
        />
      </section>

      <section className="acc__section">
        <h2>{t("autoClearCache.excludedDomains")}</h2>
        <ExcludedDomains value={schedule.excludedDomains} onChange={(v) => persist({ ...schedule, excludedDomains: v })} />
      </section>

      <section className="acc__section">
        <h2>{t("autoClearCache.log")}</h2>
        <ClearLogTable entries={log} />
      </section>
    </div>
  );
}
