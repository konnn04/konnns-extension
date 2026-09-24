import { Canvas, FabricObject, type IText } from "fabric";
import type { LayerEntry, LayerKind } from "./types";

// Ensure standard top-left origin for all objects (Photoshop/Canvas 2D model)
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";

/**
 * Mutations on a live `fabric.Canvas` — separated from `EditorCanvas.tsx` to
 * keep the React component to lifecycle/event wiring. Not pure (these touch
 * a real canvas instance) so unlike engine/assets.ts or engine/history.ts
 * they are not Node-testable — same tradeoff Whiteboard's Excalidraw
 * wrapper made, see docs/site/*.
 */

/** Every object gets a stable id the moment it exists, independent of Fabric's own internal object identity. */
export function assignLayerId(obj: FabricObject): string {
  const existing = obj.get("layerId") as string | undefined;
  if (existing) return existing;
  const id = crypto.randomUUID();
  obj.set({ layerId: id });
  return id;
}

export function kindOf(obj: FabricObject): LayerKind {
  const t = obj.type;
  if (t === "image") return "image";
  if (t === "rect") return "rect";
  if (t === "ellipse") return "ellipse";
  if (t === "line") return "line";
  if (t === "i-text" || t === "textbox" || t === "text") return "text";
  if ((obj as unknown as { isRedactPatch?: boolean }).isRedactPatch) return "blur";
  return "path";
}

function defaultNameFor(obj: FabricObject, index: number): string {
  const kind = kindOf(obj);
  const label: Record<LayerKind, string> = {
    image: "Image",
    rect: "Rectangle",
    ellipse: "Ellipse",
    line: "Line",
    text: "Text",
    path: "Path",
    blur: "Redacted area",
  };
  return `${label[kind]} ${index + 1}`;
}

/** The layer panel's rows, top-of-stack first — always derived live from the canvas, never a second source of truth kept in sync by hand. */
export function layersFromCanvas(canvas: Canvas): LayerEntry[] {
  const objects = canvas.getObjects();
  return objects
    .map((obj, i) => {
      const id = (obj.get("layerId") as string | undefined) ?? assignLayerId(obj);
      return {
        id,
        fabricObjectId: id,
        name: (obj.get("layerName") as string | undefined) ?? defaultNameFor(obj, i),
        kind: kindOf(obj),
        visible: obj.visible !== false,
        locked: obj.get("locked") === true,
      };
    })
    .reverse(); // Fabric stores back-to-front; the panel shows front (topmost) first
}

export function findByLayerId(canvas: Canvas, layerId: string): FabricObject | undefined {
  return canvas.getObjects().find((o) => o.get("layerId") === layerId);
}

export function selectLayer(canvas: Canvas, layerId: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj || obj.get("locked") === true) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return;
  }
  canvas.setActiveObject(obj);
  canvas.requestRenderAll();
}

export function setLayerVisible(canvas: Canvas, layerId: string, visible: boolean): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  obj.set({ visible });
  if (!visible && canvas.getActiveObject() === obj) {
    canvas.discardActiveObject();
  }
  canvas.requestRenderAll();
}

const LOCK_PROPS = ["lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation"] as const;

export function setLayerLocked(canvas: Canvas, layerId: string, locked: boolean): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  const patch: Record<string, boolean> = { locked, selectable: !locked, evented: !locked };
  for (const p of LOCK_PROPS) patch[p] = locked;
  obj.set(patch);
  if (locked) {
    const active = canvas.getActiveObject();
    if (active === obj) {
      canvas.discardActiveObject();
    } else if (active && "getObjects" in active && typeof (active as { getObjects?: () => FabricObject[] }).getObjects === "function") {
      const activeGroup = (active as { getObjects: () => FabricObject[] }).getObjects();
      if (activeGroup.includes(obj)) {
        canvas.discardActiveObject();
      }
    }
  }
  canvas.requestRenderAll();
}

export function setLayerName(canvas: Canvas, layerId: string, name: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  obj.set({ layerName: name });
}

/** Drag-reorder in the (reversed, front-first) panel → Fabric's real back-to-front index. */
export function moveLayerToPanelIndex(canvas: Canvas, layerId: string, panelIndex: number): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  const total = canvas.getObjects().length;
  const fabricIndex = total - 1 - panelIndex;
  canvas.moveObjectTo(obj, Math.max(0, Math.min(total - 1, fabricIndex)));
  canvas.requestRenderAll();
}

export function deleteLayer(canvas: Canvas, layerId: string): boolean {
  const obj = findByLayerId(canvas, layerId);
  if (!obj || obj.get("locked") === true) return false;
  canvas.remove(obj);
  if (canvas.getActiveObject() === obj) {
    canvas.discardActiveObject();
  }
  canvas.requestRenderAll();
  return true;
}

export async function duplicateLayer(canvas: Canvas, layerId: string): Promise<FabricObject | null> {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return null;
  const cloned = await obj.clone();
  cloned.set({
    left: (obj.left ?? 0) + 20,
    top: (obj.top ?? 0) + 20,
    assetId: crypto.randomUUID(),
  });
  assignLayerId(cloned);
  canvas.add(cloned);
  canvas.setActiveObject(cloned);
  canvas.requestRenderAll();
  return cloned;
}

