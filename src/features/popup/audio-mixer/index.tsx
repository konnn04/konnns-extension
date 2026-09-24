import { Volume2 } from "lucide-react";
import { registerPopupWidget } from "@/core/popup-widget-registry";
import { AudioMixerWidget } from "./AudioMixerWidget";

registerPopupWidget({
  id: "audio-mixer",
  nameKey: "audioMixer.title",
  icon: Volume2,
  component: AudioMixerWidget,
  order: 10,
});
