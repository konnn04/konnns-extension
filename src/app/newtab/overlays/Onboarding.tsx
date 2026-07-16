import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { db } from "@/core/storage/db";
import { on } from "@/core/event-bus";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { getFeatures } from "@/core/feature-registry";
import { useWallpaperStore } from "@/features/newtab/wallpaper/store";
import { WALLPAPER_FEATURE_ID } from "@/features/newtab/wallpaper";
import { BOOKMARK_FEATURE_ID } from "@/features/newtab/bookmark-bar";
import { requestBookmarkPermission } from "@/features/newtab/bookmark-bar/bookmarks-api";
import { CLOCK_FEATURE_ID } from "@/features/newtab/clock-weather";
import { Button, Card, Segmented, TextInput, Toggle } from "@/shared/ui";
import { ThemePicker } from "../settings/ThemePicker";
import "./onboarding.css";

/**
 * First-run wizard (docs/phase-1-mvp/02 + phase-5 §5 feature-picker step).
 * Every choice applies live behind the overlay; progress persists to
 * `onboarding-state` so closing mid-way resumes.
 */

// welcome, theme, mode, wallpaper, weather, bookmarks, features, done
const TOTAL_STEPS = 8;

/** Panels/tools the user can opt into at step 7 (auto-sinh from the registry). */
function extensionFeatures() {
  return getFeatures().filter(
    (f) => f.zone === "left-sidebar" || f.zone === "right-sidebar",
  );
}

