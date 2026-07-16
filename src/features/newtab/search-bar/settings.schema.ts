import { defineSchema } from "@/core/settings-engine/schema";
import { engines } from "./engines";

export const searchSettingsSchema = defineSchema({
  engine: {
    type: "select",
    label: "search.engine",
    options: [
      ...engines.map((e) => ({ value: e.id, label: e.label })),
      { value: "custom", label: "Custom" },
    ],
    default: "google",
  },
  customUrl: {
    type: "text",
    label: "search.customUrl",
    description: "search.customUrlDesc",
    placeholder: "search.customUrlDesc",
    showIf: (v) => v.engine === "custom",
  },
  autofocus: { type: "toggle", label: "search.autofocus", default: true },
  position: {
    type: "select",
    label: "search.position",
    options: [
      { value: "center", label: "search.positionCenter" },
      { value: "top", label: "search.positionTop" },
    ],
    default: "center",
  },
  maxWidth: { type: "slider", label: "search.maxWidth", min: 360, max: 900, step: 20, default: 620 },
  opacity: { type: "slider", label: "search.opacity", min: 20, max: 100, step: 5, default: 100 },
  blur: { type: "slider", label: "search.blur", min: 0, max: 30, step: 1, default: 16 },
});
