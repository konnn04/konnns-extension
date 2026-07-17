import { defineSchema } from "@/core/settings-engine/schema";

export const musicboxSettingsSchema = defineSchema({
  autoPlayOnOpen: {
    type: "toggle",
    label: "musicbox.autoPlayOnOpen",
    description: "musicbox.autoPlayOnOpenDesc",
    default: false,
  },
  randomOnOpen: {
    type: "toggle",
    label: "musicbox.randomOnOpen",
    description: "musicbox.randomOnOpenDesc",
    default: false,
  },
  onlyPlayInNewTab: {
    type: "toggle",
    label: "musicbox.onlyPlayInNewTab",
    description: "musicbox.onlyPlayInNewTabDesc",
    default: false,
  },
  showCornerStatus: {
    type: "toggle",
    label: "musicbox.showCornerStatus",
    description: "musicbox.showCornerStatusDesc",
    default: true,
  },
  showVisualizer: {
    type: "toggle",
    label: "musicbox.showVisualizer",
    description: "musicbox.showVisualizerDesc",
    default: false,
  },
});
