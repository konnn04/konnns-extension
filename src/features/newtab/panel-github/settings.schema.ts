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
  showRecentRepos: {
    type: "toggle",
    label: "github.showRecentRepos",
    default: true,
  },
  showLanguageStats: {
    type: "toggle",
    label: "github.showLanguageStats",
    description: "github.showLanguageStatsDesc",
    default: false,
  },
  excludedLanguages: {
    type: "text",
    label: "github.excludedLanguages",
    description: "github.excludedLanguagesDesc",
    placeholder: "github.excludedLanguagesPlaceholder",
    showIf: (v) => v.showLanguageStats === true,
  },
});
