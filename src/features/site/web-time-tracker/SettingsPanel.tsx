import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import { Button, Field, TextInput, Toggle } from "@/shared/ui";
import { hasPermissions, requestPermissions } from "@/core/permissions";
import { sendToBackground } from "@/core/messaging";
import { normalizeDomain } from "./engine/domain";
import * as store from "./engine/store";
import type { TrackerSettings } from "./engine/types";

/**
 * Master switch + excluded domains + "clear all" — docs/roadmap/04 §2, §5.
 * Lives on its own screen (toggled from the dashboard header), not inline on
 * the charts, so "clear all history" is never one accidental click away from
 * "look at today's numbers".
 */
export function SettingsPanel({
  settings,
  onSettingsChange,
}: {
  settings: TrackerSettings;
  onSettingsChange: () => void;
}) {
  const { t } = useTranslation();
  const [hasTabsPermission, setHasTabsPermission] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hasPermissions({ permissions: ["tabs"] }).then(setHasTabsPermission);
  }, []);

  const toggleEnabled = async (next: boolean) => {
    if (next) {
      setBusy(true);
      try {
        // Ask only once — a user who already granted it on a previous visit
        // should not be re-prompted every time they flip the switch off/on.
        const granted = hasTabsPermission || (await requestPermissions({ permissions: ["tabs"] }));
        setHasTabsPermission(granted);
        if (!granted) return; // stays off; the Field's description explains why
        await store.setEnabled(true);
        // Granting the permission fired no tab event of its own — without
        // this, tracking would silently wait for the next manual tab switch.
        await sendToBackground({ type: "timeTracker:seed" });
      } finally {
        setBusy(false);
      }
    } else {
      await store.setEnabled(false);
    }
    onSettingsChange();
  };

  const addDomain = () => {
    const raw = newDomain.trim();
    if (!raw) return;
    const domain = normalizeDomain(raw.includes("://") ? raw : `https://${raw}`);
    setNewDomain("");
    if (!domain || settings.excludedDomains.includes(domain)) return;
    void store.setExcludedDomains([...settings.excludedDomains, domain]).then(onSettingsChange);
  };

  const removeDomain = (domain: string) => {
    void store
      .setExcludedDomains(settings.excludedDomains.filter((d) => d !== domain))
      .then(onSettingsChange);
  };

  const clearAll = () => {
    void store.clearAll().then(() => {
      setConfirmClear(false);
      onSettingsChange();
    });
  };

  return (
    <div className="wtt__settings">
      <Field
        label={t("timeTracker.enable")}
        description={settings.enabled || hasTabsPermission ? undefined : t("timeTracker.enableDesc")}
        inline
      >
        <Toggle checked={settings.enabled} onChange={(v) => void toggleEnabled(v)} disabled={busy} />
      </Field>

      <Field label={t("timeTracker.excludedDomains")} description={t("timeTracker.excludedDomainsDesc")}>
        <div className="wtt__domain-input">
          <TextInput
            value={newDomain}
            placeholder={t("timeTracker.excludedDomainsPlaceholder")}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addDomain();
            }}
          />
          <Button onClick={addDomain}>{t("common.confirm")}</Button>
        </div>
        {settings.excludedDomains.length > 0 && (
          <ul className="wtt__domain-list" role="list">
            {settings.excludedDomains.map((d) => (
              <li key={d} className="wtt__domain-tag">
                <span>{d}</span>
                <button type="button" onClick={() => removeDomain(d)} aria-label={t("common.delete")}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label={t("timeTracker.dangerZone")}>
        {confirmClear ? (
          <div className="wtt__confirm-row">
            <span>{t("timeTracker.clearAllConfirm")}</span>
            <Button variant="danger" onClick={clearAll}>
              {t("common.confirm")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmClear(true)}>
            <Trash2 size={13} />
            {t("timeTracker.clearAll")}
          </Button>
        )}
      </Field>
    </div>
  );
}
