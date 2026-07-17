import { useEffect } from "react";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { getTheme, DEFAULT_THEME_ID, type ColorMode, type ThemePalette } from "./themes";

/** Applies the active theme's tokens to :root, with a ~300ms crossfade after first paint. */

function applyPalette(p: ThemePalette) {
  const root = document.documentElement;
  const map: Record<string, string> = {
    "--bg": p.bg,
    "--surface": p.surface,
    "--surface-elevated": p.surfaceElevated,
    "--text": p.text,
    "--text-muted": p.textMuted,
    "--accent": p.accent,
    "--accent-contrast": p.accentContrast,
    "--border": p.border,
    "--overlay": p.overlay,
    "--shadow-color": p.shadowColor,
    "--theme-gradient": p.gradient,
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
}

export function useResolvedColorMode(): "light" | "dark" {
  const values = useFeatureValues(CORE_FEATURE_ID);
  const mode = (values.colorMode as ColorMode) ?? "system";
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export function useActiveTheme() {
  const values = useFeatureValues(CORE_FEATURE_ID);
  return getTheme((values.themeId as string) ?? DEFAULT_THEME_ID);
}

export function useThemeEngine(): void {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const theme = useActiveTheme();
  const resolved = useResolvedColorMode();
  const lowPower = useFeatureValues(CORE_FEATURE_ID).lowPower === true;

  useEffect(() => {
    if (!hydrated) return;
    applyPalette(resolved === "dark" ? theme.dark : theme.light);
    document.documentElement.dataset.colorMode = resolved;
    document.documentElement.dataset.theme = theme.id;
  }, [hydrated, theme, resolved]);

  useEffect(() => {
    document.documentElement.dataset.lowPower = lowPower ? "true" : "false";
  }, [lowPower]);

  // Appearance controls (dim / blur / glass transparency) → CSS variables
  const core = useFeatureValues(CORE_FEATURE_ID);
  const bgDim = typeof core.bgDim === "number" ? core.bgDim : 35;
  const bgBlur = typeof core.bgBlur === "number" ? core.bgBlur : 0;
  const panelAlpha = typeof core.panelAlpha === "number" ? core.panelAlpha : 85;
  const panelBlur = typeof core.panelBlur === "number" ? core.panelBlur : 16;
  const panelHeight = typeof core.panelHeight === "number" ? core.panelHeight : 100;
  const panelRadius = typeof core.panelRadius === "number" ? core.panelRadius : 0;
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--wallpaper-dim", String(bgDim / 100));
    root.setProperty("--wallpaper-blur", `${bgBlur}px`);
    root.setProperty("--panel-alpha", String(panelAlpha / 100));
    root.setProperty("--glass-blur", `${panelBlur}px`);
    root.setProperty("--panel-height", `${panelHeight}vh`);
    root.setProperty("--panel-radius", `${panelRadius}px`);
  }, [bgDim, bgBlur, panelAlpha, panelBlur, panelHeight, panelRadius]);

  // Overall UI scale / font scale / compact mode
  const uiScale = typeof core.uiScale === "number" ? core.uiScale : 100;
  const fontScale = typeof core.fontScale === "number" ? core.fontScale : 100;
  const compactMode = core.compactMode === true;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", String(uiScale / 100));
    root.style.fontSize = `${(16 * fontScale) / 100}px`;
    root.dataset.compact = compactMode ? "true" : "false";
  }, [uiScale, fontScale, compactMode]);

  // Enable token crossfade only after first paint (avoid animating initial load)
  useEffect(() => {
    if (!hydrated) return;
    const t = requestAnimationFrame(() => {
      document.documentElement.dataset.themeTransitions = "true";
    });
    return () => cancelAnimationFrame(t);
  }, [hydrated]);

  // Re-resolve on OS color-scheme change while in "system" mode
  const setValue = useSettingsStore((s) => s.setValue);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      // touching the store re-runs selectors; value unchanged ("system" stays "system")
      const mode = useSettingsStore.getState().values[CORE_FEATURE_ID]?.colorMode ?? "system";
      if (mode === "system") setValue(CORE_FEATURE_ID, "colorMode", "system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setValue]);
}
