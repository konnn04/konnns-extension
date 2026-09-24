import { lazy } from "react";
import { QrCode } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

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
