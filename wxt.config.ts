import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "My NewTab",
    description: "Personal NewTab — search, clock, weather, wallpaper, bookmarks",
    permissions: ["storage", "unlimitedStorage", "alarms", "geolocation", "identity"] as string[],
    optional_permissions: ["bookmarks", "notifications", "topSites"],
    optional_host_permissions: ["*://*/*"],
    browser_specific_settings: {
      gecko: {
        id: "my-newtab@example.com",
        strict_min_version: "112.0",
      },
    },
  },
});