export function bringLayerForward(canvas: Canvas, layerId: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  canvas.bringObjectForward(obj);
  canvas.requestRenderAll();
}

export function sendLayerBackward(canvas: Canvas, layerId: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  canvas.sendObjectBackwards(obj);
  canvas.requestRenderAll();
}

export function bringLayerToFront(canvas: Canvas, layerId: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  canvas.bringObjectToFront(obj);
  canvas.requestRenderAll();
}

export function sendLayerToBack(canvas: Canvas, layerId: string): void {
  const obj = findByLayerId(canvas, layerId);
  if (!obj) return;
  canvas.sendObjectToBack(obj);
  canvas.requestRenderAll();
}

export function alignObject(
  canvas: Canvas,
  obj: FabricObject,
  align: "left" | "center-h" | "right" | "top" | "center-v" | "bottom",
): void {
  const canvasW = canvas.width ?? 1000;
  const canvasH = canvas.height ?? 700;
  const objW = (obj.width ?? 0) * (obj.scaleX ?? 1);
  const objH = (obj.height ?? 0) * (obj.scaleY ?? 1);

  switch (align) {
    case "left":
      obj.set("left", 0);
      break;
    case "center-h":
      obj.set("left", Math.round((canvasW - objW) / 2));
      break;
    case "right":
      obj.set("left", Math.round(canvasW - objW));
      break;
    case "top":
      obj.set("top", 0);
      break;
    case "center-v":
      obj.set("top", Math.round((canvasH - objH) / 2));
      break;
    case "bottom":
      obj.set("top", Math.round(canvasH - objH));
      break;
  }
  obj.setCoords();
  canvas.requestRenderAll();
}

export function flipObject(canvas: Canvas, obj: FabricObject, axis: "x" | "y"): void {
  if (axis === "x") {
    obj.set("flipX", !obj.flipX);
  } else {
    obj.set("flipY", !obj.flipY);
  }
  obj.setCoords();
  canvas.requestRenderAll();
}

export function rotateObject(canvas: Canvas, obj: FabricObject, deltaDegrees: number): void {
  const current = obj.angle ?? 0;
  const next = (current + deltaDegrees + 360) % 360;
  obj.set("angle", next);
  obj.setCoords();
  canvas.requestRenderAll();
}

export function updateLayerTransform(
  canvas: Canvas,
  obj: FabricObject,
  patch: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    angle?: number;
    opacity?: number;
    flipX?: boolean;
    flipY?: boolean;
  },
): void {
  if (patch.x !== undefined) obj.set("left", patch.x);
  if (patch.y !== undefined) obj.set("top", patch.y);
  if (patch.angle !== undefined) obj.set("angle", patch.angle);
  if (patch.opacity !== undefined) obj.set("opacity", Math.max(0, Math.min(1, patch.opacity)));
  if (patch.flipX !== undefined) obj.set("flipX", patch.flipX);
  if (patch.flipY !== undefined) obj.set("flipY", patch.flipY);

  if (patch.width !== undefined && patch.width > 0) {
    if (obj.type === "rect") {
      obj.set({ width: patch.width, scaleX: 1 });
    } else {
      const baseW = obj.width || 1;
      obj.set("scaleX", patch.width / baseW);
    }
  }

  if (patch.height !== undefined && patch.height > 0) {
    if (obj.type === "rect") {
      obj.set({ height: patch.height, scaleY: 1 });
    } else {
      const baseH = obj.height || 1;
      obj.set("scaleY", patch.height / baseH);
    }
  }

  obj.setCoords();
  canvas.requestRenderAll();
}

export function updateLayerText(
  canvas: Canvas,
  obj: FabricObject,
  patch: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
  },
): void {
  if (obj.type !== "i-text" && obj.type !== "text" && obj.type !== "textbox") return;
  const textObj = obj as unknown as IText;
  if (patch.fontSize !== undefined) textObj.set("fontSize", patch.fontSize);
  if (patch.fontWeight !== undefined) textObj.set("fontWeight", patch.fontWeight);
  if (patch.fontStyle !== undefined) textObj.set("fontStyle", patch.fontStyle as "normal" | "italic" | "oblique");
  if (patch.textAlign !== undefined) textObj.set("textAlign", patch.textAlign);
  textObj.setCoords();
  canvas.requestRenderAll();
}

export function deleteSelected(canvas: Canvas): boolean {
  const active = canvas.getActiveObjects();
  if (active.length === 0) return false;
  for (const obj of active) {
    if (obj.get("locked") === true) continue;
    canvas.remove(obj);
  }
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  return true;
}

/** Custom properties every object round-trips through save/load — see engine/assets.ts for why `assetId` matters. */
export const PERSISTED_OBJECT_PROPS = [
  "layerId",
  "layerName",
  "locked",
  "assetId",
  "isRedactPatch",
  "selectable",
  "evented",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
];
