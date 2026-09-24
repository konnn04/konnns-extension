import { lazy } from "react";
import { Eraser } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "auto-clear-cache",
  path: "/auto-clear-cache",
  nameKey: "site.apps.auto-clear-cache.name",
  descKey: "site.apps.auto-clear-cache.desc",
  icon: Eraser,
  category: "other",
  order: 33,
  component: lazy(() => import("./AutoClearCache")),
});
