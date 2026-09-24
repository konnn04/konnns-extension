/**
 * Shared shapes — docs/roadmap/07-image-editor.md §1.
 *
 * A "layer" here is a Fabric OBJECT (a rect, a piece of text, a pasted
 * image), not a raster layer you can freehand-paint on independently — see
 * that doc's own note on why that is the right scope for "annotate a bug
 * screenshot", not a general raster editor.
 */

export type LayerKind = "image" | "rect" | "ellipse" | "line" | "text" | "path" | "blur";

export interface LayerEntry {
  id: string;
  /** matches the FabricObject's own custom `layerId` property, round-tripped through toObject/loadFromJSON */
  fabricObjectId: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
}

export interface ImageProjectSummary {
  id: string;
  name: string;
  thumbnail: string;
  updatedAt: number;
}

export interface ImageProjectRecord extends ImageProjectSummary {
  canvasWidth: number;
  canvasHeight: number;
  /** fabric Canvas#toObject(["layerId","assetId"]) output — image `src` values are `asset://<id>` placeholders, see engine/assets.ts */
  fabricJson: FabricCanvasJson;
  layers: LayerEntry[];
}

export interface FabricCanvasJson {
  objects?: FabricObjectJson[];
  [key: string]: unknown;
}

export interface FabricObjectJson {
  type?: string;
  src?: string;
  assetId?: string;
  layerId?: string;
  objects?: FabricObjectJson[]; // nested (Group / ActiveSelection)
  [key: string]: unknown;
}

export type ToolId = "select" | "rect" | "ellipse" | "line" | "text" | "brush" | "crop" | "redact";

export function newProject(name: string, width: number, height: number): ImageProjectRecord {
  return {
    id: crypto.randomUUID(),
    name,
    thumbnail: "",
    updatedAt: Date.now(),
    canvasWidth: width,
    canvasHeight: height,
    fabricJson: { objects: [] },
    layers: [],
  };
}