export function Onboarding() {
  const { t } = useTranslation();
  const hydrated = useSettingsStore((s) => s.hydrated);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (!hydrated) return;
    void db.onboardingState.get("state").then((row) => {
      if (!row || !row.completed) {
        setStep(row?.step ?? 0);
        setOpen(true);
      }
    });
  }, [hydrated]);

  useEffect(
    () =>
      on("onboarding:open", () => {
        setStep(0);
        setOpen(true);
      }),
    [],
  );

  const persistStep = useCallback((s: number, completed = false) => {
    void db.onboardingState.put({ id: "state", step: s, completed, updatedAt: Date.now() });
  }, []);

  const go = (delta: number) => {
    const next = Math.min(TOTAL_STEPS - 1, Math.max(0, step + delta));
    setDir(delta >= 0 ? 1 : -1);
    setStep(next);
    persistStep(next);
  };

  const finish = () => {
    persistStep(TOTAL_STEPS - 1, true);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="onboarding-overlay">
      <Card elevated className="onboarding-card">
        <div className="onboarding-dots" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`onboarding-dots__dot ${i === step ? "onboarding-dots__dot--active" : ""}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            className="onboarding-step"
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <StepContent step={step} />
          </motion.div>
        </AnimatePresence>

        <div className="onboarding-footer">
          <div className="onboarding-footer__group">
            {step > 0 && step < TOTAL_STEPS - 1 && (
              <Button variant="ghost" onClick={() => go(-1)}>
                {t("common.back")}
              </Button>
            )}
          </div>
          <div className="onboarding-footer__group">
            {step === 0 && (
              <>
                <Button variant="ghost" onClick={finish}>
                  {t("common.skipAll")}
                </Button>
                <Button variant="primary" onClick={() => go(1)}>
                  {t("common.start")}
                </Button>
              </>
            )}
            {step > 0 && step < TOTAL_STEPS - 1 && (
              <Button variant="primary" onClick={() => go(1)}>
                {t("common.next")}
              </Button>
            )}
            {step === TOTAL_STEPS - 1 && (
              <Button variant="primary" onClick={finish}>
                {t("onboarding.enter")}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function StepContent({ step }: { step: number }) {
  const { t } = useTranslation();
  const setValue = useSettingsStore((s) => s.setValue);
  const setEnabled = useSettingsStore((s) => s.setEnabled);
  const coreValues = useFeatureValues(CORE_FEATURE_ID);
  const clockValues = useFeatureValues(CLOCK_FEATURE_ID);
  const bookmarkEnabled = useSettingsStore((s) => s.enabled[BOOKMARK_FEATURE_ID] ?? true);
  const enabledMap = useSettingsStore((s) => s.enabled);
  const addImageFile = useWallpaperStore((s) => s.addImageFile);
  const fileRef = useRef<HTMLInputElement>(null);

  switch (step) {
    case 0:
      return (
        <>
          <div className="onboarding-welcome-art" aria-hidden>
            <Sparkles size={72} style={{ color: "var(--accent)" }} />
          </div>
          <h2 className="onboarding-step__title">{t("onboarding.welcomeTitle")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.welcomeBody")}</p>
        </>
      );
    case 1:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepTheme")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.stepThemeDesc")}</p>
          <ThemePicker compact />
        </>
      );
    case 2:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepColorMode")}</h2>
          <Segmented
            value={(coreValues.colorMode as string) ?? "system"}
            onChange={(v) => setValue(CORE_FEATURE_ID, "colorMode", v)}
            options={[
              { value: "system", label: t("settings.colorModeSystem") },
              { value: "light", label: t("settings.colorModeLight") },
              { value: "dark", label: t("settings.colorModeDark") },
            ]}
          />
        </>
      );
    case 3:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepWallpaper")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.stepWallpaperDesc")}</p>
          <div className="onboarding-gradient-options">
            <Button onClick={() => setValue(WALLPAPER_FEATURE_ID, "activeId", "")}>
              {t("onboarding.stepWallpaperGradient")}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> {t("wallpaper.upload")}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const id = await addImageFile(f);
                setValue(WALLPAPER_FEATURE_ID, "activeId", id);
              } catch {
                /* size errors surface later in Settings; keep the wizard flowing */
              }
            }}
          />
        </>
      );
    case 4:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepWeather")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.stepWeatherDesc")}</p>
          <TextInput
            placeholder={t("weather.locationPlaceholder")}
            value={(clockValues.location as string) ?? ""}
            onChange={(e) => setValue(CLOCK_FEATURE_ID, "location", e.target.value)}
          />
          <div className="ui-field__row">
            <span className="ui-field__label">{t("weather.useGeolocation")}</span>
            <Toggle
              checked={clockValues.useGeolocation === true}
              onChange={(v) => setValue(CLOCK_FEATURE_ID, "useGeolocation", v)}
            />
          </div>
        </>
      );
    case 5:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepBookmarks")}</h2>
          <p className="onboarding-step__desc">
            {t("onboarding.stepBookmarksDesc")} {t("bookmarks.firstTimeNote")}
          </p>
          <div className="ui-field__row">
            <span className="ui-field__label">{t("onboarding.stepBookmarksEnable")}</span>
            <Toggle
              checked={bookmarkEnabled}
              onChange={async (v) => {
                setEnabled(BOOKMARK_FEATURE_ID, v);
                if (v) await requestBookmarkPermission();
              }}
            />
          </div>
        </>
      );
    case 6:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.stepFeatures")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.stepFeaturesDesc")}</p>
          <div className="onboarding-features">
            {extensionFeatures().map((f) => {
              const Icon = f.icon;
              const enabled = enabledMap[f.id] ?? f.defaultEnabled;
              return (
                <div className="onboarding-feature" key={f.id}>
                  <span className="onboarding-feature__name">
                    <Icon size={16} /> {t(f.nameKey)}
                  </span>
                  <Toggle checked={enabled} onChange={(v) => setEnabled(f.id, v)} />
                </div>
              );
            })}
          </div>
        </>
      );
    default:
      return (
        <>
          <h2 className="onboarding-step__title">{t("onboarding.doneTitle")}</h2>
          <p className="onboarding-step__desc">{t("onboarding.doneBody")}</p>
        </>
      );
  }
}
