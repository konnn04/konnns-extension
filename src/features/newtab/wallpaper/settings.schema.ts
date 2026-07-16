import { defineSchema } from "@/core/settings-engine/schema";

export const wallpaperSettingsSchema = defineSchema({
  mode: {
    type: "select",
    label: "wallpaper.mode",
    description: "wallpaper.modeDesc",
    options: [
      { value: "static", label: "wallpaper.modeStatic" },
      { value: "slideshow", label: "wallpaper.modeSlideshow" },
    ],
    default: "static",
  },
  slideInterval: {
    type: "slider",
    label: "wallpaper.slideInterval",
    description: "wallpaper.slideIntervalDesc",
    min: 5,
    max: 300,
    step: 5,
    default: 30,
    showIf: (v) => v.mode === "slideshow",
  },
  slideOrder: {
    type: "select",
    label: "wallpaper.slideOrder",
    options: [
      { value: "sequential", label: "wallpaper.slideSequential" },
      { value: "random", label: "wallpaper.slideRandom" },
    ],
    default: "sequential",
    showIf: (v) => v.mode === "slideshow",
  },
  randomMode: {
    type: "toggle",
    label: "wallpaper.randomMode",
    description: "wallpaper.randomModeDesc",
    default: false,
    showIf: (v) => v.mode !== "slideshow",
  },
  videoSound: { type: "toggle", label: "wallpaper.videoSound", default: false },
  videoVolume: {
    type: "slider",
    label: "wallpaper.videoVolume",
    min: 1,
    max: 100,
    step: 1,
    default: 50,
    showIf: (v) => v.videoSound === true,
  },
  pauseWhenHidden: {
    type: "toggle",
    label: "wallpaper.pauseWhenHidden",
    description: "wallpaper.pauseWhenHiddenDesc",
    default: true,
  },
});
