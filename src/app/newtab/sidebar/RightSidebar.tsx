import { Suspense, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, PanelRight, Pin, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFeaturesByZone, type FeatureDefinition } from "@/core/feature-registry";
import {
  useWindowManager,
  type ToolWindowState,
  type WindowMode,
} from "@/core/layout-engine/windowManager";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { Skeleton } from "@/shared/ui";
import { clearMagnify, magnify } from "@/shared/utils/dockMagnify";
import { RailScroll } from "./RailScroll";
import "./right-sidebar.css";

/** Fixed stacking depth for docked windows — below the rail (45) and every
 * modal/overlay layer, so a docked window can never cover the dock, the
 * settings modal, or notifications regardless of how many times it (or any
 * other window) has been focused. */
const DOCKED_Z_INDEX = 20;

/**
 * Right sidebar layout engine (Phase 4). Trigger rail on the right opens tool
 * windows managed by the Window Manager (floating drag/resize, dock, minimize,
 * maximize). Rail auto-hides; minimized windows show as active triggers.
 */
export function RightSidebar() {
  const { t } = useTranslation();
  const features = getFeaturesByZone("right-sidebar");
  const enabledMap = useSettingsStore((s) => s.enabled);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const core = useFeatureValues(CORE_FEATURE_ID);
  const restoreWindows = core.restoreWindows !== false;
  const { open, windows, openWindow, close, hydrate, hydrated, restoreOpen, clampToViewport } =
    useWindowManager();
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const enabledFeatures = features.filter((f) => enabledMap[f.id] ?? f.defaultEnabled);

  // restore last session's windows once both stores are ready (opt-out setting)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !hydrated || !settingsHydrated) return;
    restoredRef.current = true;
    if (restoreWindows) restoreOpen(enabledFeatures.map((f) => f.id));
  }, [hydrated, settingsHydrated, restoreWindows, restoreOpen, enabledFeatures]);

  // keep floating windows on-screen when the browser window is resized
  useEffect(() => {
    const onResize = () => clampToViewport();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  if (enabledFeatures.length === 0) return null;

  const alwaysShow = core.alwaysShowDocks === true;
  const swapped = core.swapSidebars === true;
  const overlapMode = (core.dockOverlapMode as string) ?? "shift";
  const dockedOrder = open.filter((id) => windows[id]?.mode === "docked");
  // "shift": rail moves outward so it never overlaps docked windows, and stays
  // visible whenever something is open/docked (default). "overlay": rail stays
  // flush at the edge, layered above docked windows, and only ever shows on
  // hover (or "always show docks") — open/docked windows don't force it visible.
  const forcedVisible = open.length > 0 && overlapMode === "shift";
  const railVisible = forcedVisible || alwaysShow || hovering;
  const DOCK_WIDTH = 360;
  const railRight = overlapMode === "shift" ? dockedOrder.length * DOCK_WIDTH : 0;

  return (
    <>
      <div
        className={`right-sidebar__hover-zone ${swapped ? "right-sidebar__hover-zone--swapped" : ""}`}
        onMouseEnter={() => setHovering(true)}
      />
      <div
        className={`right-rail ${railVisible ? "right-rail--visible" : ""} ${swapped ? "right-rail--swapped" : ""} ${overlapMode === "overlay" ? "right-rail--overlay" : ""}`}
        style={swapped ? { left: railRight } : { right: railRight }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={(e) => {
          setHovering(false);
          clearMagnify(e.currentTarget, ".right-rail__trigger");
        }}
        onMouseMove={(e) => magnify(e.currentTarget, ".right-rail__trigger", e.clientY)}
      >
        <RailScroll count={enabledFeatures.length}>
          {enabledFeatures.map((f) => {
            const Icon = f.icon;
            const active = open.includes(f.id);
            const minimized = windows[f.id]?.mode === "minimized";
            return (
              <button
                key={f.id}
                type="button"
                className={`right-rail__trigger ${active ? "right-rail__trigger--active" : ""}`}
                aria-pressed={active}
                aria-label={t(f.nameKey)}
                title={t(f.nameKey)}
                onClick={() => {
                  // closed → open; minimized → restore; visible → close
                  if (!active || minimized) openWindow(f.id);
                  else close(f.id);
                }}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </RailScroll>
      </div>

      {open.map((id) => {
        const feature = enabledFeatures.find((f) => f.id === id);
        const win = windows[id];
        if (!feature || !win || win.mode === "minimized") return null;
        return (
          <WindowFrame
            key={id}
            feature={feature}
            win={win}
            dockIndex={dockedOrder.indexOf(id)}
            dockCount={dockedOrder.length}
            swapped={swapped}
            overlapMode={overlapMode}
          />
        );
      })}
    </>
  );
}

function WindowFrame({
  feature,
  win,
  dockIndex,
  dockCount,
  swapped,
  overlapMode,
}: {
  feature: FeatureDefinition;
  win: ToolWindowState;
  dockIndex: number;
  dockCount: number;
  swapped: boolean;
  overlapMode: string;
}) {
  const { t } = useTranslation();
  const { focus, close, minimize, toggleMaximize, setMode, setPosition, setSize } =
    useWindowManager();
  const Icon = feature.icon;
  const Content = feature.component;

  const startDrag = (e: React.PointerEvent) => {
    if (win.mode !== "floating") return;
    focus(feature.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = win.position.x;
    const oy = win.position.y;
    const move = (ev: PointerEvent) => {
      setPosition(
        feature.id,
        Math.max(0, Math.min(window.innerWidth - 80, ox + ev.clientX - startX)),
        Math.max(0, Math.min(window.innerHeight - 40, oy + ev.clientY - startY)),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    focus(feature.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const ow = win.size.width;
    const oh = win.size.height;
    const move = (ev: PointerEvent) => {
      setSize(
        feature.id,
        Math.max(260, ow + ev.clientX - startX),
        Math.max(220, oh + ev.clientY - startY),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // position/size per mode
  const dockWidth = 360;
  let style: React.CSSProperties;
  if (win.mode === "docked") {
    const offset = overlapMode === "overlay" ? 0 : dockIndex * dockWidth;
    // Docked windows behave like a pinned panel, not a stackable floating
    // window — they must NOT use the focus-driven win.zIndex (which grows
    // unbounded every time any window is opened/focused and can end up
    // above the rail, the settings modal, or notifications). Fixed and low.
    style = swapped
      ? { left: offset, width: dockWidth, zIndex: DOCKED_Z_INDEX }
      : { right: offset, width: dockWidth, zIndex: DOCKED_Z_INDEX };
  } else if (win.mode === "maximized") {
    style = { zIndex: win.zIndex };
  } else {
    style = {
      left: win.position.x,
      top: win.position.y,
      width: win.size.width,
      height: win.size.height,
      zIndex: win.zIndex,
    };
  }
  void dockCount;

  const cycleDock: WindowMode = win.mode === "docked" ? "floating" : "docked";

  return (
    <div
      className={`tool-window tool-window--${win.mode} ${swapped ? "tool-window--swapped" : ""}`}
      style={style}
      onMouseDown={() => focus(feature.id)}
    >
      <div className="tool-window__header" onPointerDown={startDrag}>
        {/* macOS traffic-light controls — colored dots, icon shows on hover */}
        <div className="tw-lights">
          <button
            className="tw-light tw-light--close"
            title={t("common.close")}
            onClick={() => close(feature.id)}
          >
            <X size={9} />
          </button>
          <button
            className="tw-light tw-light--min"
            title={t("common.minimize")}
            onClick={() => minimize(feature.id)}
          >
            <Minus size={9} />
          </button>
          <button
            className="tw-light tw-light--max"
            title={win.mode === "maximized" ? t("common.restore") : t("common.maximize")}
            onClick={() => toggleMaximize(feature.id)}
          >
            {win.mode === "maximized" ? <Square size={7} /> : <Maximize2 size={8} />}
          </button>
        </div>
        <span className="tool-window__title">
          <Icon size={14} />
          {t(feature.nameKey)}
        </span>
        <button
          className="tool-window__dock"
          title={cycleDock === "docked" ? t("common.dock") : t("common.float")}
          onClick={() => setMode(feature.id, cycleDock)}
        >
          {win.mode === "docked" ? <Pin size={13} /> : <PanelRight size={13} />}
        </button>
      </div>
      <div className="tool-window__body">
        <Suspense fallback={<Skeleton width="100%" height={160} />}>
          <Content />
        </Suspense>
      </div>
      {win.mode === "floating" && <div className="tool-window__resize" onPointerDown={startResize} />}
    </div>
  );
}
