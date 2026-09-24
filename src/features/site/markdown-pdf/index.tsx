import { lazy } from "react";
import { FileEdit } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "markdown-pdf",
  path: "/markdown-pdf",
  nameKey: "site.apps.markdown-pdf.name",
  descKey: "site.apps.markdown-pdf.desc",
  icon: FileEdit,
  category: "text",
  fullBleed: true,
  order: 31,
  // lazy so CodeMirror + markdown-it + DOMPurify stay out of the site home bundle
  component: lazy(() => import("./MarkdownEditor")),
});
