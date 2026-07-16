import { defineSchema } from "@/core/settings-engine/schema";

export const wallpaperSettingsSchema = defineSchema({
  randomMode: {
    type: "toggle",
    label: "wallpaper.randomMode",
    description: "wallpaper.randomModeDesc",
    default: false,
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
