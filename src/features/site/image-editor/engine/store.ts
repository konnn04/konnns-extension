import { db, type ImageAssetRow } from "@/core/storage/db";
import { extractAssets, referencedAssetIds } from "./assets";
import type { FabricCanvasJson, ImageProjectRecord, ImageProjectSummary } from "./types";

export async function listProjects(): Promise<ImageProjectSummary[]> {
  const rows = await db.imageProjects.orderBy("updatedAt").reverse().toArray();
  return rows.map(({ id, name, thumbnail, updatedAt }) => ({ id, name, thumbnail, updatedAt }));
}

export async function getProject(id: string): Promise<ImageProjectRecord | undefined> {
  const row = await db.imageProjects.get(id);
  return row as ImageProjectRecord | undefined;
}

export async function getProjectAssets(projectId: string): Promise<Map<string, string>> {
  const rows = await db.imageAssets.where("projectId").equals(projectId).toArray();
  return new Map(rows.map((r) => [r.id, r.dataURL]));
}

export async function deleteProject(id: string): Promise<void> {
  await db.imageProjects.delete(id);
  const keys = await db.imageAssets.where("projectId").equals(id).primaryKeys();
  if (keys.length > 0) await db.imageAssets.bulkDelete(keys);
}

/**
 * Splits `fabricJson` (pulling embedded base64 images out into `imageAssets`,
 * see engine/assets.ts) and writes both tables, then sweeps any asset the
 * tree no longer references — the Image Editor equivalent of Whiteboard's
 * orphaned-`boardFiles` sweep.
 */
export async function saveProject(project: ImageProjectRecord): Promise<void> {
  const { json, assets } = extractAssets(project.fabricJson);
  const liveIds = referencedAssetIds(project.fabricJson);

  const existingIds = new Set((await db.imageAssets.where("projectId").equals(project.id).primaryKeys()) as string[]);
  const newRows: ImageAssetRow[] = assets
    .filter((a) => !existingIds.has(a.id))
    .map((a) => ({ id: a.id, projectId: project.id, dataURL: a.dataURL, mimeType: a.mimeType, createdAt: Date.now() }));
  const staleIds = [...existingIds].filter((id) => !liveIds.has(id));

  await db.transaction("rw", db.imageProjects, db.imageAssets, async () => {
    await db.imageProjects.put({ ...project, fabricJson: json as FabricCanvasJson, updatedAt: Date.now() });
    if (newRows.length > 0) await db.imageAssets.bulkPut(newRows);
    if (staleIds.length > 0) await db.imageAssets.bulkDelete(staleIds);
  });
}

export async function duplicateProject(id: string, newName?: string): Promise<ImageProjectRecord | null> {
  const original = await getProject(id);
  if (!original) return null;
  const newId = crypto.randomUUID();
  const originalAssets = await getProjectAssets(id);

  // Map old asset IDs to new asset IDs in fabricJson
  let jsonString = JSON.stringify(original.fabricJson);
  const newAssets: ImageAssetRow[] = [];
  for (const [oldAssetId, dataURL] of originalAssets) {
    const nextAssetId = crypto.randomUUID();
    jsonString = jsonString.split(oldAssetId).join(nextAssetId);
    newAssets.push({
      id: nextAssetId,
      projectId: newId,
      dataURL,
      mimeType: "image/png",
      createdAt: Date.now(),
    });
  }

  const copy: ImageProjectRecord = {
    ...original,
    id: newId,
    name: newName || `${original.name} (Copy)`,
    fabricJson: JSON.parse(jsonString) as FabricCanvasJson,
    updatedAt: Date.now(),
  };

  await db.transaction("rw", db.imageProjects, db.imageAssets, async () => {
    await db.imageProjects.put(copy);
    if (newAssets.length > 0) await db.imageAssets.bulkPut(newAssets);
  });

  return copy;
}

