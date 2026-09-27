import { lazy } from "react";
import { Clapperboard } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { videoEditor: vi },
  en: { videoEditor: en },
});

registerSiteApp({
  id: "video-editor",
  path: "/video-editor",
  nameKey: "site.apps.video-editor.name",
  descKey: "site.apps.video-editor.desc",
  icon: Clapperboard,
  category: "media",
  fullBleed: true,
  order: 35,
  dataTables: ["videoProjects", "videoSources"],
  // lazy so mediabunny stays out of the site home bundle
  component: lazy(() => import("./VideoEditor")),
});
