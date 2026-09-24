import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, Ellipse, FabricImage, FabricObject, IText, Line, PencilBrush, Rect } from "fabric";
import type { TPointerEventInfo } from "fabric";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  alignObject as opAlignObject,
  assignLayerId,
  bringLayerForward as opBringForward,
  bringLayerToFront as opBringToFront,
  deleteLayer as opDeleteLayer,
  deleteSelected as opDeleteSelected,
  duplicateLayer as opDuplicateLayer,
  flipObject as opFlipObject,
  kindOf,
  layersFromCanvas,
  moveLayerToPanelIndex,
  PERSISTED_OBJECT_PROPS,
  rotateObject as opRotateObject,
  selectLayer as opSelectLayer,
  sendLayerBackward as opSendBackward,
  sendLayerToBack as opSendToBack,
  setLayerLocked as opSetLayerLocked,
  setLayerName as opSetLayerName,
  setLayerVisible as opSetLayerVisible,
  updateLayerText as opUpdateText,
  updateLayerTransform as opUpdateTransform,
} from "./engine/canvasOps";
import { canRedo, canUndo, initHistory, pushHistory, redo as historyRedo, undo as historyUndo, type HistoryState } from "./engine/history";
import { reattachAssets } from "./engine/assets";
import { normalizeCropRect, shiftForCrop, type CropRect } from "./engine/crop";
import { blockSizeFor, pixelateRgba } from "./engine/redact";
import { CropOverlay } from "./CropOverlay";
import type { FabricCanvasJson, ImageProjectRecord, LayerEntry, ToolId } from "./engine/types";

/** Max HTML canvas dimension most engines allow reliably — docs/roadmap/07-image-editor.md §5. */
export const MAX_CANVAS_DIMENSION = 16384;

export interface SelectedLayerProperties {
  hasSelection: boolean;
  layerId?: string;
  type?: string;
  name?: string;
  kind?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  flipX?: boolean;
  flipY?: boolean;
  locked?: boolean;
}

export type SelectionStyleInfo = SelectedLayerProperties;

export interface EditorCanvasHandle {
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  selectLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => Promise<void>;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setLayerVisible: (id: string, v: boolean) => void;
  setLayerLocked: (id: string, v: boolean) => void;
  setLayerName: (id: string, name: string) => void;
  moveLayer: (id: string, panelIndex: number) => void;
  exportDataURL: (format: "png" | "jpeg", quality: number, transparent: boolean) => string;
  getSnapshot: () => FabricCanvasJson;
  addImageFromDataURL: (dataURL: string) => Promise<void>;
  setCanvasSize: (width: number, height: number) => void;
  fitToContent: () => void;
  cropToSelected: () => void;
  updateActiveObjectStyle: (style: { fill?: string; stroke?: string; strokeWidth?: number }) => void;
  updateActiveObjectTransform: (patch: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    angle?: number;
    opacity?: number;
    flipX?: boolean;
    flipY?: boolean;
  }) => void;
  updateActiveObjectText: (patch: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
  }) => void;
  alignActiveObject: (alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  flipActiveObject: (axis: "x" | "y") => void;
  rotateActiveObject: (deltaDegrees: number) => void;
  setCanvasBackgroundColor: (color: string) => void;
  getCanvasSize: () => { width: number; height: number };
  addTextLayer: () => void;
  addShapeLayer: (kind: "rect" | "ellipse") => void;
}

export const EditorCanvas = forwardRef<
  EditorCanvasHandle,
  {
    project: ImageProjectRecord;
    assets: Map<string, string>;
    activeTool: ToolId;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    autoExpandCanvas: boolean;
    onToolChange: (tool: ToolId) => void;
    onLayersChange: (layers: LayerEntry[]) => void;
    onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
    onSnapshot: (json: FabricCanvasJson, dimensions?: { width: number; height: number }, thumbnail?: string) => void;
    onPasteError: (message: string) => void;
    onSelectionChange?: (info: SelectedLayerProperties) => void;
    onDimensionsChange?: (dims: { width: number; height: number }) => void;
  }
