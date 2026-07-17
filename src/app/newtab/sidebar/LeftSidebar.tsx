import { Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFeaturesByZone, type FeatureDefinition } from "@/core/feature-registry";
import { useLeftSidebar } from "@/core/layout-engine/leftSidebar";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { IconButton, Skeleton } from "@/shared/ui";
import { clearMagnify, magnify } from "@/shared/utils/dockMagnify";
import { RailScroll } from "./RailScroll";
import "./left-sidebar.css";

export function LeftSidebar() {
  const { t } = useTranslation();
  const features = getFeaturesByZone("left-sidebar");
  const { open, toggle } = useLeftSidebar();
  const enabledMap = useSettingsStore((s) => s.enabled);
  const core = useFeatureValues(CORE_FEATURE_ID);
  const singleOpen = core.sidebarMode !== "multi";
  const panelWidth = typeof core.sidebarWidth === "number" ? core.sidebarWidth : 360;
  const [hovering, setHovering] = useState(false);

  const enabledFeatures = features.filter((f) => enabledMap[f.id] ?? f.defaultEnabled);
  if (enabledFeatures.length === 0) return null;

  // rail is visible when a panel is open, hovering, or "always show" is on
  const alwaysShow = core.alwaysShowDocks === true;
  const railVisible = alwaysShow || hovering || open.length > 0;
  const swapped = core.swapSidebars === true;

  return (
    <>
      <div
        className={`left-sidebar__hover-zone ${swapped ? "left-sidebar__hover-zone--swapped" : ""}`}
        onMouseEnter={() => setHovering(true)}
      />
      <div
        className={`left-sidebar ${swapped ? "left-sidebar--swapped" : ""}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div
          className={`left-rail ${railVisible ? "left-rail--visible" : ""}`}
          onMouseMove={(e) => magnify(e.currentTarget, ".left-rail__trigger", e.clientY)}
          onMouseLeave={(e) => clearMagnify(e.currentTarget, ".left-rail__trigger")}
        >
          <RailScroll count={enabledFeatures.length}>
            {enabledFeatures.map((f) => {
              const Icon = f.icon;
              const active = open.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`left-rail__trigger ${active ? "left-rail__trigger--active" : ""}`}
                  aria-pressed={active}
                  aria-label={t(f.nameKey)}
                  title={t(f.nameKey)}
                  onClick={() => toggle(f.id, singleOpen)}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </RailScroll>
        </div>

        <div className="left-panels">
          {/* single-open: wait for the old panel to fully exit before the new
              one enters, so the container never briefly widens (docs item 11) */}
          <AnimatePresence mode={singleOpen ? "wait" : "sync"}>
            {open.map((id) => {
              const f = enabledFeatures.find((x) => x.id === id);
              return f ? <Panel key={id} feature={f} width={panelWidth} /> : null;
            })}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function Panel({ feature, width }: { feature: FeatureDefinition; width: number }) {
  const { t } = useTranslation();
  const close = useLeftSidebar((s) => s.close);
  const setValue = useSettingsStore((s) => s.setValue);
  const Icon = feature.icon;
  const Content = feature.component;

  // drag the right edge → updates the same setting as the slider (single source)
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = width;
    const move = (ev: PointerEvent) => {
      const w = Math.max(260, Math.min(640, start + (ev.clientX - startX)));
      setValue(CORE_FEATURE_ID, "sidebarWidth", w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <motion.aside
      className="left-panel"
      style={{ width }}
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -40, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="left-panel__header">
        <span className="left-panel__title">
          <Icon size={18} />
          {t(feature.nameKey)}
        </span>
        <IconButton label={t("common.close")} onClick={() => close(feature.id)}>
          <X size={18} />
        </IconButton>
      </div>
      {/* content fades in after the panel has slid into place */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.2 }}
      >
        <Suspense fallback={<Skeleton width="100%" height={200} />}>
          <Content />
        </Suspense>
      </motion.div>
      {/* drag the right edge to resize (persisted) */}
      <div className="left-panel__resize" onPointerDown={startResize} />
    </motion.aside>
  );
}
