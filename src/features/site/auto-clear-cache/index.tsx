import { lazy } from "react";
import { Eraser } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { autoClearCache: vi },
  en: { autoClearCache: en },
});

registerSiteApp({
  id: "auto-clear-cache",
  path: "/auto-clear-cache",
  nameKey: "site.apps.auto-clear-cache.name",
  descKey: "site.apps.auto-clear-cache.desc",
  icon: Eraser,
  category: "other",
  order: 33,
  dataTables: ["autoClearSettings", "clearLog"],
  component: lazy(() => import("./AutoClearCache")),
});
