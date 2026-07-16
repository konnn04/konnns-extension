import { defineSchema } from "@/core/settings-engine/schema";

export const englishSettingsSchema = defineSchema({
  wordsPerDay: {
    type: "slider",
    label: "english.wordsPerDay",
    min: 5,
    max: 10,
    step: 1,
    default: 6,
  },
  showFirstOpen: {
    type: "toggle",
    label: "english.showFirstOpen",
    description: "english.showFirstOpenDesc",
    default: true,
  },
  resetHour: {
    type: "slider",
    label: "english.resetHour",
    description: "english.resetHourDesc",
    min: 0,
    max: 23,
    step: 1,
    default: 3,
  },
});