>(function EditorCanvas(
  {
    project,
    assets,
    activeTool,
    fillColor,
    strokeColor,
    strokeWidth,
    autoExpandCanvas,
    onToolChange,
    onLayersChange,
    onHistoryChange,
    onSnapshot,
    onPasteError,
    onSelectionChange,
    onDimensionsChange,
  },
  ref,
) {
  const { t } = useTranslation();
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const toolRef = useRef<ToolId>(activeTool);
  toolRef.current = activeTool;

  const [canvasDimensions, setCanvasDimensions] = useState({
    width: project.canvasWidth,
    height: project.canvasHeight,
  });

  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const fillColorRef = useRef(fillColor);
  fillColorRef.current = fillColor;
  const strokeColorRef = useRef(strokeColor);
  strokeColorRef.current = strokeColor;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;
  const autoExpandRef = useRef(autoExpandCanvas);
  autoExpandRef.current = autoExpandCanvas;

  const drawingRef = useRef<{ shape: FabricObject; startX: number; startY: number } | null>(null);
  const historyRef = useRef<HistoryState<FabricCanvasJson>>(initHistory(project.fabricJson));
  const restoringRef = useRef(false);

  /* Crop/redact drag state. The frame is a DOM overlay, never a Fabric
   * object — see CropOverlay.tsx for why. `live` is true only while the
   * mouse is still down, which is what decides whether the Apply/Cancel
   * buttons are showing yet. */
  const regionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [region, setRegion] = useState<{ rect: CropRect; live: boolean } | null>(null);

  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(0.1, Math.min(5, Number(newZoom.toFixed(2))));
    zoomRef.current = clamped;
    setZoomState(clamped);
  }, []);

  const fitToViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cw = canvasDimensions.width;
    const ch = canvasDimensions.height;
    const pad = 48;
    const availW = container.clientWidth - pad;
    const availH = container.clientHeight - pad;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(availW / cw, availH / ch, 1);
    applyZoom(scale);
  }, [applyZoom, canvasDimensions.width, canvasDimensions.height]);

  const updateSelection = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) {
      onSelectionChange?.({
        hasSelection: false,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        angle: 0,
        opacity: 100,
      });
      return;
    }
    const rawFill = active.get("fill");
    const rawStroke = active.get("stroke");
    const rawStrokeWidth = active.get("strokeWidth");
    const objW = Math.round((active.width ?? 0) * (active.scaleX ?? 1));
    const objH = Math.round((active.height ?? 0) * (active.scaleY ?? 1));
    const activeAny = active as any;

    onSelectionChange?.({
      hasSelection: true,
      layerId: active.get("layerId") as string | undefined,
      type: active.type,
      name: active.get("layerName") as string | undefined,
      kind: kindOf(active),
      left: Math.round(active.left ?? 0),
      top: Math.round(active.top ?? 0),
      width: objW,
      height: objH,
      angle: Math.round((active.angle ?? 0) % 360),
      opacity: Math.round((active.opacity ?? 1) * 100),
      fill: typeof rawFill === "string" ? rawFill : undefined,
      stroke: typeof rawStroke === "string" ? rawStroke : undefined,
      strokeWidth: typeof rawStrokeWidth === "number" ? rawStrokeWidth : undefined,
      fontSize: typeof activeAny.fontSize === "number" ? activeAny.fontSize : undefined,
      fontWeight: typeof activeAny.fontWeight === "string" ? activeAny.fontWeight : undefined,
      fontStyle: typeof activeAny.fontStyle === "string" ? activeAny.fontStyle : undefined,
      textAlign: typeof activeAny.textAlign === "string" ? activeAny.textAlign : undefined,
      flipX: Boolean(active.flipX),
      flipY: Boolean(active.flipY),
      locked: active.get("locked") === true,
    });
  };

  const getThumbnailDataUrl = (canvas: Canvas): string => {
    if (canvas.getObjects().length === 0) return "";
    const maxDim = 320;
    const curMax = Math.max(canvas.width || 1, canvas.height || 1);
    const multiplier = Math.min(1, maxDim / curMax);
    return canvas.toDataURL({ format: "jpeg", quality: 0.7, multiplier });
  };

  const afterChange = () => {
    const canvas = fabricRef.current;
    if (!canvas || restoringRef.current) return;

    const snapshot = {
      ...canvas.toObject(PERSISTED_OBJECT_PROPS),
      width: canvas.width,
      height: canvas.height,
    } as FabricCanvasJson;

    historyRef.current = pushHistory(historyRef.current, snapshot);
    onHistoryChange(canUndo(historyRef.current), canRedo(historyRef.current));
    onLayersChange(layersFromCanvas(canvas));
    const thumb = getThumbnailDataUrl(canvas);
    onSnapshot(snapshot, { width: canvas.width, height: canvas.height }, thumb);
    updateSelection();
  };

  const syncCanvasObjectPermissions = useCallback((canvas: Canvas) => {
    const isSelect = toolRef.current === "select";
    canvas.skipTargetFind = !isSelect;
    canvas.selection = isSelect;
    canvas.forEachObject((o) => {
      const isLocked = o.get("locked") === true;
      if (isLocked) {
        o.set({
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
        });
      } else {
        o.set({
          selectable: isSelect,
          evented: isSelect,
          lockMovementX: false,
          lockMovementY: false,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
      }
    });
  }, []);

  const restore = (json: FabricCanvasJson) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    restoringRef.current = true;
    if (typeof json.width === "number" && typeof json.height === "number") {
      canvas.setDimensions({ width: json.width, height: json.height });
      setCanvasDimensions({ width: json.width, height: json.height });
      onDimensionsChange?.({ width: json.width, height: json.height });
    }
    void canvas.loadFromJSON(reattachAssets(json, assets)).then(() => {
      syncCanvasObjectPermissions(canvas);
      canvas.requestRenderAll();
      restoringRef.current = false;
      onLayersChange(layersFromCanvas(canvas));
      onHistoryChange(canUndo(historyRef.current), canRedo(historyRef.current));
      updateSelection();
    });
  };

  /* ------------------------------------------------------ crop & redact */

  /**
   * Shrink the canvas to the frame, then move EVERY object by the crop
   * origin — docs/roadmap/07-image-editor.md §5. Skipping the second half is
   * the classic bug: the canvas resizes correctly but every annotation
   * floats away from whatever it was pointing at.
   */
  const applyCrop = (rect: CropRect) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    for (const obj of canvas.getObjects()) {
      const moved = shiftForCrop({ left: obj.left ?? 0, top: obj.top ?? 0 }, rect);
      obj.set(moved);
      obj.setCoords();
    }
    canvas.setDimensions({ width: rect.width, height: rect.height });
    setCanvasDimensions({ width: rect.width, height: rect.height });
    canvas.requestRenderAll();
    setRegion(null);
    onDimensionsChange?.({ width: rect.width, height: rect.height });
    onToolChange("select");
    afterChange();
  };

  /**
   * Flatten whatever is inside the frame to pixels, destroy those pixels,
   * and lay the result back on top as an ordinary image object.
   */
  const applyRedact = async (rect: CropRect) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const flattened = canvas.toCanvasElement(1, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    const ctx = flattened.getContext("2d");
    if (!ctx) return;

    const image = ctx.getImageData(0, 0, flattened.width, flattened.height);
    const pixelated = pixelateRgba(image.data, flattened.width, flattened.height, blockSizeFor(flattened.width, flattened.height));
    ctx.putImageData(new ImageData(pixelated, flattened.width, flattened.height), 0, 0);

    const isSelect = toolRef.current === "select";
    const patch = await FabricImage.fromURL(flattened.toDataURL("image/png"));
    patch.set({
      left: rect.left,
      top: rect.top,
      assetId: crypto.randomUUID(),
      isRedactPatch: true,
      layerName: "Redacted area",
      selectable: isSelect,
      evented: isSelect,
    });
    canvas.add(patch);
    assignLayerId(patch);
    canvas.requestRenderAll();
    afterChange();
  };

  /* -------------------------------------------------------------- setup */
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new Canvas(canvasElRef.current, {
      width: project.canvasWidth,
      height: project.canvasHeight,
      backgroundColor: "#ffffff",
      selection: true,
      enableRetinaScaling: false,
    });
    fabricRef.current = canvas;

    void canvas.loadFromJSON(reattachAssets(project.fabricJson, assets)).then(() => {
      syncCanvasObjectPermissions(canvas);
      canvas.requestRenderAll();
      onLayersChange(layersFromCanvas(canvas));
      if (!project.thumbnail && canvas.getObjects().length > 0) {
        const thumb = getThumbnailDataUrl(canvas);
        if (thumb) {
          onSnapshot(project.fabricJson, { width: canvas.width, height: canvas.height }, thumb);
        }
      }
    });

    canvas.on("object:modified", () => {
      setSnapGuides({ x: null, y: null });
      updateSelection();
      afterChange();
    });
    canvas.on("object:scaling", (e) => {
      if (toolRef.current !== "select" || e.target?.get("locked") === true) return;
      updateSelection();
    });
    canvas.on("object:rotating", (e) => {
      if (toolRef.current !== "select" || e.target?.get("locked") === true) return;
      updateSelection();
    });
    canvas.on("object:removed", afterChange);

    const SNAP_THRESHOLD = 8;
    canvas.on("object:moving", (e) => {
      const obj = e.target;
      if (!obj) return;
      if (toolRef.current !== "select" || obj.get("locked") === true || obj.lockMovementX) return;
      const canvasW = canvas.width ?? project.canvasWidth;
      const canvasH = canvas.height ?? project.canvasHeight;

      const objW = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const objH = (obj.height ?? 0) * (obj.scaleY ?? 1);
      const currentLeft = obj.left ?? 0;
      const currentTop = obj.top ?? 0;

      let snappedLeft = currentLeft;
      let snappedTop = currentTop;
      let lineX: number | null = null;
      let lineY: number | null = null;

      // Snap X: left (0), right (canvasW - objW), center ((canvasW - objW) / 2)
      if (Math.abs(currentLeft) < SNAP_THRESHOLD) {
        snappedLeft = 0;
        lineX = 0;
      } else if (Math.abs(currentLeft + objW - canvasW) < SNAP_THRESHOLD) {
        snappedLeft = canvasW - objW;
        lineX = canvasW;
      } else if (Math.abs(currentLeft + objW / 2 - canvasW / 2) < SNAP_THRESHOLD) {
        snappedLeft = (canvasW - objW) / 2;
        lineX = canvasW / 2;
      }

      // Snap Y: top (0), bottom (canvasH - objH), center ((canvasH - objH) / 2)
      if (Math.abs(currentTop) < SNAP_THRESHOLD) {
        snappedTop = 0;
        lineY = 0;
      } else if (Math.abs(currentTop + objH - canvasH) < SNAP_THRESHOLD) {
        snappedTop = canvasH - objH;
        lineY = canvasH;
      } else if (Math.abs(currentTop + objH / 2 - canvasH / 2) < SNAP_THRESHOLD) {
        snappedTop = (canvasH - objH) / 2;
        lineY = canvasH / 2;
      }

      obj.set({ left: snappedLeft, top: snappedTop });
      obj.setCoords();
      setSnapGuides({ x: lineX, y: lineY });
      updateSelection();
    });

    canvas.on("mouse:up", () => {
      setSnapGuides({ x: null, y: null });
    });

    canvas.on("selection:created", updateSelection);
    canvas.on("selection:updated", updateSelection);
    canvas.on("selection:cleared", () => {
      onSelectionChange?.({
        hasSelection: false,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        angle: 0,
        opacity: 100,
      });
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
    // mount once — project switches remount this component (parent keys it by project id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------- drawing tools */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const isSelect = activeTool === "select";
    canvas.isDrawingMode = activeTool === "brush";
    if (activeTool === "brush") {
      const brush = new PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    }

    if (!isSelect) {
      canvas.discardActiveObject();
      onSelectionChange?.({
        hasSelection: false,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        angle: 0,
        opacity: 100,
      });
    }

    syncCanvasObjectPermissions(canvas);
    canvas.defaultCursor = isSelect ? "default" : "crosshair";

    if (activeTool !== "crop") {
      regionStartRef.current = null;
      setRegion(null);
    }
    canvas.requestRenderAll();
  }, [activeTool, strokeColor, strokeWidth, onSelectionChange, syncCanvasObjectPermissions]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = strokeColor;
    canvas.freeDrawingBrush.width = strokeWidth;
  }, [strokeColor, strokeWidth]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const onPathCreated = (e: { path?: FabricObject }) => {
      const canvas2 = fabricRef.current;
      const pathObj = e?.path || (canvas2 ? canvas2.getObjects()[canvas2.getObjects().length - 1] : null);
      if (pathObj) {
        assignLayerId(pathObj);
        pathObj.set({ selectable: false, evented: false });
      }
      afterChange();
    };
    canvas.on("path:created", onPathCreated);
    return () => {
      canvas.off("path:created", onPathCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const getCanvasPoint = (c: Canvas, evt: TPointerEventInfo): { x: number; y: number } => {
      const upperEl = c.upperCanvasEl;
      const nativeEvt = evt.e as MouseEvent | TouchEvent;
      if (!upperEl || !nativeEvt) {
        return evt.scenePoint || { x: 0, y: 0 };
      }
      const rect = upperEl.getBoundingClientRect();
      const clientX = "clientX" in nativeEvt ? nativeEvt.clientX : (nativeEvt as TouchEvent).touches?.[0]?.clientX ?? rect.left;
      const clientY = "clientY" in nativeEvt ? nativeEvt.clientY : (nativeEvt as TouchEvent).touches?.[0]?.clientY ?? rect.top;

      const cw = c.width ?? canvasDimensions.width;
      const ch = c.height ?? canvasDimensions.height;
      const displayW = rect.width || cw;
      const displayH = rect.height || ch;

      const x = ((clientX - rect.left) / displayW) * cw;
      const y = ((clientY - rect.top) / displayH) * ch;

      return {
        x: Math.max(0, Math.min(cw, x)),
        y: Math.max(0, Math.min(ch, y)),
      };
    };

    const onDown = (e: TPointerEventInfo) => {
      const tool = toolRef.current;
      if (tool === "select" || tool === "brush") return;
      canvas.discardActiveObject();
      const { x, y } = getCanvasPoint(canvas, e);

      if (tool === "crop" || tool === "redact") {
        regionStartRef.current = { x, y };
        setRegion(null);
        return;
      }

      const activeFill = fillColorRef.current;
      const activeStroke = strokeColorRef.current;
      const activeWidth = strokeWidthRef.current;

      if (tool === "text") {
        const textColor = activeFill === "transparent" ? activeStroke : activeFill;
        const text = new IText("", { left: x, top: y, fontSize: 24, fill: textColor });
        canvas.add(text);
        assignLayerId(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        onToolChange("select");
        return;
      }

      let shape: FabricObject;
      if (tool === "rect") {
        shape = new Rect({ left: x, top: y, width: 1, height: 1, fill: activeFill, stroke: activeStroke, strokeWidth: activeWidth });
      } else if (tool === "ellipse") {
        shape = new Ellipse({ left: x, top: y, rx: 1, ry: 1, fill: activeFill, stroke: activeStroke, strokeWidth: activeWidth });
      } else if (tool === "line") {
        shape = new Line([x, y, x, y], { stroke: activeStroke, strokeWidth: activeWidth });
      } else {
        return;
      }

      shape.set({ selectable: false, evented: false });
      canvas.add(shape);
      drawingRef.current = { shape, startX: x, startY: y };
    };

    const onMove = (e: TPointerEventInfo) => {
      const start = regionStartRef.current;
      if (start) {
        const pt = getCanvasPoint(canvas, e);
        const rect = normalizeCropRect(
          start.x,
          start.y,
          pt.x,
          pt.y,
          canvas.width ?? canvasDimensions.width,
          canvas.height ?? canvasDimensions.height,
        );
        setRegion(rect ? { rect, live: true } : null);
        return;
      }

      const drawing = drawingRef.current;
      if (!drawing) return;
      const { x, y } = getCanvasPoint(canvas, e);
      const { shape, startX, startY } = drawing;

      if (shape instanceof Rect) {
        shape.set({ left: Math.min(startX, x), top: Math.min(startY, y), width: Math.abs(x - startX), height: Math.abs(y - startY) });
      } else if (shape instanceof Ellipse) {
        shape.set({ left: Math.min(startX, x), top: Math.min(startY, y), rx: Math.abs(x - startX) / 2, ry: Math.abs(y - startY) / 2 });
      } else if (shape instanceof Line) {
        shape.set({ x2: x, y2: y });
      }
      shape.setCoords();
      canvas.requestRenderAll();
    };

    const onUp = () => {
      const start = regionStartRef.current;
      if (start) {
        regionStartRef.current = null;
        setRegion((prev) => {
          if (!prev) return null;
          if (toolRef.current === "redact") {
            void applyRedact(prev.rect);
            return null;
          }
          return { ...prev, live: false };
        });
        return;
      }

      const drawing = drawingRef.current;
      drawingRef.current = null;
      if (!drawing) return;
      const { shape } = drawing;
      const tooSmall =
        (shape instanceof Rect && (shape.width ?? 0) < 3 && (shape.height ?? 0) < 3) ||
        (shape instanceof Ellipse && (shape.rx ?? 0) < 2 && (shape.ry ?? 0) < 2) ||
        (shape instanceof Line && Math.hypot((shape.x2 ?? 0) - (shape.x1 ?? 0), (shape.y2 ?? 0) - (shape.y1 ?? 0)) < 3);
      if (tooSmall) {
        canvas.remove(shape);
        return;
      }
      assignLayerId(shape);
      shape.set({ selectable: true, evented: true });
      canvas.setActiveObject(shape);
      onToolChange("select");
      afterChange();
    };

    canvas.on("mouse:down", onDown);
    canvas.on("mouse:move", onMove);
    canvas.on("mouse:up", onUp);
    return () => {
      canvas.off("mouse:down", onDown);
      canvas.off("mouse:move", onMove);
      canvas.off("mouse:up", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToolChange, canvasDimensions.width, canvasDimensions.height]);

  /* --------------------------------------------------------------- paste */

  const addImageFromDataURL = (dataURL: string): Promise<void> =>
    new Promise((resolve) => {
      const canvas = fabricRef.current;
      if (!canvas) return resolve();
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > MAX_CANVAS_DIMENSION || img.naturalHeight > MAX_CANVAS_DIMENSION) {
          onPasteError("imageEditor.pasteTooLarge");
          return resolve();
        }
        void FabricImage.fromURL(dataURL).then((fabricImg) => {
          const objects = canvas.getObjects();
          const wasEmpty = objects.length === 0;

          fabricImg.set({
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            scaleX: 1,
            scaleY: 1,
            strokeWidth: 0,
            width: img.naturalWidth,
            height: img.naturalHeight,
            assetId: crypto.randomUUID(),
          });
          canvas.add(fabricImg);
          assignLayerId(fabricImg);

          if (wasEmpty) {
            canvas.setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setCanvasDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            onDimensionsChange?.({ width: img.naturalWidth, height: img.naturalHeight });
          }

          const isSelect = toolRef.current === "select";
          fabricImg.set({ selectable: isSelect, evented: isSelect });
          if (isSelect) {
            canvas.setActiveObject(fabricImg);
          } else {
            canvas.discardActiveObject();
          }
          afterChange();
          resolve();
        });
      };
      img.onerror = () => {
        onPasteError("imageEditor.pasteFailed");
        resolve();
      };
      img.src = dataURL;
    });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();

      const reader = new FileReader();
      reader.onload = () => void addImageFromDataURL(reader.result as string);
      reader.readAsDataURL(file);
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------- zoom & pan handlers */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        applyZoom(zoomRef.current * factor);
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing) return;

      if (e.code === "Space" && !e.repeat) {
        isSpacePressedRef.current = true;
        container.style.cursor = "grab";
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        if (!isPanningRef.current) {
          container.style.cursor = "";
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && isSpacePressedRef.current)) {
        e.preventDefault();
        isPanningRef.current = true;
        container.style.cursor = "grabbing";
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      container.scrollLeft = panStartRef.current.scrollLeft - dx;
      container.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const onMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        container.style.cursor = isSpacePressedRef.current ? "grab" : "";
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  /* ------------------------------------------------------------ shortcuts */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing) return;

      // Ctrl + / - / 0 zoom shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          applyZoom(zoomRef.current * 1.15);
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          applyZoom(zoomRef.current * 0.85);
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          applyZoom(1);
          return;
        }
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) doRedo();
          else doUndo();
          return;
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          doRedo();
          return;
        }
      }

      // Arrow keys nudge selected object
      const active = fabricRef.current?.getActiveObject();
      if (active && !(active as any).isEditing) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowUp") active.set("top", (active.top ?? 0) - step);
          if (e.key === "ArrowDown") active.set("top", (active.top ?? 0) + step);
          if (e.key === "ArrowLeft") active.set("left", (active.left ?? 0) - step);
          if (e.key === "ArrowRight") active.set("left", (active.left ?? 0) + step);
          active.setCoords();
          fabricRef.current?.requestRenderAll();
          afterChange();
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (opDeleteSelected(fabricRef.current!)) {
          e.preventDefault();
          afterChange();
        }
        return;
      }

      if (e.key === "Escape") {
        onToolChange("select");
        return;
      }

      const map: Record<string, ToolId> = { v: "select", r: "rect", o: "ellipse", l: "line", t: "text", b: "brush", c: "crop", e: "redact" };
      const tool = map[e.key.toLowerCase()];
      if (tool) onToolChange(tool);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToolChange, applyZoom]);

  const doUndo = () => {
    if (!canUndo(historyRef.current)) return;
    historyRef.current = historyUndo(historyRef.current);
    restore(historyRef.current.present);
    onSnapshot(historyRef.current.present, {
      width: fabricRef.current?.width ?? project.canvasWidth,
      height: fabricRef.current?.height ?? project.canvasHeight,
    });
  };

  const doRedo = () => {
    if (!canRedo(historyRef.current)) return;
    historyRef.current = historyRedo(historyRef.current);
    restore(historyRef.current.present);
    onSnapshot(historyRef.current.present, {
      width: fabricRef.current?.width ?? project.canvasWidth,
      height: fabricRef.current?.height ?? project.canvasHeight,
    });
  };

  const fitToContent = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of objects) {
      const br = obj.getBoundingRect();
      if (br.left < minX) minX = br.left;
      if (br.top < minY) minY = br.top;
      if (br.left + br.width > maxX) maxX = br.left + br.width;
      if (br.top + br.height > maxY) maxY = br.top + br.height;
    }

    const pad = 24;
    const shiftX = Math.round(minX - pad);
    const shiftY = Math.round(minY - pad);

    canvas.discardActiveObject();
    for (const obj of objects) {
      obj.set({
        left: (obj.left ?? 0) - shiftX,
        top: (obj.top ?? 0) - shiftY,
      });
      obj.setCoords();
    }

    const newW = Math.max(100, Math.min(MAX_CANVAS_DIMENSION, Math.round(maxX - minX + pad * 2)));
    const newH = Math.max(100, Math.min(MAX_CANVAS_DIMENSION, Math.round(maxY - minY + pad * 2)));
    canvas.setDimensions({ width: newW, height: newH });
    canvas.requestRenderAll();
    onDimensionsChange?.({ width: newW, height: newH });
    afterChange();
  };

  const cropToSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const br = active.getBoundingRect();
    const rect: CropRect = {
      left: Math.max(0, Math.round(br.left)),
      top: Math.max(0, Math.round(br.top)),
      width: Math.min(canvas.width, Math.max(10, Math.round(br.width))),
      height: Math.min(canvas.height, Math.max(10, Math.round(br.height))),
    };
    applyCrop(rect);
  };

  const setCanvasSize = (width: number, height: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const clampedW = Math.max(100, Math.min(MAX_CANVAS_DIMENSION, Math.round(width)));
    const clampedH = Math.max(100, Math.min(MAX_CANVAS_DIMENSION, Math.round(height)));
    canvas.setDimensions({ width: clampedW, height: clampedH });
    setCanvasDimensions({ width: clampedW, height: clampedH });
    canvas.requestRenderAll();
    onDimensionsChange?.({ width: clampedW, height: clampedH });
    afterChange();
  };

  const updateActiveObjectStyle = (style: { fill?: string; stroke?: string; strokeWidth?: number }) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    if (style.fill !== undefined && active.type !== "line") {
      active.set("fill", style.fill);
    }
    if (style.stroke !== undefined) {
      active.set("stroke", style.stroke);
    }
    if (style.strokeWidth !== undefined) {
      active.set("strokeWidth", style.strokeWidth);
    }
    canvas.requestRenderAll();
    afterChange();
  };

  useImperativeHandle(ref, () => ({
    undo: doUndo,
    redo: doRedo,
    deleteSelected: () => {
      if (fabricRef.current && opDeleteSelected(fabricRef.current)) afterChange();
    },
    selectLayer: (id: string) => {
      if (fabricRef.current) {
        onToolChange("select");
        opSelectLayer(fabricRef.current, id);
      }
      updateSelection();
    },
    deleteLayer: (id: string) => {
      if (fabricRef.current && opDeleteLayer(fabricRef.current, id)) afterChange();
    },
    duplicateLayer: async (id: string) => {
      if (fabricRef.current) {
        await opDuplicateLayer(fabricRef.current, id);
        afterChange();
      }
    },
    bringForward: (id: string) => {
      if (fabricRef.current) {
        opBringForward(fabricRef.current, id);
        afterChange();
      }
    },
    sendBackward: (id: string) => {
      if (fabricRef.current) {
        opSendBackward(fabricRef.current, id);
        afterChange();
      }
    },
    bringToFront: (id: string) => {
      if (fabricRef.current) {
        opBringToFront(fabricRef.current, id);
        afterChange();
      }
    },
    sendToBack: (id: string) => {
      if (fabricRef.current) {
        opSendToBack(fabricRef.current, id);
        afterChange();
      }
    },
    setLayerVisible: (id, v) => {
      if (fabricRef.current) opSetLayerVisible(fabricRef.current, id, v);
      afterChange();
    },
    setLayerLocked: (id, v) => {
      if (fabricRef.current) opSetLayerLocked(fabricRef.current, id, v);
      updateSelection();
      afterChange();
    },
    setLayerName: (id, name) => {
      if (fabricRef.current) opSetLayerName(fabricRef.current, id, name);
      afterChange();
    },
    moveLayer: (id, panelIndex) => {
      if (fabricRef.current) moveLayerToPanelIndex(fabricRef.current, id, panelIndex);
      afterChange();
    },
    exportDataURL: (format, quality, transparent) => {
      const canvas = fabricRef.current;
      if (!canvas) return "";
      const prevBg = canvas.backgroundColor;
      if (format === "png" && transparent) canvas.set({ backgroundColor: "" });
      canvas.requestRenderAll();
      const url = canvas.toDataURL({ format, quality, multiplier: 1 });
      canvas.set({ backgroundColor: prevBg });
      canvas.requestRenderAll();
      return url;
    },
    getSnapshot: () => {
      const canvas = fabricRef.current;
      if (!canvas) return project.fabricJson;
      return {
        ...canvas.toObject(PERSISTED_OBJECT_PROPS),
        width: canvas.width,
        height: canvas.height,
      } as FabricCanvasJson;
    },
    addImageFromDataURL,
    setCanvasSize,
    fitToContent,
    cropToSelected,
    updateActiveObjectStyle,
    updateActiveObjectTransform: (patch) => {
      const canvas = fabricRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      opUpdateTransform(canvas, obj, patch);
      afterChange();
    },
    updateActiveObjectText: (patch) => {
      const canvas = fabricRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      opUpdateText(canvas, obj, patch);
      afterChange();
    },
    alignActiveObject: (alignment) => {
      const canvas = fabricRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      opAlignObject(canvas, obj, alignment);
      afterChange();
    },
    flipActiveObject: (axis) => {
      const canvas = fabricRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      opFlipObject(canvas, obj, axis);
      afterChange();
    },
    rotateActiveObject: (delta) => {
      const canvas = fabricRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      opRotateObject(canvas, obj, delta);
      afterChange();
    },
    setCanvasBackgroundColor: (color) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.set({ backgroundColor: color });
      canvas.requestRenderAll();
      afterChange();
    },
    getCanvasSize: () => ({
      width: fabricRef.current?.width ?? project.canvasWidth,
      height: fabricRef.current?.height ?? project.canvasHeight,
    }),
    addTextLayer: () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const cw = canvas.width ?? project.canvasWidth;
      const ch = canvas.height ?? project.canvasHeight;
      const text = new IText(t("imageEditor.sampleText", "Văn bản mẫu"), {
        left: Math.round(cw / 4),
        top: Math.round(ch / 4),
        fontSize: 32,
        fill: "#000000",
      });
      canvas.add(text);
      assignLayerId(text);
      canvas.setActiveObject(text);
      afterChange();
    },
    addShapeLayer: (kind) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const cw = canvas.width ?? project.canvasWidth;
      const ch = canvas.height ?? project.canvasHeight;
      const posX = Math.round(cw / 4);
      const posY = Math.round(ch / 4);
      let shape: FabricObject;
      if (kind === "rect") {
        shape = new Rect({
          left: posX,
          top: posY,
          width: 200,
          height: 120,
          fill: "#3b82f6",
          stroke: "#1d4ed8",
          strokeWidth: 2,
        });
      } else {
        shape = new Ellipse({
          left: posX,
          top: posY,
          rx: 100,
          ry: 75,
          fill: "#10b981",
          stroke: "#047857",
          strokeWidth: 2,
        });
      }
      canvas.add(shape);
      assignLayerId(shape);
      canvas.setActiveObject(shape);
      afterChange();
    },
  }));

  return (
    <div ref={scrollContainerRef} className="ied__canvas-scroll">
      <div
        className="ied__canvas-viewport"
        style={{
          width: Math.round(canvasDimensions.width * zoom),
          height: Math.round(canvasDimensions.height * zoom),
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          className="ied__canvas-stage"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            position: "relative",
          }}
        >
          <canvas ref={canvasElRef} />
          {snapGuides.x !== null && (
            <div
              className="ied__snap-line ied__snap-line--v"
              style={{ left: `${snapGuides.x}px` }}
            />
          )}
          {snapGuides.y !== null && (
            <div
              className="ied__snap-line ied__snap-line--h"
              style={{ top: `${snapGuides.y}px` }}
            />
          )}
          {region && (
            <CropOverlay
              rect={region.rect}
              zoom={1}
              live={region.live}
              onApply={() => applyCrop(region.rect)}
              onCancel={() => setRegion(null)}
            />
          )}
        </div>
      </div>

      <div className="ied__zoom-bar" role="toolbar" aria-label={t("imageEditor.zoomControls", "Điều chỉnh thu phóng")}>
        <button
          type="button"
          className="ied__zoom-btn"
          title={t("imageEditor.zoomOut", "Thu nhỏ (Ctrl -)")}
          onClick={() => applyZoom(zoom - 0.1)}
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          className="ied__zoom-label"
          title={t("imageEditor.resetZoom", "Đặt lại 100% (Ctrl 0)")}
          onClick={() => applyZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="ied__zoom-btn"
          title={t("imageEditor.zoomIn", "Phóng to (Ctrl +)")}
          onClick={() => applyZoom(zoom + 0.1)}
        >
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          className="ied__zoom-btn ied__zoom-btn--fit"
          title={t("imageEditor.fitViewport", "Vừa màn hình")}
          onClick={fitToViewport}
        >
          <Maximize2 size={12} />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
});
