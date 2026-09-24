import type { FabricCanvasJson, FabricObjectJson } from "./types";

/**
 * Asset extraction — docs/roadmap/07-image-editor.md §5, "Dán ảnh rất lớn...
 * làm phình fabricJson vì ảnh được nhúng dạng base64". Every FabricImage gets
 * a stable `assetId` the moment it is created (see EditorCanvas.tsx); these
 * pure functions are the two directions of the swap between what Fabric
 * wants to see (`src: "data:..."`) and what actually gets persisted
 * (`src: "asset://<id>"`, with the real bytes in a separate `imageAssets`
 * row) — kept pure and separate from Dexie so they're testable under plain
 * Node, same reasoning as Web Time Tracker's engine/session.ts.
 */

export interface ExtractedAsset {
  id: string;
  dataURL: string;
  mimeType: string;
}

function mimeTypeOf(dataURL: string): string {
  const match = /^data:([^;,]+)/.exec(dataURL);
  return match?.[1] ?? "application/octet-stream";
}

function walk(objects: FabricObjectJson[] | undefined, visit: (o: FabricObjectJson) => void): void {
  for (const o of objects ?? []) {
    visit(o);
    if (o.objects) walk(o.objects, visit);
  }
}

/** For SAVING: pulls every embedded image's base64 `src` out into its own asset, replacing it with an `asset://` placeholder in the tree that gets persisted. Non-image objects pass through untouched. */
export function extractAssets(json: FabricCanvasJson): { json: FabricCanvasJson; assets: ExtractedAsset[] } {
  const assets: ExtractedAsset[] = [];
  const clone = structuredClone(json) as FabricCanvasJson;

  walk(clone.objects, (o) => {
    if (o.type !== "image" || typeof o.src !== "string" || !o.src.startsWith("data:")) return;
    if (typeof o.assetId !== "string" || o.assetId.length === 0) return; // shouldn't happen — every image gets one at creation
    assets.push({ id: o.assetId, dataURL: o.src, mimeType: mimeTypeOf(o.src) });
    o.src = `asset://${o.assetId}`;
  });

  return { json: clone, assets };
}

/** For LOADING: the inverse — swaps every `asset://<id>` placeholder back to a real `data:` URL Fabric can actually render, from a preloaded id → dataURL map. */
export function reattachAssets(json: FabricCanvasJson, assetsById: Map<string, string>): FabricCanvasJson {
  const clone = structuredClone(json) as FabricCanvasJson;

  walk(clone.objects, (o) => {
    if (o.type !== "image" || typeof o.src !== "string" || !o.src.startsWith("asset://")) return;
    const id = o.src.slice("asset://".length);
    const dataURL = assetsById.get(id);
    if (dataURL) o.src = dataURL;
  });

  return clone;
}

/** Which assetIds a tree currently references — for deleting orphaned `imageAssets` rows after an image is removed from the canvas. */
export function referencedAssetIds(json: FabricCanvasJson): Set<string> {
  const ids = new Set<string>();
  walk(json.objects, (o) => {
    if (o.type === "image" && typeof o.assetId === "string" && o.assetId.length > 0) ids.add(o.assetId);
  });
  return ids;
}
