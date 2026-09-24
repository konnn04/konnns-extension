import { lazy } from "react";
import { Clock } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "web-time-tracker",
  path: "/time-tracker",
  nameKey: "site.apps.web-time-tracker.name",
  descKey: "site.apps.web-time-tracker.desc",
  icon: Clock,
  category: "other",
  order: 20,
  // lazy so this stays out of the site home bundle for anyone who never opens it
  component: lazy(() => import("./TimeTrackerDashboard")),
});
