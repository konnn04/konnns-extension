import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Popup Widget Registry — docs/roadmap/00-tong-quan.md §2.3.
 *
 * The fourth registry, alongside site-registry (opens the Custom Site),
 * embed-registry (runs on the current tab), and feature-registry (New Tab
 * panels). None of those fit a tool that neither opens something else nor
 * runs on the page — Audio Mixer (docs/roadmap/05) *is* its UI, living and
 * dying entirely within the popup's own lifetime.
 *
 * Not lazy: the popup is already small, and a widget here is meant to be
 * cheap enough to just render — unlike a site app's engine (pdfjs, fabric,
 * Excalidraw…), which must never enter the home bundle.
 *
 * A widget that currently has nothing to show (no audible tabs, no
 * permission yet, …) simply returns `null` from its own component — the
 * registry and `PopupApp` render every registered widget unconditionally,
 * same "disabled feature renders nothing" rule used everywhere else in the
 * project.
 */
export interface PopupWidgetDefinition {
  id: string;
  nameKey: string;
  icon: LucideIcon;
  component: ComponentType;
  order?: number;
}

const registry = new Map<string, PopupWidgetDefinition>();

export function registerPopupWidget(def: PopupWidgetDefinition): void {
  registry.set(def.id, def);
}

export function getPopupWidgets(): PopupWidgetDefinition[] {
  return [...registry.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
