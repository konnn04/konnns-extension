/**
 * Typed message contract between every surface (popup / site / newtab /
 * content script / background) — docs/architecture.md §7.
 *
 * Before this file the project had exactly one ad-hoc message
 * ("getRedirectUri"); it stays in the union so core/oauth keeps working.
 */

/** Result of running a one-shot embed tool on a page. */
export interface EmbedRunResult {
  toolId: string;
  /** page the tool ran on */
  url: string;
  title: string;
  /** tool-specific payload (page-to-markdown → { markdown, wordCount, ... }) */
  data: unknown;
}

export type RuntimeMessage =
  /** page → background: identity redirect URI (wxt dev serves newtab from localhost) */
  | { type: "getRedirectUri"; path?: string }
  /** anyone → content script: "are you already injected?" */
  | { type: "embed:ping" }
  /** popup → content script: run a one-shot tool and return its result */
  | { type: "embed:run"; toolId: string; params?: Record<string, unknown> }
  /** anyone → content script: which tools does this page's script know about? */
  | { type: "embed:list" }
  /** anyone → background: open (or focus) the custom site at a route */
  | { type: "site:open"; route?: string }
  /**
   * site → background: start tracking the CURRENTLY active tab right away.
   * Granting the "tabs" optional permission does not itself fire any tab
   * event, so without this the first session would only begin on the next
   * tab switch — sent once, right after a successful permission grant.
   */
  | { type: "timeTracker:seed" }
  /**
   * popup → background: take over this tab's audio so its volume can be
   * changed independently. The stream id must be minted in the popup (only
   * a tab the extension was just invoked on can be captured — see
   * docs/site/07-audio-mixer.md), but the AudioContext that consumes it has
   * to live in an offscreen document, since an MV3 service worker has no DOM.
   */
  | { type: "tabMixer:capture"; tabId: number; streamId: string; gain: number }
  /** popup → background → offscreen: change the gain of an already-captured tab */
  | { type: "tabMixer:setGain"; tabId: number; gain: number }
  /** popup → background → offscreen: release a tab, restoring its own audio output */
  | { type: "tabMixer:stop"; tabId: number }
  /** popup → background: which tabs are currently captured (the popup is recreated on every open, so it has no memory of its own) */
  | { type: "tabMixer:list" };

export type MessageOf<T extends RuntimeMessage["type"]> = Extract<RuntimeMessage, { type: T }>;

/** Uniform envelope so callers never have to guess between throw and null. */
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Reply<T> {
  return { ok: true, value };
}

export function fail(error: unknown): Reply<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
