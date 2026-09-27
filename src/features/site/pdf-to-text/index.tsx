import { lazy } from "react";
import { FileText } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { pdfText: vi },
  en: { pdfText: en },
});

registerSiteApp({
  id: "pdf-to-text",
  path: "/pdf-to-text",
  nameKey: "site.apps.pdf-to-text.name",
  descKey: "site.apps.pdf-to-text.desc",
  icon: FileText,
  category: "text",
  fullBleed: true,
  order: 30,
  // lazy so pdfjs-dist (and, further inside, tesseract.js on demand) stay out of the site home bundle
  component: lazy(() => import("./PdfToText")),
});
