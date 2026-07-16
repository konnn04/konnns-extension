import { create } from "zustand";
import { db } from "@/core/storage/db";
import { getFeature, getFeatures } from "@/core/feature-registry";
import { schemaDefaults, type FieldValues } from "./schema";

/**
 * One central settings store keyed by featureId ("core" = General settings).
 * Hydrates from Dexie once at startup; every change is applied live and
 * persisted back (docs/core-he-thong/02-settings-engine.md §5).
 */

interface SettingsState {
  hydrated: boolean;
  enabled: Record<string, boolean>;
  values: Record<string, FieldValues>;
  hydrate: () => Promise<void>;
  setValue: (featureId: string, key: string, value: unknown) => void;
  setValues: (featureId: string, patch: FieldValues) => void;
  setEnabled: (featureId: string, enabled: boolean) => void;
}

function persist(featureId: string, state: Pick<SettingsState, "enabled" | "values">) {
  void db.settings.put({
    featureId,
    enabled: state.enabled[featureId] ?? true,
    values: state.values[featureId] ?? {},
    updatedAt: Date.now(),
  });
}

export const CORE_FEATURE_ID = "core";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  enabled: {},
  values: {},

  hydrate: async () => {
    const rows = await db.settings.toArray();
    const enabled: Record<string, boolean> = {};
    const values: Record<string, FieldValues> = {};

    // defaults from registry first…
    for (const f of getFeatures()) {
      enabled[f.id] = f.defaultEnabled;
      values[f.id] = schemaDefaults(f.settingsSchema);
    }
    values[CORE_FEATURE_ID] = schemaDefaults(coreSettingsSchemaRef.current ?? undefined);
    enabled[CORE_FEATURE_ID] = true;

    // …then stored rows override
    for (const row of rows) {
      enabled[row.featureId] = row.enabled;
      values[row.featureId] = { ...values[row.featureId], ...row.values };
    }

    set({ enabled, values, hydrated: true });
  },

  setValue: (featureId, key, value) => {
    set((s) => ({
      values: { ...s.values, [featureId]: { ...s.values[featureId], [key]: value } },
    }));
    persist(featureId, get());
  },

  setValues: (featureId, patch) => {
    set((s) => ({
      values: { ...s.values, [featureId]: { ...s.values[featureId], ...patch } },
    }));
    persist(featureId, get());
  },

  setEnabled: (featureId, isEnabled) => {
    set((s) => ({ enabled: { ...s.enabled, [featureId]: isEnabled } }));
    persist(featureId, get());
  },
}));

/** Set by the app before hydrate() so "core" defaults resolve without a circular import. */
export const coreSettingsSchemaRef: { current: import("./schema").SettingsSchema | null } = {
  current: null,
};

/** Convenience hooks */
export function useFeatureEnabled(featureId: string): boolean {
  return useSettingsStore((s) => {
    const stored = s.enabled[featureId];
    if (stored !== undefined) return stored;
    return getFeature(featureId)?.defaultEnabled ?? true;
  });
}

const EMPTY_VALUES: FieldValues = {};

export function useFeatureValues<T extends FieldValues = FieldValues>(featureId: string): T {
  // stable fallback object so the zustand selector doesn't loop on referential inequality
  return useSettingsStore((s) => (s.values[featureId] ?? EMPTY_VALUES) as T);
}
