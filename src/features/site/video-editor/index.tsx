import { lazy } from "react";
import { Clapperboard } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "video-editor",
  path: "/video-editor",
  nameKey: "site.apps.video-editor.name",
  descKey: "site.apps.video-editor.desc",
  icon: Clapperboard,
  category: "media",
  fullBleed: true,
  order: 35,
  // lazy so mediabunny stays out of the site home bundle
  component: lazy(() => import("./VideoEditor")),
});
