import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { useTranslation } from "react-i18next";
import { Ban, House, Loader2, Play, SlidersHorizontal } from "lucide-react";
import {
  CORE_FEATURE_ID,
  coreSettingsSchemaRef,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { schemaDefaults } from "@/core/settings-engine/schema";
import { SettingsForm } from "@/core/settings-engine/SettingsForm";
import { useThemeEngine } from "@/core/theme-engine/useTheme";
import { useFontEngine } from "@/core/font-engine";
import { setLanguage } from "@/core/i18n";
import { getVisibleSiteApps } from "@/core/site-registry";
import { getPopupWidgets } from "@/core/popup-widget-registry";
import { pickTop, trackAppOpen, loadUsage, type UsageDay } from "@/core/app-usage";
import {
  getActiveTab,
  isInjectableUrl,
  runEmbedTool,
  sendToBackground,
  type EmbedRunResult,
} from "@/core/messaging";
import { EMBED_CATALOG, EMBED_SETTINGS_ID, type EmbedToolEntry } from "@/features/embed/catalog";
import { coreSettingsSchema } from "@/app/newtab/settings/coreSettings";
import { Button } from "@/shared/ui";
import { ToolResultCard } from "./ToolResultCard";
import "./popup.css";

/**
 * Toolbar popup — the entry point to everything (docs/architecture.md §7).
 * Two jobs: open the Custom Site, and run an embedded tool on the current tab.
 * It owns no features of its own; both lists are generated from registries.
 */

coreSettingsSchemaRef.current = coreSettingsSchema;

export default function PopupApp() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useThemeEngine();
  useFontEngine();

  const lang = useFeatureValues(CORE_FEATURE_ID).language as string | undefined;
  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  // Render the frame immediately so the popup never flashes blank.
  return <div className="popup">{hydrated ? <PopupBody /> : null}</div>;
}

type RunState =
  | { status: "idle" }
  | { status: "running"; toolId: string }
  | { status: "done"; toolId: string; result: EmbedRunResult }
  | { status: "error"; toolId: string; message: string };

