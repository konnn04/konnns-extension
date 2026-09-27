import { lazy } from "react";
import { Share2 } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";
import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { linkPreview: vi },
  en: { linkPreview: en },
});

registerSiteApp({
  id: "link-preview",
  path: "/link-preview",
  nameKey: "site.apps.link-preview.name",
  descKey: "site.apps.link-preview.desc",
  icon: Share2,
  category: "dev",
  order: 15,
  component: lazy(() => import("./LinkPreviewApp")),
});
