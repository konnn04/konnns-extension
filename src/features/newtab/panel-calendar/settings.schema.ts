import { defineSchema } from "@/core/settings-engine/schema";

export const calendarSettingsSchema = defineSchema({
  showLunar: { type: "toggle", label: "calendar.showLunar", default: true },
  useGoogle: {
    type: "toggle",
    label: "calendar.useGoogle",
    description: "calendar.useGoogleDesc",
    default: false,
  },
  clientId: {
    type: "text",
    label: "calendar.clientId",
    description: "calendar.clientIdDesc",
    showIf: (v) => v.useGoogle === true,
  },
});
