import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { useTranslation } from "react-i18next";
import {
  Ban,
  ExternalLink,
  Globe,
  House,
  LayoutGrid,
  Loader2,
  Play,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
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
  siteUrl,
  type EmbedRunResult,
} from "@/core/messaging";
import { EMBED_CATALOG, EMBED_SETTINGS_ID, type EmbedToolEntry } from "@/features/embed/catalog";
import { coreSettingsSchema } from "@/app/newtab/settings/coreSettings";
import { Button, Collapsible } from "@/shared/ui";
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

  const isWeb = tab?.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"));

  const openSite = useCallback((route: string, appId?: string) => {
    // the count is what orders the shortcut row next time; recorded before
    // navigating away because the popup is destroyed the moment it opens a tab
    const tracked = appId ? trackAppOpen(appId) : Promise.resolve();
    void tracked
      .then(() => sendToBackground({ type: "site:open", route }))
      // worker unreachable (e.g. mid-update): open the page directly rather than do nothing
      .catch(() => browser.tabs.create({ url: siteUrl(route) }))
      .then(() => window.close());
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
        <span className="popup__logo" aria-hidden>
          <LayoutGrid size={15} />
        </span>
        <span className="popup__brand">Tools & Apps</span>
        <span className="popup__version">v{browser.runtime.getManifest().version}</span>
        <Button size="sm" variant="primary" className="popup__home" onClick={() => openSite("/")}>
          <House size={14} />
          {t("popup.home")}
        </Button>
      </header>

      <Collapsible
        id="popup.apps"
        title={showAllApps ? t("popup.apps") : t("popup.appsFrequent")}
        icon={LayoutGrid}
        action={
          apps.length > SHORTCUT_COUNT && (
            <button type="button" className="popup__chip" onClick={() => setShowAllApps((v) => !v)}>
              {showAllApps ? t("popup.showLess") : t("popup.showAllApps", { count: apps.length })}
            </button>
          )
        }
      >
        {apps.length === 0 ? (
          <p className="popup__empty">{t("popup.noApps")}</p>
        ) : (
          <ul className="popup__grid">
            {shownApps.map((app) => (
              <li key={app.id}>
                {/* icon + name only; the description is the tooltip — an
                    overlay covering the whole tile read as a glitch */}
                <button
                  type="button"
                  className="popup__tile"
                  onClick={() => {
                    const route =
                      app.id === "link-preview" && isWeb
                        ? `${app.path}?url=${encodeURIComponent(tab.url!)}`
                        : app.path;
                    openSite(route, app.id);
                  }}
                  title={t(app.descKey)}
                >
                  <span className="popup__tile-icon">
                    <app.icon size={18} />
                  </span>
                  <span className="popup__tile-name">{t(app.nameKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>

      {widgets.map((w) => (
        <w.component key={w.id} />
      ))}

      <Collapsible
        id="popup.page"
        title={t("popup.onThisPage")}
        icon={Globe}
        hint={
          tabReady && !canEmbed ? (
            <span className="popup__hint">
              <Ban size={11} /> {t("popup.cannotRunHereShort")}
            </span>
          ) : undefined
        }
      >
        {!isWeb && EMBED_CATALOG.length === 0 ? (
          <p className="popup__empty">{t("popup.noTools")}</p>
        ) : (
          <ul className="popup__list">
            {isWeb && (
              <li>
                <button
                  type="button"
                  className="popup__row"
                  onClick={() =>
                    openSite(`/link-preview?url=${encodeURIComponent(tab.url!)}`, "link-preview")
                  }
                >
                  <Share2 size={16} className="popup__row-icon" />
                  <span className="popup__row-text">
                    <span className="popup__row-name">{t("popup.linkPreview")}</span>
                    <span className="popup__row-desc">{t("popup.linkPreviewDesc")}</span>
                  </span>
                  <ExternalLink size={13} className="popup__row-chevron" />
                </button>
              </li>
            )}
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
      </Collapsible>
    </>
  );
}
