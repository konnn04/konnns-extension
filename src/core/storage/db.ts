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

/**
 * Saved audio projects — docs/site/01-audio-editor.md §6.
 *
 * Split in two on purpose. The tree is a few KB of JSON and gets rewritten on
 * every edit; the sources are tens of megabytes and are IMMUTABLE, so they
 * are written once. Storing them together would mean rewriting the audio
 * every time a clip moved.
 */
export interface AudioProjectRow {
  id: string;
  name: string;
  /** serialized Track[] — clips reference sources by id */
  tracks: unknown;
  /** serialized EffectInstance[] for the master bus */
  masterEffects?: unknown;
  sampleRate: number;
  duration: number;
  updatedAt: number;
}

export interface AudioSourceRow {
  id: string;
  projectId: string;
  /**
   * Either the original imported file (mp3, flac…) or, for audio this editor
   * produced itself, a 32-bit float WAV so the working master loses nothing.
   * `encoded` says which, because the two are read back differently.
   */
  blob: Blob;
  sampleRate: number;
  /** true when `blob` is the original compressed file rather than WAV */
  encoded?: boolean;
}

/**
 * Web Time Tracker — docs/roadmap/04-web-time-tracker.md §1.
 *
 * Two tables split by WRITE FREQUENCY, not size (unlike the audio tables
 * above): a session row is touched on every tab switch, a daily total only
 * once per rollup. `endedAt: null` marks the one currently-open session;
 * `activityTracker.ts` is responsible for there only ever being at most one.
 */
export interface ActivitySessionRow {
  id: string;
  domain: string;
  url: string;
  title: string;
  tabId: number;
  windowId: number;
  startedAt: number;
  endedAt: number | null;
  activeMs: number;
}

export interface DailyTotalRow {
  /** `${domain}|${date}` */
  id: string;
  domain: string;
  /** "YYYY-MM-DD", local calendar date */
  date: string;
  totalMs: number;
  visits: number;
}

export interface TrackerSettingsRow {
  id: "state";
  enabled: boolean;
  excludedDomains: string[];
  /** closed sessions after this mark have not been folded into dailyTotals yet */
  lastRollupAt: number;
  updatedAt: number;
}

/** Markdown → PDF — docs/roadmap/02-markdown-pdf.md §1. A doc is small; no source/blob split needed. */
export interface MarkdownDocRow {
  id: string;
  title: string;
  source: string;
  updatedAt: number;
}

/**
 * Whiteboard — docs/roadmap/03-whiteboard.md §1. Split the same way the audio
 * tables are: `boards` is the small elements/appState tree the board-picker
 * grid reads for every board at once, `boardFiles` is the (potentially many
 * MB per image) pasted-image blobs, read only for the one board being opened.
 */
export interface BoardRow {
  id: string;
  name: string;
  /** small PNG data URL for the board-picker grid */
  thumbnail: string;
  elements: unknown;
  appState: unknown;
  fileIds: string[];
  elementCount: number;
  updatedAt: number;
}

export interface BoardFileRow {
  /** Excalidraw's own fileId */
  id: string;
  boardId: string;
  dataURL: string;
  mimeType: string;
  createdAt: number;
}

/** Auto Clear Cache — docs/roadmap/06-auto-clear-cache.md §1. */
export interface ClearDataTypes {
  cache: boolean;
  cookies: boolean;
  history: boolean;
  formData: boolean;
  /** the download LIST in chrome://downloads, never the files themselves — see §5 */
  downloadHistory: boolean;
}

export type ClearFrequency = "hourly" | "daily" | "weekly" | "onBrowserClose";

export interface AutoClearSettingsRow {
  id: "state";
  enabled: boolean;
  frequency: ClearFrequency;
  dataTypes: ClearDataTypes;
  /** only ever enforced for cookies, via chrome.cookies — see §5 for why cache/history can't honor this */
  excludedDomains: string[];
  lastRunAt: number | null;
  updatedAt: number;
}

export interface ClearLogRow {
  id: string;
  ranAt: number;
  trigger: "scheduled" | "manual";
  /** snapshot of what was cleared THAT run — the schedule can change afterwards */
  dataTypes: string[];
  success: boolean;
  errorMessage?: string;
}

/**
 * Image Editor — docs/roadmap/07-image-editor.md §1/§5. Same split as
 * Whiteboard's `boards`/`boardFiles`: `fabricJson` here never embeds a raw
 * `data:` URL for a pasted image, only an `asset://<id>` placeholder — the
 * actual (often large) base64 image lives one row per asset in
 * `imageAssets`, swapped back in only when a project is opened.
 */
export interface ImageLayerRow {
  id: string;
  /** matches the FabricObject's own custom `layerId` property */
  fabricObjectId: string;
  name: string;
  kind: "image" | "rect" | "ellipse" | "line" | "text" | "path" | "blur";
  visible: boolean;
  locked: boolean;
}

export interface ImageProjectRow {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  /** fabric Canvas#toObject(["layerId"]) output, with image `src` replaced by `asset://<id>` */
  fabricJson: unknown;
  layers: ImageLayerRow[];
  thumbnail: string;
  updatedAt: number;
}

