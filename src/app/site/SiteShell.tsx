import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { House, Info, PanelLeftClose, PanelLeftOpen, PanelsTopLeft } from "lucide-react";
import { matchSiteApp, getVisibleSiteApps } from "@/core/site-registry";
import { useHashRoute } from "@/core/router/useHashRoute";
import { ensurePersistentStorage } from "@/core/storage/persistence";
import { Modal, Skeleton } from "@/shared/ui";
import { HomePage } from "./pages/HomePage";
import { QuickSettings } from "./QuickSettings";
import { NotFound } from "./pages/NotFound";
import { ContributePanel } from "../newtab/settings/ContributePanel";

const RAIL_KEY = "site.rail.collapsed";

export function SiteShell() {
  const { t } = useTranslation();
  const route = useHashRoute();
  const apps = useMemo(() => getVisibleSiteApps(), []);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    void ensurePersistentStorage();
  }, []);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === "1";
    } catch {
      // private windows and blocked site data both throw here
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
    } catch {
      /* not worth surfacing: the rail still works, it just forgets */
    }
  }, [collapsed]);

  const isHome = route.path === "/";
  const active = isHome ? undefined : matchSiteApp(route.path);
  const Content = active?.component;
  const isZen = route.query.zen === "1";

  return (
    <div className={`site ${isZen ? "site--zen" : ""}`}>
      {!isZen && (
        <header className="site__topbar">
          <button
            type="button"
            className="site__rail-toggle"
            aria-expanded={!collapsed}
            title={t(collapsed ? "site.expandRail" : "site.collapseRail")}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <a className="site__brand" href="#/">
            <PanelsTopLeft size={18} />
            <span>{t("site.title")}</span>
          </a>
          {active && <span className="site__crumb">{t(active.nameKey)}</span>}
          <span className="site__topbar-spacer" />
          <QuickSettings />
        </header>
      )}

      <div className={`site__body ${isZen ? "site__body--zen" : collapsed ? "site__body--rail-collapsed" : ""}`}>
        {!isZen && (
          <nav className="site__rail" aria-label={t("site.title")}>

            <a
              className={`site__rail-item ${isHome ? "site__rail-item--active" : ""}`}
              href="#/"
              title={t("site.nav.home")}
            >
              <House size={18} />
              <span className="site__rail-label">{t("site.nav.home")}</span>
            </a>
            {apps.map((app) => (
              <a
                key={app.id}
                className={`site__rail-item ${active?.id === app.id ? "site__rail-item--active" : ""}`}
                href={`#${app.path}`}
                title={t(app.nameKey)}
              >
                <app.icon size={18} />
                <span className="site__rail-label">{t(app.nameKey)}</span>
              </a>
            ))}
            <div className="site__rail-footer">
              <button
                type="button"
                className="site__rail-item site__rail-item--btn site__rail-item--info"
                title={t("settings.contribute")}
                onClick={() => setShowInfo(true)}
              >
                <Info size={18} />
                <span className="site__rail-label">{t("settings.contribute")}</span>
              </button>
            </div>
          </nav>
        )}

        <main className={`site__main ${active?.fullBleed ? "site__main--bleed" : ""}`}>
          {isHome ? (
            <HomePage />
          ) : Content ? (
            <Suspense fallback={<AppSkeleton />}>
              <Content />
            </Suspense>
          ) : (
            <NotFound path={route.path} />
          )}
        </main>
      </div>

      <Modal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title={t("settings.contribute")}
        width="min(92vw, 840px)"
      >
        <div style={{ maxHeight: "78vh", overflowY: "auto", padding: "1rem" }}>
          <ContributePanel />
        </div>
      </Modal>
    </div>
  );
}

function AppSkeleton() {
  return (
    <div className="site__skeleton">
      <Skeleton height={34} width="42%" radius="var(--radius-md)" />
      <Skeleton height={180} radius="var(--radius-lg)" />
      <Skeleton height={120} radius="var(--radius-lg)" />
    </div>
  );
}
