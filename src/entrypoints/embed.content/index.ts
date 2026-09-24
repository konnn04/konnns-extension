import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { getEmbedTool, getEmbedTools } from "@/core/embed-registry";
import { fail, ok, type EmbedRunResult, type RuntimeMessage } from "@/core/messaging/types";
import "@/features/embed";
import "./embed.css";

/**
 * Embedded tool host — docs/embed/00-tong-quan.md §3.
 *
 * NOT declared in the manifest. The popup injects this on demand with
 * `activeTab` + `scripting.executeScript` (core/messaging::ensureEmbedInjected),
 * so a fresh install asks for no host permissions at all. `registration:
 * "runtime"` tells WXT to build it as a content script but keep it out of
 * `content_scripts` (wxt.config.ts strips the host_permissions it would add).
 *
 * The script is a thin host: it answers messages and owns one ShadowRoot.
 * Everything a tool actually does lives in features/embed/<tool>/.
 */

let toast: ((title: string, body?: string, variant?: "info" | "error") => void) | null = null;

export default defineContentScript({
  matches: ["*://*/*"],
  registration: "runtime",
  cssInjectionMode: "ui",
  runAt: "document_idle",

  main(ctx) {
    // Register the listener SYNCHRONOUSLY. The popup injects this script and
    // messages it immediately afterwards; if we awaited the toaster first
    // (createShadowRootUi fetches its CSS over the network) that first message
    // would arrive before any listener existed and fail with "could not
    // establish connection".
    browser.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
      switch (msg.type) {
        case "embed:ping":
          sendResponse(true);
          return true;

        case "embed:list":
          sendResponse(ok(getEmbedTools().map((t) => t.id)));
          return true;

        case "embed:run":
          void runTool(msg.toolId, msg.params).then(sendResponse, (e) => sendResponse(fail(e)));
          return true; // async reply

        default:
          return undefined; // not ours (e.g. getRedirectUri) — leave it alone
      }
    });

    // The toast is a nicety; messaging must not wait on it.
    void createToaster(ctx).then(
      (fn) => {
        toast = fn;
      },
      () => {
        /* no shadow UI on this page — tools still work, just without a toast */
      },
    );
  },
});

async function runTool(toolId: string, params?: Record<string, unknown>) {
  const tool = getEmbedTool(toolId);
  if (!tool?.run) return fail(new Error(`Unknown embed tool: ${toolId}`));
  try {
    const data = await tool.run(params);
    const result: EmbedRunResult = {
      toolId,
      url: location.href,
      title: document.title,
      data,
    };
    return ok(result);
  } catch (e) {
    showToast("Lỗi", e instanceof Error ? e.message : String(e), "error");
    return fail(e);
  }
}

/** Available to tools via `showToast` without each one re-creating a shadow root. */
export function showToast(title: string, body?: string, variant: "info" | "error" = "info"): void {
  toast?.(title, body, variant);
}

async function createToaster(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: "konnn-embed",
    position: "overlay",
    anchor: "body",
    onMount(container) {
      container.classList.add("kx-root");
      return container;
    },
  });
  ui.mount();

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  return (title: string, body?: string, variant: "info" | "error" = "info") => {
    const host = ui.uiContainer;
    host.textContent = "";
    clearTimeout(hideTimer);

    const el = document.createElement("div");
    el.className = `kx-toast${variant === "error" ? " kx-toast--error" : ""}`;
    el.innerHTML =
      '<span class="kx-toast__dot"></span>' +
      '<span class="kx-toast__text">' +
      `<span class="kx-toast__title"></span>${body ? '<div class="kx-toast__body"></div>' : ""}` +
      "</span>";
    el.querySelector(".kx-toast__title")!.textContent = title;
    if (body) el.querySelector(".kx-toast__body")!.textContent = body;
    host.append(el);

    requestAnimationFrame(() => el.classList.add("kx-toast--in"));
    hideTimer = setTimeout(() => {
      el.classList.remove("kx-toast--in");
      setTimeout(() => el.remove(), 220);
    }, 2600);
  };
}
