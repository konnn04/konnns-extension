import { browser } from "wxt/browser";

/**
 * Background half of per-tab volume — docs/roadmap/05-audio-mixer.md §5.
 *
 * Three contexts have to cooperate, because no single one can do the whole
 * job: the POPUP mints the capture stream id (only a tab the extension was
 * just invoked on may be captured), this SERVICE WORKER owns the lifecycle
 * and the cleanup listeners (it outlives the popup, which is destroyed the
 * moment it closes), and the OFFSCREEN document owns the AudioContext (a
 * service worker has no DOM and so cannot make sound).
 *
 * Which gains are currently applied lives in `storage.session` rather than a
 * module variable: the worker is killed after ~30s idle, and a popup opened
 * afterwards still has to be able to show the right slider positions.
 */

const OFFSCREEN_PATH = "offscreen.html";
const GAINS_KEY = "audioMixer:gains";

type GainMap = Record<number, number>;

function sessionArea() {
  return (browser.storage as { session?: typeof browser.storage.local }).session ?? browser.storage.local;
}

async function readGains(): Promise<GainMap> {
  const res = await sessionArea().get(GAINS_KEY);
  return (res[GAINS_KEY] as GainMap | undefined) ?? {};
}

async function writeGains(gains: GainMap): Promise<void> {
  await sessionArea().set({ [GAINS_KEY]: gains });
}

/* ------------------------------------------------------ offscreen document */

interface OffscreenApi {
  hasDocument?: () => Promise<boolean>;
  createDocument: (opts: { url: string; reasons: string[]; justification: string }) => Promise<void>;
  closeDocument?: () => Promise<void>;
}

function offscreenApi(): OffscreenApi | undefined {
  return (globalThis as { chrome?: { offscreen?: OffscreenApi } }).chrome?.offscreen;
}

/** Firefox has no offscreen documents at all, so the whole advanced tier is Chromium-only and the UI has to be able to ask. */
export function supportsTabVolume(): boolean {
  const chromeApi = globalThis as { chrome?: { offscreen?: unknown; tabCapture?: unknown } };
  return Boolean(chromeApi.chrome?.offscreen && chromeApi.chrome?.tabCapture);
}

let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const api = offscreenApi();
  if (!api) throw new Error("audioMixer.errNoOffscreen");

  if (await hasOffscreen()) return;
  // two captures started back to back would otherwise both try to create it
  if (creating) {
    await creating;
    return;
  }
  creating = api.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA"],
    justification: "Apply per-tab volume to captured tab audio.",
  });
  try {
    await creating;
  } finally {
    creating = null;
  }
}

async function hasOffscreen(): Promise<boolean> {
  const api = offscreenApi();
  if (api?.hasDocument) return api.hasDocument();
  try {
    const contexts = await (
      browser.runtime as unknown as { getContexts?: (f: { contextTypes: string[] }) => Promise<unknown[]> }
    ).getContexts?.({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    return Array.isArray(contexts) && contexts.length > 0;
  } catch {
    return false;
  }
}

async function sendToOffscreen(message: Record<string, unknown>): Promise<{ ok: boolean; error?: string; value?: unknown }> {
  return (await browser.runtime.sendMessage({ ...message, target: "offscreen" })) as {
    ok: boolean;
    error?: string;
    value?: unknown;
  };
}

/* ----------------------------------------------------------------- actions */

export async function captureTab(tabId: number, streamId: string, gain: number): Promise<void> {
  await ensureOffscreen();
  const reply = await sendToOffscreen({ type: "tabMixer:capture", tabId, streamId, gain });
  if (!reply?.ok) throw new Error(reply?.error ?? "audioMixer.errCaptureFailed");
  await writeGains({ ...(await readGains()), [tabId]: gain });
}

export async function setTabGain(tabId: number, gain: number): Promise<void> {
  const gains = await readGains();
  if (gains[tabId] === undefined) return; // not captured — nothing to adjust
  await sendToOffscreen({ type: "tabMixer:setGain", tabId, gain });
  await writeGains({ ...gains, [tabId]: gain });
}

/** Hands the tab back to the browser: its own audio output resumes. */
export async function releaseTab(tabId: number): Promise<void> {
  const gains = await readGains();
  if (gains[tabId] === undefined) return;
  if (await hasOffscreen()) await sendToOffscreen({ type: "tabMixer:stop", tabId });
  delete gains[tabId];
  await writeGains(gains);
  await closeOffscreenIfIdle(gains);
}

export async function listTabGains(): Promise<GainMap> {
  return readGains();
}

/** An offscreen document with nothing left to do still counts against the one-document limit and keeps an AudioContext alive. */
async function closeOffscreenIfIdle(gains: GainMap): Promise<void> {
  if (Object.keys(gains).length > 0) return;
  const api = offscreenApi();
  if (api?.closeDocument && (await hasOffscreen())) {
    try {
      await api.closeDocument();
    } catch {
      /* already gone */
    }
  }
}

/* ---------------------------------------------------------------- listeners */

/**
 * Registered unconditionally from background.ts, same as every other tool in
 * this project. Without these, a captured tab that gets closed or navigated
 * away leaves the browser's "this tab is being shared" indicator stuck on
 * and its audio nodes alive (docs/roadmap/05 §5).
 */
export function initTabMixer(): void {
  browser.tabs.onRemoved.addListener((tabId) => void releaseTab(tabId));
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // a navigation replaces the page the capture was granted for
    if (changeInfo.url !== undefined) void releaseTab(tabId);
  });
}
