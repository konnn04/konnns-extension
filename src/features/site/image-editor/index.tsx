import { lazy } from "react";
import { ImageIcon } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "image-editor",
  path: "/image-editor",
  nameKey: "site.apps.image-editor.name",
  descKey: "site.apps.image-editor.desc",
  icon: ImageIcon,
  category: "media",
  fullBleed: true,
  order: 34,
  // lazy so fabric.js stays out of the site home bundle
  component: lazy(() => import("./ImageEditor")),
});
