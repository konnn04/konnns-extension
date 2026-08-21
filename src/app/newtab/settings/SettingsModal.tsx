import { useEffect, useRef, useState } from "react";
import { Download, HeartHandshake, Palette, RotateCcw, Settings2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFeatures } from "@/core/feature-registry";
import { SettingsForm } from "@/core/settings-engine/SettingsForm";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { exportBackup, importBackup } from "@/core/storage/backup";
import { estimateStorage } from "@/core/storage/db";
import { setLanguage } from "@/core/i18n";
import { emit, on } from "@/core/event-bus";
import { Button, Field, Modal, Toggle } from "@/shared/ui";
import { NotificationSettings } from "@/core/notification-engine/NotificationSettings";
import { SoundSettings } from "@/core/sound/SoundSettings";
import { coreAppearanceSchema, coreGeneralSchema } from "./coreSettings";
import { ThemePicker } from "./ThemePicker";
import { FontPicker } from "./FontPicker";
import { ContributePanel } from "./ContributePanel";
import "./settings-modal.css";

const APPEARANCE_ID = "appearance";
const CONTRIBUTE_ID = "contribute";

/** Appearance tab — theme + wallpaper/glass controls (split out of General). */
function AppearancePanel() {
  const { t } = useTranslation();
  return (
    <div>
      <Field label={t("settings.theme")}>
        <ThemePicker />
      </Field>
      <SettingsForm featureId={CORE_FEATURE_ID} schema={coreAppearanceSchema} />
      <FontPicker />
    </div>
  );
}

function GeneralPanel() {
  const { t } = useTranslation();
  const values = useFeatureValues(CORE_FEATURE_ID);
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    void estimateStorage().then((est) => {
      if (est) setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB`);
    });
  }, []);

  // keep i18next in sync with the language setting (live apply)
  const lang = values.language as string | undefined;
  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  return (
    <div>
      <SettingsForm featureId={CORE_FEATURE_ID} schema={coreGeneralSchema} />

      <div className="settings-section">
        <h3 className="settings-section__title">{t("settings.backup")}</h3>
        <div className="settings-section__row">
          <Button onClick={() => void exportBackup()}>
            <Download size={15} /> {t("settings.exportBackup")}
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {t("settings.importBackup")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!window.confirm(t("settings.importConfirm"))) return;
              const res = await importBackup(f);
              if (res.ok) setImportMsg(t("settings.importDone"));
              else if (res.error === "newer-version") setImportMsg(t("settings.importNewer"));
              else setImportMsg(t("settings.importInvalid"));
            }}
          />
        </div>
        {importMsg && <p className="ui-field__desc">{importMsg}</p>}
        <p className="ui-field__desc">
          {t("settings.storageUsage")}: {usage ?? "…"}
        </p>
      </div>

      <NotificationSettings />
      <SoundSettings />

      <div className="settings-section">
        <Button
          variant="ghost"
          onClick={() => {
            emit("onboarding:open");
          }}
        >
          <RotateCcw size={15} /> {t("settings.reopenOnboarding")}
        </Button>
      </div>
    </div>
  );
}

function FeaturePanel({ featureId }: { featureId: string }) {
  const { t } = useTranslation();
  const feature = getFeatures().find((f) => f.id === featureId);
  const enabled = useSettingsStore((s) => s.enabled[featureId] ?? feature?.defaultEnabled ?? true);
  const setEnabled = useSettingsStore((s) => s.setEnabled);
  if (!feature) return null;

  return (
    <div>
      <Field label={t("settings.featureEnabled")} inline>
        <Toggle checked={enabled} onChange={(v) => setEnabled(featureId, v)} />
      </Field>
      {enabled && feature.settingsSchema && (
        <SettingsForm featureId={featureId} schema={feature.settingsSchema} />
      )}
      {enabled && feature.settingsExtra && (
        <div className="settings-section">
          <feature.settingsExtra />
        </div>
      )}
    </div>
  );
}

export function SettingsModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(CONTRIBUTE_ID);
  const features = getFeatures();

  useEffect(
    () =>
      on("settings:open", (payload) => {
        setCategory(payload?.featureId ?? CONTRIBUTE_ID);
        setOpen(true);
      }),
    [],
  );

  return (
    <>
      {/* gear trigger — bottom-right, revealed on hover (docs/core-he-thong/02 §1) */}
      <div className="settings-trigger-zone">
        <button
          type="button"
          className="settings-trigger"
          aria-label={t("settings.title")}
          onClick={() => setOpen(true)}
        >
          <Settings2 size={20} />
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("settings.title")} width="min(92vw, 880px)">
        <div className="settings-layout">
          <nav className="settings-nav">
            {/* System group */}
            <div className="settings-nav__group">{t("settings.groupSystem")}</div>
            <button
              className={`settings-nav__item ${category === CONTRIBUTE_ID ? "settings-nav__item--active" : ""}`}
              onClick={() => setCategory(CONTRIBUTE_ID)}
            >
              <HeartHandshake size={16} />
              {t("settings.contribute")}
            </button>
            <button
              className={`settings-nav__item ${category === CORE_FEATURE_ID ? "settings-nav__item--active" : ""}`}
              onClick={() => setCategory(CORE_FEATURE_ID)}
            >
              <Settings2 size={16} />
              {t("settings.general")}
            </button>
            <button
              className={`settings-nav__item ${category === APPEARANCE_ID ? "settings-nav__item--active" : ""}`}
              onClick={() => setCategory(APPEARANCE_ID)}
            >
              <Palette size={16} />
              {t("settings.appearance")}
            </button>

            {/* Feature groups by zone — auto-generated from the Feature Registry */}
            {(
              [
                ["settings.groupCore", ["center", "background", "quick-access-bar"]],
                ["settings.groupPanels", ["left-sidebar"]],
                ["settings.groupTools", ["right-sidebar"]],
              ] as const
            ).map(([labelKey, zones]) => {
              const group = features.filter((f) => (zones as readonly string[]).includes(f.zone));
              if (group.length === 0) return null;
              return (
                <div key={labelKey}>
                  <div className="settings-nav__group">{t(labelKey)}</div>
                  {group.map((f) => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.id}
                        className={`settings-nav__item ${category === f.id ? "settings-nav__item--active" : ""}`}
                        onClick={() => setCategory(f.id)}
                      >
                        <Icon size={16} />
                        {t(f.nameKey)}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="settings-content">
            {category === CONTRIBUTE_ID ? (
              <ContributePanel />
            ) : category === CORE_FEATURE_ID ? (
              <GeneralPanel />
            ) : category === APPEARANCE_ID ? (
              <AppearancePanel />
            ) : (
              <FeaturePanel featureId={category} />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
