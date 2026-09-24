import { lazy } from "react";
import { PenTool } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "whiteboard",
  path: "/whiteboard",
  nameKey: "site.apps.whiteboard.name",
  descKey: "site.apps.whiteboard.desc",
  icon: PenTool,
  category: "other",
  fullBleed: true,
  order: 32,
  // lazy so Excalidraw (+ roughjs, perfect-freehand, its ~1MB bundle) stays out of the site home bundle
  component: lazy(() => import("./Whiteboard")),
});
