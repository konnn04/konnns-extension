import { useTranslation } from "react-i18next";
import { browser } from "wxt/browser";
import { Volume2, VolumeX } from "lucide-react";
import { IconButton } from "@/shared/ui";
import { TabVolumeControl } from "./TabVolumeControl";
import type { MixerTab } from "./engine/types";

export function MixerTabRow({
  tab,
  onChanged,
  volumeGain,
  onVolumeChange,
}: {
  tab: MixerTab;
  onChanged: () => void;
  /**
   * `undefined` = this tab can't have its volume changed (not the active
   * tab, or a browser without offscreen documents), `null` = it can but
   * isn't captured yet, a number = captured and running at that gain.
   */
  volumeGain?: number | null;
  onVolumeChange: (gain: number | undefined) => void;
}) {
  const { t } = useTranslation();

  const jump = async () => {
    await browser.tabs.update(tab.tabId, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
    window.close();
  };

  const toggleMute = async () => {
    await browser.tabs.update(tab.tabId, { muted: !tab.muted });
    onChanged();
  };

  return (
    <li className="amx__row">
      <div className="amx__row-top">
        <button type="button" className="amx__row-main" onClick={() => void jump()}>
          {tab.favIconUrl ? (
            <img className="amx__favicon" src={tab.favIconUrl} alt="" width={16} height={16} />
          ) : (
            <Volume2 size={16} className="amx__favicon-fallback" />
          )}
          <span className="amx__title">{tab.title || t("audioMixer.untitledTab")}</span>
        </button>
        <IconButton
          label={tab.muted ? t("audioMixer.unmute") : t("audioMixer.mute")}
          className={tab.muted ? "amx__mute--on" : ""}
          onClick={() => void toggleMute()}
        >
          {tab.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </IconButton>
      </div>
      {volumeGain !== undefined && (
        <TabVolumeControl tabId={tab.tabId} gain={volumeGain ?? undefined} onGainChange={onVolumeChange} />
      )}
    </li>
  );
}
