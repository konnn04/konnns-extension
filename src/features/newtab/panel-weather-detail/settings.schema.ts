import { defineSchema } from "@/core/settings-engine/schema";

export const weatherDetailSettingsSchema = defineSchema({
  showStats: { type: "toggle", label: "weatherDetail.showStats", default: true },
  showSun: { type: "toggle", label: "weatherDetail.showSun", default: true },
  showHourly: { type: "toggle", label: "weatherDetail.showHourly", default: true },
  showDaily: { type: "toggle", label: "weatherDetail.showDaily", default: true },
});
