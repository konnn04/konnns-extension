import { lazy } from "react";
import { AudioWaveform } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

registerSiteApp({
  id: "audio-editor",
  path: "/audio",
  nameKey: "site.apps.audio-editor.name",
  descKey: "site.apps.audio-editor.desc",
  icon: AudioWaveform,
  category: "media",
  fullBleed: true,
  order: 10,
  // lazy so wavesurfer and the export pipeline never load with the site home
  component: lazy(() => import("./AudioEditor")),
});
