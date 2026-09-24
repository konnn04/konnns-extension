import { db } from "@/core/storage/db";
import { migrateProject } from "./migrate";
import type { MediaKind, MediaSource, VideoProject, VideoProjectSummary } from "./model";

export async function listProjects(): Promise<VideoProjectSummary[]> {
  const rows = await db.videoProjects.orderBy("updatedAt").reverse().toArray();
  return rows.map(({ id, name, thumbnail, updatedAt }) => ({ id, name, thumbnail, updatedAt }));
}

/** Track names for a project converted from the old shape; passed in so they can be localised. */
export interface MigrationNames {
  video: string;
  audio: string;
  text: string;
  effect: string;
}

const DEFAULT_MIGRATION_NAMES: MigrationNames = {
  video: "Video",
  audio: "Audio",
  text: "Text",
  effect: "Effect",
};

export async function getProject(id: string, names: MigrationNames = DEFAULT_MIGRATION_NAMES): Promise<VideoProject | undefined> {
  const row = await db.videoProjects.get(id);
  if (!row) return undefined;
  // every load goes through the converter: a row may have been written by an
  // older build at any point, and returning an empty timeline would look
  // exactly like losing the project
  return migrateProject(row as Parameters<typeof migrateProject>[0], names);
}

export async function saveProject(project: VideoProject): Promise<void> {
  await db.videoProjects.put({ ...project, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.videoProjects.delete(id);
  const keys = await db.videoSources.where("projectId").equals(id).primaryKeys();
  if (keys.length > 0) await db.videoSources.bulkDelete(keys);
}

export async function duplicateProject(
  id: string,
  copySuffix = "(bản sao)",
  names: MigrationNames = DEFAULT_MIGRATION_NAMES,
): Promise<VideoProject | undefined> {
  const existing = await getProject(id, names);
  if (!existing) return undefined;
  const newId = crypto.randomUUID();

  /*
   * The copied files get new ids, so the copied TIMELINE has to be rewritten
   * to point at them. Without the remap below the duplicate silently keeps
   * referencing the original's files: deleting the original would then break
   * the copy, and the freshly copied bytes would sit there referenced by
   * nothing.
   */
  const sources = await db.videoSources.where("projectId").equals(id).toArray();
  const remap = new Map<string, string>();
  for (const src of sources) {
    const copiedId = crypto.randomUUID();
    remap.set(src.id, copiedId);
    await db.videoSources.put({ ...src, id: copiedId, projectId: newId });
  }

  const copy: VideoProject = {
    ...existing,
    id: newId,
    name: `${existing.name || "Untitled"} ${copySuffix}`.trim(),
    updatedAt: Date.now(),
    tracks: existing.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) =>
        "sourceId" in item ? { ...item, sourceId: remap.get(item.sourceId) ?? item.sourceId } : item,
      ),
    })),
  };
  await saveProject(copy);

  return copy;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const row = await db.videoProjects.get(id);
  if (!row) return;
  await db.videoProjects.put({ ...row, name, updatedAt: Date.now() });
}

export async function addSource(
  projectId: string,
  blob: Blob,
  fileName: string,
  meta: { mediaKind: MediaKind; duration: number; width: number; height: number; hasAudio?: boolean },
): Promise<MediaSource> {
  const id = crypto.randomUUID();
  await db.videoSources.put({
    id,
    projectId,
    blob,
    fileName,
    mediaKind: meta.mediaKind,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    hasAudio: meta.hasAudio === true,
  });
  return { id, fileName, mediaKind: meta.mediaKind, duration: meta.duration, width: meta.width, height: meta.height, hasAudio: meta.hasAudio };
}

export async function getSourceBlob(sourceId: string): Promise<Blob | undefined> {
  return (await db.videoSources.get(sourceId))?.blob;
}

export async function listSources(projectId: string): Promise<MediaSource[]> {
  const rows = await db.videoSources.where("projectId").equals(projectId).toArray();
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    // rows written before the media bin existed only ever held video
    mediaKind: (row.mediaKind as MediaKind | undefined) ?? "video",
    duration: row.duration,
    width: row.width,
    height: row.height,
    hasAudio: row.hasAudio,
  }));
}

export async function deleteSource(sourceId: string): Promise<void> {
  await db.videoSources.delete(sourceId);
}

/**
 * Sources nothing on the timeline references any more.
 *
 * Unlike before, an imported file is NOT swept just because no item uses it:
 * the media bin is a place things live until the user removes them, so a
 * clip deleted from the timeline must leave its file available to drop back
 * in. Only files removed from the bin are deleted, which this is called with.
 */
export async function sweepOrphanSources(projectId: string, liveSourceIds: Set<string>): Promise<void> {
  const rows = await db.videoSources.where("projectId").equals(projectId).primaryKeys();
  const stale = (rows as string[]).filter((id) => !liveSourceIds.has(id));
  if (stale.length > 0) await db.videoSources.bulkDelete(stale);
}