function PopupBody() {
  const { t } = useTranslation();
  const apps = useMemo(() => getVisibleSiteApps(), []);
  const widgets = useMemo(() => getPopupWidgets(), []);
  const [tab, setTab] = useState<{ id: number; url?: string } | null>(null);
  const [tabReady, setTabReady] = useState(false);
  const [usage, setUsage] = useState<UsageDay[]>([]);
  const [showAllApps, setShowAllApps] = useState(false);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [openOptions, setOpenOptions] = useState<string | null>(null);
  const allValues = useSettingsStore((s) => s.values);

  useEffect(() => {
    void getActiveTab().then((x) => {
      setTab(x);
      setTabReady(true);
    });
    void loadUsage().then(setUsage);
  }, []);

  const SHORTCUT_COUNT = 3;
  const shownApps = useMemo(() => {
    if (showAllApps) return apps;
    const topIds = pickTop(usage, apps.map((a) => a.id), SHORTCUT_COUNT);
    return topIds.map((id) => apps.find((a) => a.id === id)!).filter(Boolean);
  }, [apps, usage, showAllApps]);

  const canEmbed = tab !== null && isInjectableUrl(tab.url);

  const openSite = useCallback((route: string, appId?: string) => {
    // the count is what orders the shortcut row next time; recorded before
    // navigating away because the popup is destroyed the moment it opens a tab
    const tracked = appId ? trackAppOpen(appId) : Promise.resolve();
    void tracked.then(() => sendToBackground({ type: "site:open", route })).then(() => window.close());
  }, []);

  const onRun = useCallback(
    async (tool: EmbedToolEntry) => {
      if (!tab) return;
      setRun({ status: "running", toolId: tool.id });
      // A content script lives in the page origin and cannot read the
      // extension Dexie, so the resolved options travel with the request.
      const featureId = EMBED_SETTINGS_ID[tool.id];
      const params = {
        ...schemaDefaults(tool.settingsSchema),
        ...(featureId ? (allValues[featureId] ?? {}) : {}),
      };
      try {
        const result = await runEmbedTool(tab.id, tool.id, params);
        setRun({ status: "done", toolId: tool.id, result });
      } catch (e) {
        setRun({
          status: "error",
          toolId: tool.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [tab, allValues],
  );

  if (run.status === "done") {
    return (
      <ToolResultCard
        result={run.result}
        onBack={() => setRun({ status: "idle" })}
        onOpenInSite={openSite}
      />
    );
  }

  return (
    <>
      <header className="popup__header">
        <span className="popup__brand">Tools & Apps </span>
        <span className="popup__version">v{browser.runtime.getManifest().version}</span>
      </header>

      <Button variant="primary" className="popup__home" onClick={() => openSite("/")}>
        <House size={16} />
        {t("popup.openHome")}
      </Button>

      <section className="popup__section">
        <div className="popup__label-row">
          <h2 className="popup__label">{showAllApps ? t("popup.apps") : t("popup.appsFrequent")}</h2>
          {apps.length > SHORTCUT_COUNT && (
            <button type="button" className="popup__link" onClick={() => setShowAllApps((v) => !v)}>
              {showAllApps ? t("popup.showLess") : t("popup.showAllApps", { count: apps.length })}
            </button>
          )}
        </div>

        {apps.length === 0 ? (
          <p className="popup__empty">{t("popup.noApps")}</p>
        ) : (
          <ul className="popup__grid">
            {shownApps.map((app) => (
              <li key={app.id}>
                {/* the description is a hover/focus overlay, not a second
                    line — a grid of tiles stays scannable only if each tile
                    is icon + name, and the popup has no room for both */}
                <button
                  type="button"
                  className="popup__tile"
                  onClick={() => openSite(app.path, app.id)}
                  title={t(app.descKey)}
                >
                  <app.icon size={20} className="popup__tile-icon" />
                  <span className="popup__tile-name">{t(app.nameKey)}</span>
                  <span className="popup__tile-desc">{t(app.descKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {widgets.map((w) => (
        <w.component key={w.id} />
      ))}

      <section className="popup__section">
        <h2 className="popup__label">{t("popup.onThisPage")}</h2>
        {tabReady && !canEmbed && (
          <p className="popup__empty popup__empty--warn">
            <Ban size={13} /> {t("popup.cannotRunHere")}
          </p>
        )}
        {EMBED_CATALOG.length === 0 ? (
          <p className="popup__empty">{t("popup.noTools")}</p>
        ) : (
          <ul className="popup__list">
            {EMBED_CATALOG.map((tool) => {
              const busy = run.status === "running" && run.toolId === tool.id;
              const optionsOpen = openOptions === tool.id;
              const featureId = EMBED_SETTINGS_ID[tool.id];
              return (
                <li key={tool.id}>
                  <div className="popup__row-group">
                    <button
                      type="button"
                      className="popup__row"
                      disabled={!canEmbed || run.status === "running"}
                      onClick={() => void onRun(tool)}
                    >
                      {busy ? (
                        <Loader2 size={16} className="popup__row-icon popup__spin" />
                      ) : (
                        <tool.icon size={16} className="popup__row-icon" />
                      )}
                      <span className="popup__row-text">
                        <span className="popup__row-name">{t(tool.nameKey)}</span>
                        <span className="popup__row-desc">
                          {busy ? t("popup.running") : tool.descKey ? t(tool.descKey) : ""}
                        </span>
                      </span>
                      <Play size={13} className="popup__row-chevron" />
                    </button>
                    {tool.settingsSchema && featureId && (
                      <button
                        type="button"
                        className={`popup__opts-btn ${optionsOpen ? "popup__opts-btn--on" : ""}`}
                        aria-label={t("popup.options")}
                        aria-expanded={optionsOpen}
                        title={t("popup.options")}
                        onClick={() => setOpenOptions(optionsOpen ? null : tool.id)}
                      >
                        <SlidersHorizontal size={14} />
                      </button>
                    )}
                  </div>
                  {optionsOpen && tool.settingsSchema && featureId && (
                    <div className="popup__options">
                      <SettingsForm featureId={featureId} schema={tool.settingsSchema} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {run.status === "error" && <p className="popup__error">{t(run.message)}</p>}
      </section>
    </>
  );
}
