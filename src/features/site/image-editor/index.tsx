import { lazy } from "react";
import { ImageIcon } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { imageEditor: vi },
  en: { imageEditor: en },
});

registerSiteApp({
  id: "image-editor",
  path: "/image-editor",
  nameKey: "site.apps.image-editor.name",
  descKey: "site.apps.image-editor.desc",
  icon: ImageIcon,
  category: "media",
  fullBleed: true,
  order: 34,
  dataTables: ["imageProjects", "imageAssets"],
  // lazy so fabric.js stays out of the site home bundle
  component: lazy(() => import("./ImageEditor")),
});
