import { lazy } from "react";
import { FileText } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

/**
 * Landing spot for a clip handed over by the popup (#/clip/<handoff id>).
 * Hidden from the home grid: it is only meaningful with an id attached.
 */
import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { clip: vi },
  en: { clip: en },
});

registerSiteApp({
  id: "clip-viewer",
  path: "/clip",
  nameKey: "site.apps.clip-viewer.name",
  descKey: "site.apps.clip-viewer.desc",
  icon: FileText,
  category: "text",
  hidden: true,
  order: 90,
  component: lazy(() => import("./ClipViewer")),
});
