import { lazy } from "react";
import { FileEdit } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { markdownPdf: vi },
  en: { markdownPdf: en },
});

registerSiteApp({
  id: "markdown-pdf",
  path: "/markdown-pdf",
  nameKey: "site.apps.markdown-pdf.name",
  descKey: "site.apps.markdown-pdf.desc",
  icon: FileEdit,
  category: "text",
  fullBleed: true,
  order: 31,
  dataTables: ["markdownDocs"],
  // lazy so CodeMirror + markdown-it + DOMPurify stay out of the site home bundle
  component: lazy(() => import("./MarkdownEditor")),
});
