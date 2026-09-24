import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { browser } from "wxt/browser";
import { Volume2 } from "lucide-react";
import { hasPermissions, requestPermissions } from "@/core/permissions";
import { getActiveTab, sendToBackground } from "@/core/messaging";
import { supportsTabVolume } from "./background/tabMixer";
import { MixerTabRow } from "./MixerTabRow";
import type { MixerTab } from "./engine/types";
import "./audio-mixer.css";

/**
 * Root widget — docs/roadmap/05-audio-mixer.md §2/§3. Registered into the
 * popup widget registry (see index.tsx); renders nothing at all when there
 * is nothing audible, so it never takes up space in a popup where it isn't
 * useful. `tabs.query({ audible: true })` itself needs no permission — only
 * `title`/`favIconUrl` and `tabs.update()` do, which is why the tab list can
 * be queried before the user has granted anything, purely to decide whether
 * the "enable" prompt is even worth showing.
 */
export function AudioMixerWidget() {
  const { t } = useTranslation();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [tabs, setTabs] = useState<MixerTab[]>([]);
  /** the one tab whose volume can be changed — see TabVolumeControl for why it is only ever one */
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [gains, setGains] = useState<Record<number, number>>({});

  const refresh = useCallback(async () => {
    const all = await browser.tabs.query({ audible: true });
    setTabs(
      all
        .filter((t): t is typeof t & { id: number; windowId: number } => t.id !== undefined && t.windowId !== undefined)
        .map((t) => ({
          tabId: t.id,
          windowId: t.windowId,
          title: t.title ?? "",
          favIconUrl: t.favIconUrl,
          audible: t.audible ?? false,
          muted: t.mutedInfo?.muted ?? false,
        })),
    );
  }, []);

  useEffect(() => {
    void hasPermissions({ permissions: ["tabs"] }).then(setGranted);
    void refresh();
    void getActiveTab().then((tab) => setActiveTabId(tab?.id ?? null));
    // the popup is destroyed on close, so which tabs are already captured has
    // to be re-read from the worker every time it opens
    if (supportsTabVolume()) {
      void sendToBackground({ type: "tabMixer:list" }).then((reply) => {
        const value = (reply as { ok?: boolean; value?: Record<number, number> })?.value;
        if (value) setGains(value);
      });
    }
    const onChange = () => void refresh();
    browser.tabs.onUpdated.addListener(onChange);
    browser.tabs.onRemoved.addListener(onChange);
    return () => {
      browser.tabs.onUpdated.removeListener(onChange);
      browser.tabs.onRemoved.removeListener(onChange);
    };
  }, [refresh]);

  const grant = async () => {
    // must stay in this same click handler, no intervening await before it —
    // gesture-safe request, see core/permissions.ts
    const ok = await requestPermissions({ permissions: ["tabs"] });
    setGranted(ok);
    if (ok) void refresh();
  };

  if (tabs.length === 0) return null; // nothing playing — take up no space

  if (!granted) {
    return (
      <section className="amx">
        <button type="button" className="amx__grant" onClick={() => void grant()}>
          <Volume2 size={15} />
          {t("audioMixer.enable")}
        </button>
      </section>
    );
  }

  return (
    <section className="amx">
      <h2 className="amx__label">{t("audioMixer.title")}</h2>
      <ul className="amx__list">
        {tabs.map((tab) => (
          <MixerTabRow
            key={tab.tabId}
            tab={tab}
            onChanged={refresh}
            // only the tab the popup was opened on can be captured at all
            volumeGain={supportsTabVolume() && tab.tabId === activeTabId ? (gains[tab.tabId] ?? null) : undefined}
            onVolumeChange={(gain) =>
              setGains((prev) => {
                const next = { ...prev };
                if (gain === undefined) delete next[tab.tabId];
                else next[tab.tabId] = gain;
                return next;
              })
            }
          />
        ))}
      </ul>
    </section>
  );
}
