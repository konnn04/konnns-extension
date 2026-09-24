import { useCallback, useEffect, useRef, useState } from "react";
import { dragCrop, type CropHandle } from "./engine/crop";
import { placeFrame, sourceRectToDest } from "./engine/frameGeometry";
import { resolveVisual, type CropRect, type TrackItem } from "./engine/model";

const HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * The draggable rectangle over the preview — docs/test-001.md §4.1 and §6.3,
 * which asks for crop and cover boxes to share one component rather than
 * growing two near-identical drag implementations.
 *
 * It handles two coordinate stories, because the model has two:
 *
 *  - `crop` is in SOURCE pixels and belongs to one particular file, so it is
 *    mapped through the item's own placement (scale/position) before hitting
 *    the screen. While it is being dragged the picture is drawn UNCROPPED,
 *    so the mapping deliberately ignores the crop too.
 *  - a caption or cover rect is in OUTPUT pixels and belongs to the finished
 *    frame. It needs no source mapping at all — only the canvas's own
 *    contain-fit letterboxing, which is re-measured on resize because the
 *    preview changes size with the window.
 */
export function FrameBox({
  canvasEl,
  mode,
  rect,
  item,
  sourceWidth,
  sourceHeight,
  outputWidth,
  outputHeight,
  label,
  onChange,
  onCommit,
}: {
  canvasEl: HTMLCanvasElement | null;
  /** `crop` maps through the source; `overlay` is already in output pixels */
  mode: "crop" | "overlay";
  rect: CropRect;
  /** only needed in `crop` mode, to read the item's placement */
  item?: TrackItem;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  label?: string;
  /** live, on every mouse move — the picture has to follow the drag */
  onChange: (rect: CropRect) => void;
  /** once, on mouseup — the single history step */
  onCommit: () => void;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const dragRef = useRef<{ handle: CropHandle; lastX: number; lastY: number; rect: CropRect } | null>(null);

  useEffect(() => {
    if (!canvasEl) return;
    const measure = () => {
      const parent = canvasEl.offsetParent as HTMLElement | null;
      const r = canvasEl.getBoundingClientRect();
      const parentRect = parent?.getBoundingClientRect();
      setBox({
        left: r.left - (parentRect?.left ?? 0),
        top: r.top - (parentRect?.top ?? 0),
        width: r.width,
        height: r.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvasEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [canvasEl]);

  const placement =
    mode === "crop" && item && (item.kind === "video" || item.kind === "image")
      ? placeFrame(sourceWidth, sourceHeight, outputWidth, outputHeight, {
          // the picture is drawn uncropped while the crop frame is up, so the
          // mapping has to ignore the crop as well
          crop: null,
          scale: resolveVisual(item).scale,
          position: resolveVisual(item).position,
        })
      : null;

  /** output px → screen px, including the canvas's own contain-letterboxing */
  const screen = (() => {
    if (!box || outputWidth <= 0 || outputHeight <= 0) return null;
    const fit = Math.min(box.width / outputWidth, box.height / outputHeight);
    return {
      scale: fit,
      offsetX: box.left + (box.width - outputWidth * fit) / 2,
      offsetY: box.top + (box.height - outputHeight * fit) / 2,
    };
  })();

  const beginDrag = useCallback(
    (handle: CropHandle, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!screen || screen.scale <= 0) return;

      // screen px → the space the rect is stored in
      const outPerUnit = placement && placement.source.width > 0 ? placement.dest.width / placement.source.width : 1;
      const perPixel = 1 / (screen.scale * outPerUnit);
      const boundsW = mode === "crop" ? sourceWidth : outputWidth;
      const boundsH = mode === "crop" ? sourceHeight : outputHeight;

      dragRef.current = { handle, lastX: e.clientX, lastY: e.clientY, rect };

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const next = dragCrop(
          drag.rect,
          drag.handle,
          (ev.clientX - drag.lastX) * perPixel,
          (ev.clientY - drag.lastY) * perPixel,
          boundsW,
          boundsH,
        );
        drag.lastX = ev.clientX;
        drag.lastY = ev.clientY;
        drag.rect = next;
        onChange(next);
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        onCommit();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [screen, placement, rect, mode, sourceWidth, sourceHeight, outputWidth, outputHeight, onChange, onCommit],
  );

  if (!box || !screen || !canvasEl) return null;

  const inOutput = placement ? sourceRectToDest(rect, placement) : rect;
  const frame = {
    left: screen.offsetX + inOutput.left * screen.scale,
    top: screen.offsetY + inOutput.top * screen.scale,
    width: inOutput.width * screen.scale,
    height: inOutput.height * screen.scale,
  };

  return (
    <div
      className={`vied__crop-frame ${mode === "overlay" ? "vied__crop-frame--overlay" : ""}`}
      style={frame}
      onMouseDown={(e) => beginDrag("move", e)}
    >
      <span className="vied__crop-size">{label ?? `${Math.round(rect.width)} × ${Math.round(rect.height)}`}</span>
      {HANDLES.map((handle) => (
        <span key={handle} className={`vied__crop-handle vied__crop-handle--${handle}`} onMouseDown={(e) => beginDrag(handle, e)} />
      ))}
    </div>
  );
}
