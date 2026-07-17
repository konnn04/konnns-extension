import { defineSchema, type SettingsSchema } from "@/core/settings-engine/schema";

/**
 * "General" and "Appearance" are the two built-in (non-feature) settings
 * categories. Both persist under featureId "core"; they're split only for the
 * settings UI (docs/core-he-thong/02 — General category, plus an Appearance tab).
 */


export const coreGeneralSchema = defineSchema({
  language: {
    type: "select",
    label: "settings.language",
    options: [
      { value: "vi", label: "Tiếng Việt" },
      { value: "en", label: "English" },
    ],
    default: "vi",
  },
  lowPower: {
    type: "toggle",
    label: "settings.lowPower",
    description: "settings.lowPowerDesc",
    default: false,
  },
  sidebarMode: {
    type: "select",
    label: "settings.sidebarMode",
    description: "settings.sidebarModeDesc",
    options: [
      { value: "single", label: "settings.sidebarSingle" },
      { value: "multi", label: "settings.sidebarMulti" },
    ],
    default: "single",
  },
  sidebarWidth: {
    type: "slider",
    label: "settings.sidebarWidth",
    description: "settings.sidebarWidthDesc",
    min: 260,
    max: 640,
    step: 10,
    default: 360,
  },
  panelHeight: {
    type: "slider",
    label: "settings.panelHeight",
    description: "settings.panelHeightDesc",
    min: 50,
    max: 100,
    step: 1,
    default: 100,
  },
  panelRadius: {
    type: "slider",
    label: "settings.panelRadius",
    min: 0,
    max: 24,
    step: 1,
    default: 0,
  },
  restoreWindows: {
    type: "toggle",
    label: "settings.restoreWindows",
    description: "settings.restoreWindowsDesc",
    default: true,
  },
  alwaysShowDocks: {
    type: "toggle",
    label: "settings.alwaysShowDocks",
    description: "settings.alwaysShowDocksDesc",
    default: false,
  },
  soundEnabled: { type: "toggle", label: "sound.enabled", default: false },
  soundVolume: {
    type: "slider",
    label: "sound.volume",
    min: 0,
    max: 100,
    step: 5,
    default: 60,
    showIf: (v) => v.soundEnabled === true,
  },
  clickSound: {
    type: "toggle",
    label: "sound.click",
    default: false,
    showIf: (v) => v.soundEnabled === true,
  },
});

export const coreAppearanceSchema = defineSchema({
  colorMode: {
    type: "select",
    label: "settings.colorMode",
    options: [
      { value: "system", label: "settings.colorModeSystem" },
      { value: "light", label: "settings.colorModeLight" },
      { value: "dark", label: "settings.colorModeDark" },
    ],
    default: "system",
  },
  bgDim: {
    type: "slider",
    label: "settings.bgDim",
    description: "settings.bgDimDesc",
    min: 0,
    max: 80,
    step: 5,
    default: 35,
  },
  bgBlur: {
    type: "slider",
    label: "settings.bgBlur",
    min: 0,
    max: 24,
    step: 1,
    default: 0,
  },
  panelAlpha: {
    type: "slider",
    label: "settings.panelAlpha",
    description: "settings.panelAlphaDesc",
    min: 20,
    max: 100,
    step: 5,
    default: 85,
  },
  panelBlur: {
    type: "slider",
    label: "settings.panelBlur",
    description: "settings.panelBlurDesc",
    min: 0,
    max: 30,
    step: 1,
    default: 16,
  },
  parallax: {
    type: "toggle",
    label: "settings.parallax",
    description: "settings.parallaxDesc",
    default: false,
  },
  cursorEffect: {
    type: "select",
    label: "cursor.effect",
    options: [
      { value: "none", label: "cursor.effectNone" },
      { value: "hearts", label: "cursor.effectHearts" },
      { value: "stars", label: "cursor.effectStars" },
      { value: "flowers", label: "cursor.effectFlowers" },
    ],
    default: "none",
  },
  bgEffect: {
    type: "select",
    label: "bgfx.effect",
    description: "bgfx.effectDesc",
    options: [
      { value: "none", label: "bgfx.none" },
      { value: "sparkle", label: "bgfx.sparkle" },
      { value: "galaxy", label: "bgfx.galaxy" },
    ],
    default: "none",
  },
  bgEffectColor: { type: "color", label: "bgfx.tint" },
});

export const coreSettingsSchema: SettingsSchema = {
  ...coreGeneralSchema,
  ...coreAppearanceSchema,
};
