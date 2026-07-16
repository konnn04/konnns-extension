import { defineSchema } from "@/core/settings-engine/schema";

export const bookmarkSettingsSchema = defineSchema({
  orientation: {
    type: "select",
    label: "bookmarks.orientation",
    options: [
      { value: "horizontal", label: "bookmarks.orientationH" },
      { value: "vertical", label: "bookmarks.orientationV" },
      { value: "radial", label: "bookmarks.orientationRadial" },
    ],
    default: "horizontal",
  },
  showMode: {
    type: "select",
    label: "bookmarks.showMode",
    options: [
      { value: "always", label: "bookmarks.showAlways" },
      { value: "hover", label: "bookmarks.showHover" },
    ],
    default: "always",
  },
});
