/** Re-exported from core/storage/db.ts so this tool's own files never import `@/core/storage/db` types by hand in more than one place. */
export type {
  AutoClearSettingsRow as ClearSchedule,
  ClearDataTypes,
  ClearFrequency,
  ClearLogRow as ClearLogEntry,
} from "@/core/storage/db";

import type { AutoClearSettingsRow as ClearSchedule } from "@/core/storage/db";

export function defaultSchedule(): ClearSchedule {
  return {
    id: "state",
    enabled: false,
    frequency: "daily",
    dataTypes: { cache: true, cookies: false, history: false, formData: false, downloadHistory: false },
    excludedDomains: [],
    lastRunAt: null,
    updatedAt: Date.now(),
  };
}

export const DATA_TYPE_KEYS = ["cache", "cookies", "history", "formData", "downloadHistory"] as const;
