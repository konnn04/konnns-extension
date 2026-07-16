import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";
import type { SettingsSchema } from "@/core/settings-engine/schema";

/**
 * Feature Registry — docs/01-tech-stack-va-kien-truc.md §3.
 * Adding a feature = create a folder + call registerFeature. Core never
 * hardcodes the feature list (settings sidebar & onboarding are generated from here).
 */

export type LayoutZone =
  | "center"
  | "background"
  | "quick-access-bar"
  | "left-sidebar"
  | "right-sidebar";

export interface FeatureDefinition {
  id: string;
  zone: LayoutZone;
  /** i18n key for the display name */
  nameKey: string;
  icon: LucideIcon;
  defaultEnabled: boolean;
  requiresNetwork?: boolean;
  /** feature emits notifications (Phase 3 notification engine reads this) */
  notifiable?: boolean;
  settingsSchema?: SettingsSchema;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  /** extra custom UI rendered below the schema form in Settings (e.g. wallpaper library) */
  settingsExtra?: ComponentType;
  /** order within its zone (lower renders first) */
  order?: number;
}

const registry = new Map<string, FeatureDefinition>();

export function registerFeature(def: FeatureDefinition): void {
  registry.set(def.id, def);
}

export function getFeature(id: string): FeatureDefinition | undefined {
  return registry.get(id);
}

export function getFeatures(): FeatureDefinition[] {
  return [...registry.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getFeaturesByZone(zone: LayoutZone): FeatureDefinition[] {
  return getFeatures().filter((f) => f.zone === zone);
}
