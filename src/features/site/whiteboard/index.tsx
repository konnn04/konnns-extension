import { lazy } from "react";
import { PenTool } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { whiteboard: vi },
  en: { whiteboard: en },
});

registerSiteApp({
  id: "whiteboard",
  path: "/whiteboard",
  nameKey: "site.apps.whiteboard.name",
  descKey: "site.apps.whiteboard.desc",
  icon: PenTool,
  category: "other",
  fullBleed: true,
  order: 32,
  dataTables: ["boards", "boardFiles"],
  // lazy so Excalidraw (+ roughjs, perfect-freehand, its ~1MB bundle) stays out of the site home bundle
  component: lazy(() => import("./Whiteboard")),
});
