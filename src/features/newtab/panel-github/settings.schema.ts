import { defineSchema } from "@/core/settings-engine/schema";

export const githubSettingsSchema = defineSchema({
  token: {
    type: "text",
    label: "github.token",
    description: "github.tokenDesc",
    secret: true,
  },
  showTrending: {
    type: "toggle",
    label: "github.showTrending",
    description: "github.showTrendingDesc",
    default: false,
  },
});
