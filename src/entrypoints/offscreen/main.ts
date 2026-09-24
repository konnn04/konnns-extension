/**
 * Offscreen document — the only place in an MV3 extension that has both a
 * DOM and an `AudioContext`, which is exactly what per-tab volume needs
 * (docs/roadmap/05-audio-mixer.md §5). The service worker can mint a tab
 * capture stream id but cannot turn it into audible sound; this page can.
 *
 * The routing that matters, and the one thing that must never be got wrong:
 *
 *     captured tab  →  MediaStreamAudioSourceNode  →  GainNode  →  destination
 *
 * Capturing a tab TAKES OVER its audio output — the tab stops playing to the
 * speakers by itself and its sound now exists only inside this stream. If
 * the graph is not connected all the way through to `destination`, the tab
 * goes completely silent, which is the exact opposite of a volume control.
 * Every failure path below therefore tears the capture down rather than
 * leaving a half-built graph behind.
 */

import { browser } from "wxt/browser";

interface Capture {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
}

interface MixerMessage {
  target?: string;
  type?: string;
  tabId?: number;
  streamId?: string;
  gain?: number;
}

const captures = new Map<number, Capture>();
let audioContext: AudioContext | null = null;

function context(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

async function startCapture(tabId: number, streamId: string, gain: number): Promise<void> {
  stopCapture(tabId); // re-capturing a tab replaces the old graph rather than stacking a second one

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // the non-standard constraint shape tab capture requires; the WebRTC
      // typings have no room for it, hence the cast
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    } as unknown as MediaTrackConstraints,
  });

  try {
    const ctx = context();
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(ctx.destination); // ← without this the tab is silent
    captures.set(tabId, { stream, source, gain: gainNode });
  } catch (err) {
    // never leave the tab captured-but-not-routed
    for (const track of stream.getTracks()) track.stop();
    throw err;
  }
}

function setGain(tabId: number, gain: number): void {
  const capture = captures.get(tabId);
  if (!capture) return;
  capture.gain.gain.value = gain;
}

/** Releases the tab: tracks stopped and nodes disconnected, so the tab goes back to playing through the browser itself. */
function stopCapture(tabId: number): void {
  const capture = captures.get(tabId);
  if (!capture) return;
  capture.source.disconnect();
  capture.gain.disconnect();
  for (const track of capture.stream.getTracks()) track.stop();
  captures.delete(tabId);
}

browser.runtime.onMessage.addListener((message: MixerMessage, _sender: unknown, sendResponse: (r: unknown) => void) => {
  if (message?.target !== "offscreen") return undefined;

  switch (message.type) {
    case "tabMixer:capture":
      void startCapture(message.tabId!, message.streamId!, message.gain ?? 1)
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      return true;

    case "tabMixer:setGain":
      setGain(message.tabId!, message.gain ?? 1);
      sendResponse({ ok: true });
      return true;

    case "tabMixer:stop":
      stopCapture(message.tabId!);
      sendResponse({ ok: true });
      return true;

    case "tabMixer:list":
      sendResponse({ ok: true, value: [...captures.keys()] });
      return true;

    default:
      return undefined;
  }
});
