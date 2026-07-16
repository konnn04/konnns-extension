import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFeatures } from "@/core/feature-registry";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { Button, Toggle } from "@/shared/ui";
import {
  NOTIF_FEATURE_ID,
  hasNotificationPermission,
  requestNotificationPermission,
} from "./index";

/**
 * Notification preferences (General settings section). The per-source list is
 * auto-generated from features declaring `notifiable: true` — no hardcoding.
 */
export function NotificationSettings() {
  const { t } = useTranslation();
  const values = useFeatureValues(NOTIF_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const [granted, setGranted] = useState<boolean | null>(null);

  const notifiable = getFeatures().filter((f) => f.notifiable);
  const master = values.master !== false;

  useEffect(() => {
    void hasNotificationPermission().then(setGranted);
  }, []);

  const get = (key: string, dflt: boolean) => (values[key] as boolean | undefined) ?? dflt;

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{t("notifications.settingsTitle")}</h3>

      <div className="notif-settings__row">
        <span className="ui-field__label">{t("notifications.master")}</span>
        <Toggle checked={master} onChange={(v) => setValue(NOTIF_FEATURE_ID, "master", v)} />
      </div>
      <div className="notif-settings__row">
        <span className="ui-field__label">{t("notifications.sound")}</span>
        <Toggle
          checked={get("sound", false)}
          onChange={(v) => setValue(NOTIF_FEATURE_ID, "sound", v)}
        />
      </div>

      {granted === false && (
        <div className="notif-settings__row">
          <span className="ui-field__desc">{t("notifications.osPermission")}</span>
          <Button
            size="sm"
            onClick={async () => {
              if (await requestNotificationPermission()) setGranted(true);
            }}
          >
            {t("bookmarks.grant")}
          </Button>
        </div>
      )}

      {notifiable.length > 0 && master && (
        <>
          <p className="ui-field__desc" style={{ marginTop: "var(--space-2)" }}>
            {t("notifications.perSource")}
          </p>
          {notifiable.map((f) => (
            <div className="notif-settings__row" key={f.id}>
              <span className="ui-field__label">{t(f.nameKey)}</span>
              <Toggle
                checked={get(`src:${f.id}`, true)}
                onChange={(v) => setValue(NOTIF_FEATURE_ID, `src:${f.id}`, v)}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
