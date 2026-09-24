import { browser } from "wxt/browser";
import type { EmbedRunResult, Reply, RuntimeMessage } from "./types";

export * from "./types";

/** Built path of the embed content script (see entrypoints/embed.content/). */
const EMBED_SCRIPT = "/content-scripts/embed.js";

/** Path of the custom site page inside the extension. */
export const SITE_PAGE = "/site.html";

export function siteUrl(route = "/"): string {
  const hash = route.startsWith("#") ? route : `#${route}`;
  return browser.runtime.getURL(SITE_PAGE) + hash;
}

export function sendToBackground<T>(msg: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}

export function sendToTab<T>(tabId: number, msg: RuntimeMessage): Promise<T> {
  return browser.tabs.sendMessage(tabId, msg) as Promise<T>;
}

/**
 * Pages the browser refuses to inject into. Checking up-front lets the popup
 * explain itself instead of showing a silent failure.
 *
 * An UNKNOWN url counts as injectable. `activeTab` normally exposes the URL to
 * the popup, but if it ever does not, blocking on that would grey out every
 * tool with a misleading reason. Only a positively recognised scheme is a no.
 */
export function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return true;
  const blocked = [
    "chrome://",
    "chrome-extension://",
    "moz-extension://",
    "about:",
    "edge://",
    "opera://",
    "vivaldi://",
    "brave://",
    "view-source:",
    "devtools://",
    "chrome-error://",
  ];
  if (blocked.some((p) => url.startsWith(p))) return false;
  // extension galleries are blocked by policy, not by scheme
  if (url.startsWith("https://chromewebstore.google.com")) return false;
  if (url.startsWith("https://chrome.google.com/webstore")) return false;
  if (url.startsWith("https://addons.mozilla.org")) return false;
  return true;
}

/**
 * Make sure the embed content script is alive in a tab, injecting it if not.
 *
 * The script is NOT declared in the manifest (see wxt.config.ts hooks): it is
 * injected here under `activeTab`, which the browser grants for the tab the
 * user invoked the extension on. Ping first so repeated runs don't stack
 * duplicate listeners.
 */
export async function ensureEmbedInjected(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: "embed:ping" } satisfies RuntimeMessage);
    return; // already there
  } catch {
    /* not injected yet — fall through */
  }
  await injectScript(tabId);
}

type ScriptingApi = {
  executeScript?: (details: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
};

/**
 * The Chrome build is MV3 and uses `scripting`; the Firefox build is MV2
 * (WXT's default for Gecko), where the same job belongs to the older
 * `tabs.executeScript`. Feature-detect rather than branch on the manifest
 * version, so this keeps working if the Firefox target moves to MV3.
 */
async function injectScript(tabId: number): Promise<void> {
  const scripting = (browser as unknown as { scripting?: ScriptingApi }).scripting;
  if (scripting?.executeScript) {
    await scripting.executeScript({ target: { tabId }, files: [EMBED_SCRIPT] });
    return;
  }
  const tabs = browser.tabs as unknown as {
    executeScript?: (tabId: number, details: Record<string, unknown>) => Promise<unknown>;
  };
  if (!tabs.executeScript) throw new Error("This browser cannot inject the tool");
  await tabs.executeScript(tabId, { file: EMBED_SCRIPT, runAt: "document_idle" });
}

/** Inject if needed, then run a one-shot embed tool and unwrap its reply. */
export async function runEmbedTool(
  tabId: number,
  toolId: string,
  params?: Record<string, unknown>,
): Promise<EmbedRunResult> {
  await ensureEmbedInjected(tabId);
  const reply = await sendToTab<Reply<EmbedRunResult>>(tabId, { type: "embed:run", toolId, params });
  if (!reply) throw new Error("No response from the page");
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

export async function getActiveTab(): Promise<{ id: number; url?: string; title?: string } | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url, title: tab.title };
}
