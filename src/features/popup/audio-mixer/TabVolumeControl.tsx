import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@/shared/ui";
import { hasPermissions, requestPermissions } from "@/core/permissions";
import { sendToBackground } from "@/core/messaging";

const DEFAULT_GAIN = 1;
const MAX_GAIN = 2;

/**
 * Per-tab volume — docs/roadmap/05-audio-mixer.md §2 step 4, with the scope
 * correction documented in docs/site/07-audio-mixer.md: Chrome only lets an
 * extension capture a tab it has activeTab for, which is the tab the popup
 * was just opened on. So this control appears on that row alone; every other
 * audible tab keeps plain mute/unmute.
 *
 * The capture SURVIVES switching away — so the workflow is "go to the loud
 * tab, set it to 40%, carry on", not "mix every tab from one list".
 *
 * Starting a capture has to happen inside this click handler: both the
 * permission request (gesture-safe, see core/permissions.ts) and
 * `getMediaStreamId` are rejected when they drift away from the user's
 * actual click.
 */
export function TabVolumeControl({
  tabId,
  gain,
  onGainChange,
}: {
  tabId: number;
  /** undefined = this tab is not captured yet, so it is playing at its own natural volume */
  gain: number | undefined;
  onGainChange: (gain: number | undefined) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const granted =
        (await hasPermissions({ permissions: ["tabCapture", "offscreen"] })) ||
        (await requestPermissions({ permissions: ["tabCapture", "offscreen"] }));
      if (!granted) {
        setError("audioMixer.permissionDenied");
        return;
      }

      const streamId = await getMediaStreamId(tabId);
      if (!streamId) {
        setError("audioMixer.errCaptureFailed");
        return;
      }

      const reply = (await sendToBackground({ type: "tabMixer:capture", tabId, streamId, gain: DEFAULT_GAIN })) as {
        ok?: boolean;
        error?: string;
      };
      if (!reply?.ok) {
        setError(reply?.error ?? "audioMixer.errCaptureFailed");
        return;
      }
      onGainChange(DEFAULT_GAIN);
    } catch {
      setError("audioMixer.errCaptureFailed");
    } finally {
      setBusy(false);
    }
  };

  const change = (next: number) => {
    onGainChange(next);
    void sendToBackground({ type: "tabMixer:setGain", tabId, gain: next });
  };

  const release = () => {
    onGainChange(undefined);
    void sendToBackground({ type: "tabMixer:stop", tabId });
  };

  if (gain === undefined) {
    return (
      <div className="amx__volume">
        <IconButton label={t("audioMixer.enableVolume")} disabled={busy} onClick={() => void start()}>
          <SlidersHorizontal size={14} />
        </IconButton>
        {error && <span className="amx__volume-error">{t(error)}</span>}
      </div>
    );
  }

  return (
    <div className="amx__volume">
      <input
        className="amx__volume-slider"
        type="range"
        min={0}
        max={MAX_GAIN * 100}
        step={5}
        value={Math.round(gain * 100)}
        aria-label={t("audioMixer.volumeLabel")}
        onChange={(e) => change(Number(e.target.value) / 100)}
      />
      <span className="amx__volume-value">{Math.round(gain * 100)}%</span>
      <IconButton label={t("audioMixer.releaseTab")} onClick={release}>
        <RotateCcw size={13} />
      </IconButton>
    </div>
  );
}

/** `chrome.tabCapture` has no promise form in the polyfill, and this must not lose the user gesture on the way. */
function getMediaStreamId(targetTabId: number): Promise<string | null> {
  return new Promise((resolve) => {
    const api = (globalThis as { chrome?: { tabCapture?: { getMediaStreamId?: (opts: { targetTabId: number }, cb: (id?: string) => void) => void } } }).chrome
      ?.tabCapture;
    if (!api?.getMediaStreamId) return resolve(null);
    try {
      api.getMediaStreamId({ targetTabId }, (id) => resolve(id ?? null));
    } catch {
      resolve(null);
    }
  });
}
