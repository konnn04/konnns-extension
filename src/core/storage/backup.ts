import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { db, DB_SCHEMA_VERSION, type AvatarRow, type WallpaperRow } from "./db";

/**
 * Import/Export backup — docs/core-he-thong/03-storage-backup.md §2.
 * Zip layout:
 *   manifest.json   — schema version, export date, enabled features
 *   settings.json   — full `settings` table
 *   data.json       — remaining tables except wallpapers
 *   wallpapers/     — raw blob files + wallpapers.json metadata
 */

interface BackupManifest {
  schemaVersion: number;
  exportedAt: number;
  enabledFeatures: string[];
}

function extFor(type: string, name: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName) return fromName;
  return type === "video" ? "mp4" : "jpg";
}

export async function exportBackup(): Promise<void> {
  const [settings, wallpapers, avatars, customClocks, windowStates, notes, tasks] = await Promise.all([
    db.settings.toArray(),
    db.wallpapers.toArray(),
    db.avatars.toArray(),
    db.customClocks.toArray(),
    db.windowStates.toArray(),
    db.notes.toArray(),
    db.tasks.toArray(),
  ]);

  const manifest: BackupManifest = {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: Date.now(),
    enabledFeatures: settings.filter((s) => s.enabled).map((s) => s.featureId),
  };

  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "settings.json": strToU8(JSON.stringify(settings, null, 2)),
    "data.json": strToU8(JSON.stringify({ customClocks, windowStates, notes, tasks }, null, 2)),
  };

  const wallpaperMeta: Array<Omit<WallpaperRow, "blob"> & { file: string }> = [];
  for (const w of wallpapers) {
    const file = `wallpapers/${w.id}.${extFor(w.type, w.name)}`;
    const { blob, ...meta } = w;
    wallpaperMeta.push({ ...meta, file });
    files[file] = new Uint8Array(await blob.arrayBuffer());
  }
  files["wallpapers.json"] = strToU8(JSON.stringify(wallpaperMeta, null, 2));

  const avatarMeta: Array<Omit<AvatarRow, "blob"> & { file: string }> = [];
  for (const a of avatars) {
    const file = `avatars/${a.id}.${extFor(a.type === "gif" ? "image" : a.type, a.name)}`;
    const { blob, ...meta } = a;
    avatarMeta.push({ ...meta, file });
    files[file] = new Uint8Array(await blob.arrayBuffer());
  }
  files["avatars.json"] = strToU8(JSON.stringify(avatarMeta, null, 2));

  const zipped = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `newtab-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok: boolean;
  error?: "invalid" | "newer-version";
}

export async function importBackup(file: File): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "invalid" };
  }

  const readJson = <T>(name: string): T | null => {
    const raw = entries[name];
    if (!raw) return null;
    try {
      return JSON.parse(strFromU8(raw)) as T;
    } catch {
      return null;
    }
  };

  const manifest = readJson<BackupManifest>("manifest.json");
  if (!manifest || typeof manifest.schemaVersion !== "number") return { ok: false, error: "invalid" };
  if (manifest.schemaVersion > DB_SCHEMA_VERSION) return { ok: false, error: "newer-version" };
  // Older versions: schema v1 is the first — future versions add migrations here.

  const settings = readJson<import("./db").SettingsRow[]>("settings.json") ?? [];
  const data = readJson<{
    customClocks?: import("./db").CustomClockRow[];
    windowStates?: import("./db").WindowStateRow[];
    notes?: import("./db").NoteRow[];
    tasks?: import("./db").TaskRow[];
  }>("data.json") ?? {};
  const wallpaperMeta =
    readJson<Array<Omit<WallpaperRow, "blob"> & { file: string }>>("wallpapers.json") ?? [];
  const avatarMeta =
    readJson<Array<Omit<AvatarRow, "blob"> & { file: string }>>("avatars.json") ?? [];

  if (!Array.isArray(settings)) return { ok: false, error: "invalid" };

  const wallpapers: WallpaperRow[] = [];
  for (const meta of wallpaperMeta) {
    const raw = entries[meta.file];
    if (!raw) continue;
    const { file: _file, ...rest } = meta;
    const mime = meta.type === "video" ? "video/mp4" : "image/jpeg";
    wallpapers.push({ ...rest, blob: new Blob([raw as BlobPart], { type: mime }) });
  }

  const avatars: AvatarRow[] = [];
  for (const meta of avatarMeta) {
    const raw = entries[meta.file];
    if (!raw) continue;
    const { file: _file, ...rest } = meta;
    const mime = meta.type === "gif" ? "image/gif" : "image/jpeg";
    avatars.push({ ...rest, blob: new Blob([raw as BlobPart], { type: mime }) });
  }

  await db.transaction(
    "rw",
    [db.settings, db.wallpapers, db.avatars, db.customClocks, db.windowStates, db.notes, db.tasks],
    async () => {
      await Promise.all([
        db.settings.bulkPut(settings),
        db.wallpapers.bulkPut(wallpapers),
        db.avatars.bulkPut(avatars),
        db.customClocks.bulkPut(data.customClocks ?? []),
        db.windowStates.bulkPut(data.windowStates ?? []),
        db.notes.bulkPut(data.notes ?? []),
        db.tasks.bulkPut(data.tasks ?? []),
      ]);
    },
  );

  return { ok: true };
}