export interface ImageAssetRow {
  id: string;
  projectId: string;
  dataURL: string;
  mimeType: string;
  createdAt: number;
}

/**
 * Video Editor — docs/roadmap/08-video-editor.md §1. Split the same way as
 * every other media tool in this project: `videoProjects` is a small tree of
 * clip cut-points, `videoSources` holds the (large, sometimes multi-hundred-MB)
 * original file blobs, read once and never decoded-and-kept — see that doc's
 * §1 on why video, unlike audio, cannot use a shared-decoded-buffer model.
 */
export interface VideoClipRow {
  id: string;
  sourceId: string;
  offset: number;
  duration: number;
  crop?: { left: number; top: number; width: number; height: number };
  rotate: 0 | 90 | 180 | 270;
  keepOwnAudio: boolean;
}

/** Voiceover/background-music lane — free positions, unlike the video sequence. Absent on rows written before this existed, so readers default it to []. */
export interface AudioOverlayTrackRow {
  id: string;
  name: string;
  clips: Array<{
    id: string;
    sourceId: string;
    start: number;
    offset: number;
    duration: number;
    gainDb: number;
    fadeIn: number;
    fadeOut: number;
  }>;
  muted: boolean;
  volumeDb: number;
}

/**
 * The timeline as N typed tracks of freely-positioned items — the shape that
 * replaced `clips` + `audioTracks`. Rows written under the old shape are
 * converted on read (video-editor/engine/migrate.ts), so BOTH sets of fields
 * are declared optional here and neither is ever written alongside the other.
 * The row is deliberately loose about an item's contents: the item union is
 * the editor's business, and duplicating it here would mean two definitions
 * to keep in step.
 */
export interface TimelineTrackRow {
  id: string;
  kind: "video" | "audio" | "text" | "effect";
  name: string;
  items: unknown[];
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  volumeDb: number;
}

export interface VideoProjectRow {
  id: string;
  name: string;
  tracks?: TimelineTrackRow[];
  /** legacy shape, read-only — see migrate.ts */
  clips?: VideoClipRow[];
  /** legacy shape, read-only */
  audioTracks?: AudioOverlayTrackRow[];
  outputWidth: number;
  outputHeight: number;
  /** true once the user has picked a frame size */
  frameChosen?: boolean;
  thumbnail: string;
  updatedAt: number;
}

export interface VideoSourceRow {
  id: string;
  projectId: string;
  blob: Blob;
  fileName: string;
  /** absent on rows written before the media bin existed, which only ever held video */
  mediaKind?: "video" | "audio" | "image";
  duration: number;
  width: number;
  height: number;
  /** whether the file carries any audio at all — decides if audio controls are offered */
  hasAudio?: boolean;
}

/**
 * Bumped to 7 with the audio tables. It was stuck at 5 while the store had
 * already declared version 6 (musicTracks) — and since backup.ts compares
 * against this constant to reject imports from a newer build, it was lying.
 */
export const DB_SCHEMA_VERSION = 12;

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
  audioProjects: EntityTable<AudioProjectRow, "id">;
  audioSources: EntityTable<AudioSourceRow, "id">;
  activitySessions: EntityTable<ActivitySessionRow, "id">;
  dailyTotals: EntityTable<DailyTotalRow, "id">;
  trackerSettings: EntityTable<TrackerSettingsRow, "id">;
  markdownDocs: EntityTable<MarkdownDocRow, "id">;
  boards: EntityTable<BoardRow, "id">;
  boardFiles: EntityTable<BoardFileRow, "id">;
  autoClearSettings: EntityTable<AutoClearSettingsRow, "id">;
  clearLog: EntityTable<ClearLogRow, "id">;
  imageProjects: EntityTable<ImageProjectRow, "id">;
  imageAssets: EntityTable<ImageAssetRow, "id">;
  videoProjects: EntityTable<VideoProjectRow, "id">;
  videoSources: EntityTable<VideoSourceRow, "id">;
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

db.version(7).stores({
  audioProjects: "id, updatedAt",
  audioSources: "id, projectId",
});

db.version(8).stores({
  // no index on endedAt: IndexedDB does not reliably index `null` key values
  // across engines, and finding the (rare, at most one) open session is a
  // bounded scan anyway since old sessions get pruned — see rollupAndPrune.
  activitySessions: "id, domain, startedAt",
  dailyTotals: "id, domain, date",
  trackerSettings: "id",
});

db.version(9).stores({
  markdownDocs: "id, updatedAt",
  boards: "id, updatedAt",
  boardFiles: "id, boardId",
});

db.version(10).stores({
  autoClearSettings: "id",
  clearLog: "id, ranAt",
});

db.version(11).stores({
  imageProjects: "id, updatedAt",
  imageAssets: "id, projectId",
});

db.version(12).stores({
  videoProjects: "id, updatedAt",
  videoSources: "id, projectId",
});

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage.estimate()) ?? {};
    return { usage, quota };
  } catch {
    return null;
  }
}

export { ensurePersistentStorage, getStorageQuota, isStoragePersisted } from "./persistence";

