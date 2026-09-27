import { lazy } from "react";
import { AudioWaveform } from "lucide-react";
import { registerSiteApp } from "@/core/site-registry";

import { registerI18nResources } from "@/core/i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

registerI18nResources({
  vi: { audio: vi },
  en: { audio: en },
});

registerSiteApp({
  id: "audio-editor",
  path: "/audio",
  nameKey: "site.apps.audio-editor.name",
  descKey: "site.apps.audio-editor.desc",
  icon: AudioWaveform,
  category: "media",
  fullBleed: true,
  order: 10,
  dataTables: ["audioProjects", "audioSources"],
  // lazy so wavesurfer and the export pipeline never load with the site home
  component: lazy(() => import("./AudioEditor")),
});
