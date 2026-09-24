import type { LucideIcon } from "lucide-react";

/**
 * Embedded Tool Registry — docs/embed/00-tong-quan.md §2.
 * Tools that run INSIDE the page the user is looking at. Registration is a
 * side effect of importing the tool's folder, exactly like core/feature-registry.
 *
 * Two shapes, on purpose:
 *  - `run`   → one-shot: popup asks, tool answers, done (page → Markdown).
 *  - `mount` → resident: tool paints UI into the shadow root and watches the
 *              page. This is the hook the future automation tools hang off.
 *
 * Note the split between the two interfaces below. A content script is injected
 * into every page the user runs a tool on, so its bundle has to stay small:
 * the runtime half deliberately carries no icon and no i18n key, which keeps
 * React and lucide-react out of it entirely. The popup gets that half from
 * features/embed/catalog.ts instead.
 */

/** Runtime half — lives in the content script. */
export interface EmbedToolDefinition {
  id: string;
  /** one-shot execution; the returned value travels back to the popup */
  run?: (params?: Record<string, unknown>) => Promise<unknown> | unknown;
  /** resident UI; return a cleanup function */
  mount?: (host: HTMLElement) => () => void;
}

/** Display half — lives in the popup (and anywhere else listing the tools). */
export interface EmbedToolMeta {
  id: string;
  /** i18n key for the display name */
  nameKey: string;
  /** i18n key for the one-line description */
  descKey?: string;
  icon: LucideIcon;
}

const registry = new Map<string, EmbedToolDefinition>();

export function registerEmbedTool(def: EmbedToolDefinition): void {
  registry.set(def.id, def);
}

export function getEmbedTools(): EmbedToolDefinition[] {
  return [...registry.values()];
}

export function getEmbedTool(id: string): EmbedToolDefinition | undefined {
  return registry.get(id);
}
