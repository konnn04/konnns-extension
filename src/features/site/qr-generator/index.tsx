import { lazy } from "react";
import { QrCode } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { qr: vi },
  en: { qr: en },
});

registerSiteApp({
  id: "qr-generator",
  path: "/qr-generator",
  nameKey: "site.apps.qr-generator.name",
  descKey: "site.apps.qr-generator.desc",
  icon: QrCode,
  category: "other",
  order: 25,
  component: lazy(() => import("./QrGenerator")),
});
