import Dexie, { type EntityTable } from "dexie";

/**
 * IndexedDB schema — docs/core-he-thong/03-storage-backup.md §1.
 * Tables for later phases (notes, tasks, window-states...) are declared now so
 * the backup format and migrations stay stable across phases.
 */

export interface SettingsRow {
  /** featureId; "core" holds the General settings */
  featureId: string;
  /** true/false toggle of the whole feature */
  enabled: boolean;
  /** schema-driven values keyed by field name */
  values: Record<string, unknown>;
  updatedAt: number;
}

export interface WallpaperRow {
  id: string;
  type: "image" | "video";
  blob: Blob;
  name: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface AvatarRow {
  id: string;
  /** static image or animated gif shown on the NewTab main area */
  type: "image" | "gif";
  blob: Blob;
  name: string;
  size: number;
  createdAt: number;
}

export interface CustomClockRow {
  id: string;
  name: string;
  css: string;
  createdAt: number;
  updatedAt: number;
}

export interface WindowStateRow {
  id: string; // tool id
  mode: "docked" | "floating" | "minimized" | "maximized";
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskType = "once" | "daily" | "weekly" | "monthly";

export interface TaskRow {
  id: string;
  text: string;
  done: boolean;
  order: number;
  deadline?: number;
  taskType: TaskType;
  createdAt: number;
  updatedAt: number;
}

export interface OnboardingStateRow {
  id: "state";
  completed: boolean;
  step: number;
  updatedAt: number;
}

export interface AudioAssetRow {
  id: string; 
  blob: Blob;
  name: string;
  updatedAt: number;
}

export interface MediaAssetRow {
  id: string;
  type: "image" | "gif";
  blob: Blob;
  name: string;
  updatedAt: number;
}

export interface MusicTrackRow {
  id: string;
  blob: Blob;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: Blob;
  fileName: string;
  size: number;
  duration: number;
  createdAt: number;
}

export type NotificationType = "info" | "success" | "reminder" | "alarm";

export interface NotificationRow {
  id: string;
  source: string; // feature id: "github" | "calendar" | "pomodoro" | ...
  type: NotificationType;
  title: string;
  body: string;
  createdAt: number;
  readAt: number | null;
}

export const DB_SCHEMA_VERSION = 5;

export const db = new Dexie("newtab-extension") as Dexie & {
  settings: EntityTable<SettingsRow, "featureId">;
  wallpapers: EntityTable<WallpaperRow, "id">;
  avatars: EntityTable<AvatarRow, "id">;
  customClocks: EntityTable<CustomClockRow, "id">;
  windowStates: EntityTable<WindowStateRow, "id">;
  notes: EntityTable<NoteRow, "id">;
  tasks: EntityTable<TaskRow, "id">;
  onboardingState: EntityTable<OnboardingStateRow, "id">;
  notificationsLog: EntityTable<NotificationRow, "id">;
  audioAssets: EntityTable<AudioAssetRow, "id">;
  mediaAssets: EntityTable<MediaAssetRow, "id">;
  musicTracks: EntityTable<MusicTrackRow, "id">;
};

db.version(1).stores({
  settings: "featureId, updatedAt",
  wallpapers: "id, createdAt, lastUsedAt",
  customClocks: "id, updatedAt",
  windowStates: "id",
  notes: "id, updatedAt",
  tasks: "id, order, updatedAt",
  onboardingState: "id",
});

db.version(2).stores({
  avatars: "id, createdAt",
});

db.version(3).stores({
  notificationsLog: "id, source, createdAt, readAt",
});

db.version(4).stores({
  audioAssets: "id",
});

db.version(5).stores({
  mediaAssets: "id",
});

db.version(6).stores({
  musicTracks: "id, createdAt",
});

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage.estimate()) ?? {};
    return { usage, quota };
  } catch {
    return null;
  }
}
