import { lazy } from "react";
import { Clock } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { timeTracker: vi },
  en: { timeTracker: en },
});

registerSiteApp({
  id: "web-time-tracker",
  path: "/time-tracker",
  nameKey: "site.apps.web-time-tracker.name",
  descKey: "site.apps.web-time-tracker.desc",
  icon: Clock,
  category: "other",
  order: 20,
  dataTables: ["activitySessions", "dailyTotals", "trackerSettings"],
  // lazy so this stays out of the site home bundle for anyone who never opens it
  component: lazy(() => import("./TimeTrackerDashboard")),
});
