import { defineSchema } from "@/core/settings-engine/schema";

export const avatarSettingsSchema = defineSchema({
  shape: {
    type: "select",
    label: "avatar.shape",
    options: [
      { value: "circle", label: "avatar.shapeCircle" },
      { value: "rounded", label: "avatar.shapeRounded" },
      { value: "square", label: "avatar.shapeSquare" },
    ],
    default: "circle",
  },
  size: { type: "slider", label: "avatar.size", min: 48, max: 180, step: 4, default: 96 },
  showGreeting: { type: "toggle", label: "avatar.showGreeting", default: false },
  greetingName: {
    type: "text",
    label: "avatar.greetingName",
    placeholder: "avatar.greetingNamePlaceholder",
    showIf: (v) => v.showGreeting === true,
  },
});
