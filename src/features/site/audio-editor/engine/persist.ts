import { db } from "@/core/storage/db";
import { yieldToUI } from "./activity";
import { decodeAtRate } from "./decode";
import * as P from "./project";
import type { Project, Track } from "./project";
import { decodeWav, encodeWav } from "./wav";

/**
 * Saving projects, and reclaiming the space they leave behind —
 * docs/site/01-audio-editor.md §6.
 *
 * Audio is by far the heaviest thing this extension stores, so saving and
 * cleaning up are designed together: anything that can write tens of
 * megabytes needs a matching way to get them back.
 */

/**
 * 32-bit float: a source written as WAV is the working master, not a delivery
 * format, so it must not lose anything on the way through storage.
 *
 * Only sources with no original file are written this way — see `origins`.
 * Re-encoding an imported mp3 to float WAV turned a 4 MB file into ~138 MB,
 * which is what made a single song report over a hundred megabytes.
 */
const SOURCE_BIT_DEPTH = 32;

export interface ProjectSummary {
  id: string;
  name: string;
  duration: number;
  trackCount: number;
  clipCount: number;
  /** total bytes of the saved sources */
  bytes: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ save */

/**
 * Write the tree, and only write sources that are not on disk yet.
 *
 * Sources are immutable, so this is safe and it is what makes autosave
 * affordable: dragging a clip rewrites a few KB of JSON, not the audio.
 */
export async function saveProject(
  projectId: string,
  name: string,
  project: Project,
): Promise<void> {
  const existing = new Set(
    await db.audioSources.where("projectId").equals(projectId).primaryKeys(),
  );

  const needed = P.referencedSources([project]);
  for (const sourceId of needed) {
    if (existing.has(sourceId)) continue;
    const buffer = project.sources.get(sourceId);
    if (!buffer) continue;

    // Prefer the file the audio came from: it is already compressed, and it
    // decodes back to the same samples. Only audio this editor created — the
    // output of a destructive effect — has to be written as WAV.
    const origin = project.origins.get(sourceId);
    await db.audioSources.put({
      id: sourceId,
      projectId,
      blob: origin ?? encodeWav(buffer, SOURCE_BIT_DEPTH),
      sampleRate: buffer.sampleRate,
      encoded: origin !== undefined,
    });
  }

  await db.audioProjects.put({
    id: projectId,
    name,
    tracks: project.tracks as unknown,
    masterEffects: project.masterEffects as unknown,
    sampleRate: project.sampleRate,
    duration: P.projectDuration(project),
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ load */

export async function loadProject(
  projectId: string,
  onProgress?: (value: number) => void,
): Promise<{ project: Project; name: string } | null> {
  const row = await db.audioProjects.get(projectId);
  if (!row) return null;

  const sources = new Map<string, AudioBuffer>();
  const origins = new Map<string, Blob>();
  const rows = await db.audioSources.where("projectId").equals(projectId).toArray();
  for (let i = 0; i < rows.length; i++) {
    const source = rows[i];
    onProgress?.(i / rows.length);
    // decodeWav is synchronous and a WAV source can be a hundred megabytes, so
    // hand the thread back between files or the whole load is one frozen turn
    await yieldToUI();

    if (source.encoded) {
      // decode at the SAVED rate, not the device rate
      sources.set(source.id, await decodeAtRate(source.blob, row.sampleRate));
      origins.set(source.id, source.blob);
    } else {
      sources.set(source.id, decodeWav(await source.blob.arrayBuffer()));
    }
  }
  onProgress?.(1);

  const tracks = row.tracks as Track[];
  // A source could be missing if storage was cleared mid-session; dropping
  // those clips is better than rendering a project that throws on playback.
  // `effects` is defaulted because projects saved before effect chains
  // existed have no such field.
  const cleaned = tracks.map((track) => ({
    ...track,
    effects: track.effects ?? [],
    clips: track.clips
      .filter((clip) => sources.has(clip.sourceId))
      // clips saved before clip chains existed have no `effects` field
      .map((clip) => ({ ...clip, effects: clip.effects ?? [] })),
  }));

  return {
    project: {
      sources,
      origins,
      tracks: cleaned,
      sampleRate: row.sampleRate,
      masterEffects: (row.masterEffects as Project["masterEffects"]) ?? [],
    },
    name: row.name,
  };
}

/* ----------------------------------------------------------- housekeeping */

/**
 * Delete stored sources nothing references any more.
 *
 * `keep` must include the sources used by every history step, not just the
 * current tree — collecting a buffer that only an older step uses would turn
 * undo into a crash. That is why the caller passes the whole history in.
 */
export async function sweepOrphanSources(projectId: string, keep: Set<string>): Promise<number> {
  const ids = await db.audioSources.where("projectId").equals(projectId).primaryKeys();
  const orphans = ids.filter((id) => !keep.has(id as string));
  if (orphans.length === 0) return 0;

  let freed = 0;
  for (const id of orphans) {
    const row = await db.audioSources.get(id as string);
    freed += row?.blob.size ?? 0;
  }
  await db.audioSources.bulkDelete(orphans);
  return freed;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await db.audioProjects.orderBy("updatedAt").reverse().toArray();
  const summaries: ProjectSummary[] = [];
  for (const row of rows) {
    const sources = await db.audioSources.where("projectId").equals(row.id).toArray();
    const tracks = row.tracks as Track[];
    summaries.push({
      id: row.id,
      name: row.name,
      duration: row.duration,
      trackCount: tracks.length,
      clipCount: tracks.reduce((n, t) => n + t.clips.length, 0),
      bytes: sources.reduce((n, s) => n + s.blob.size, 0),
      updatedAt: row.updatedAt,
    });
  }
  return summaries;
}

export async function deleteProject(projectId: string): Promise<void> {
  const ids = await db.audioSources.where("projectId").equals(projectId).primaryKeys();
  await db.audioSources.bulkDelete(ids);
  await db.audioProjects.delete(projectId);
}

/** Wipe every saved audio project. Always behind a confirmation in the UI. */
export async function deleteAllProjects(): Promise<void> {
  await db.audioSources.clear();
  await db.audioProjects.clear();
}

export async function totalAudioBytes(): Promise<number> {
  let total = 0;
  await db.audioSources.each((row) => {
    total += row.blob.size;
  });
  return total;
}

export { formatBytes } from "@/shared/utils/format";

