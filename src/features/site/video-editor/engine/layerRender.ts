import { colorFilterCss, fadeOpacityAt, placeFrame, sourceRectToDest } from "./frameGeometry";
import { resolveVisual, type EffectItem, type TextItem, type VisualItem } from "./model";
import type { Layer } from "./compose";

/**
 * Draws one composed frame — the single pipeline shared by the preview and
 * the exporter (docs/test-001.md §0.2 rule 5, §6.4). If a caption looks
 * right on screen it looks right in the file, because this is the only code
 * that knows how to put either of them there.
 *
 * Text and effect rects are authored in OUTPUT pixels while a picture's crop
 * is in SOURCE pixels. That difference is deliberate: a caption belongs to
 * the finished frame and should not move when the clip beneath it is
 * re-cropped or swapped out, whereas a crop is a statement about one
 * particular file.
 */

/** Anything a picture layer can be drawn from. */
export type LayerImage = CanvasImageSource & { width?: number; height?: number };

export interface LayerPicture {
  image: LayerImage;
  sourceWidth: number;
  sourceHeight: number;
}

/** Fills the whole output with black — every frame starts here so nothing ghosts through. */
export function clearFrame(ctx: CanvasRenderingContext2D, outputWidth: number, outputHeight: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
}

/**
 * Draw one layer over whatever is already on the canvas.
 *
 * `picture` is required for video and image layers and ignored otherwise;
 * the caller owns decoding, because where a frame comes from differs
 * completely between preview (a `<video>` element) and export (a decoded
 * sample).
 */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  outputWidth: number,
  outputHeight: number,
  picture?: LayerPicture,
): void {
  const { item, timeInItem } = layer;

  if (item.kind === "effect") {
    drawEffect(ctx, item, outputWidth, outputHeight);
    return;
  }

  const v = resolveVisual(item);
  const alpha = fadeOpacityAt(timeInItem, item.duration, v.fadeIn, v.fadeOut) * (v.opacity / 100);
  if (alpha <= 0) return;

  if (item.kind === "text") {
    drawText(ctx, item, alpha);
    return;
  }

  if (!picture) return;

  const placement = placeFrame(picture.sourceWidth, picture.sourceHeight, outputWidth, outputHeight, {
    crop: v.crop,
    scale: v.scale,
    position: v.position,
  });
  if (placement.dest.width <= 0 || placement.dest.height <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (v.rotate !== 0) {
    // rotate about the middle of where this layer lands, so it stays centred
    // on its own position rather than swinging around the canvas origin
    const cx = placement.dest.left + placement.dest.width / 2;
    const cy = placement.dest.top + placement.dest.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((v.rotate * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.filter = colorFilterCss(v.color);
  ctx.drawImage(
    picture.image,
    placement.source.left,
    placement.source.top,
    placement.source.width,
    placement.source.height,
    placement.dest.left,
    placement.dest.top,
    placement.dest.width,
    placement.dest.height,
  );
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem, alpha: number): void {
  const { rect } = item;
  if (rect.width <= 0 || rect.height <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = "none";

  if (item.background && item.background !== "transparent") {
    ctx.fillStyle = item.background;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  }

  const fontPx = Math.max(6, item.fontSize);
  ctx.fillStyle = item.color;
  ctx.font = '600 ' + fontPx + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = item.align;

  const padding = fontPx * 0.2;
  const x = item.align === "left" ? rect.left + padding : item.align === "right" ? rect.left + rect.width - padding : rect.left + rect.width / 2;

  const lines = wrapText(ctx, item.text, rect.width - padding * 2);
  const lineHeight = fontPx * 1.2;
  const firstY = rect.top + rect.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  const stroke = item.strokeWidth ?? 0;
  if (stroke > 0) {
    // stroked first, so the outline sits BEHIND the fill and only its outer
    // half shows — a stroke drawn on top would eat into the letterforms and
    // thin the text as the outline grows
    ctx.strokeStyle = item.strokeColor ?? "#000000";
    // the stroke straddles the glyph edge, so double it to get the asked-for
    // width on the outside
    ctx.lineWidth = stroke * 2;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    for (let i = 0; i < lines.length; i++) ctx.strokeText(lines[i], x, firstY + i * lineHeight);
  }

  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, firstY + i * lineHeight);

  ctx.restore();
}

/**
 * A cover-up, drawn over whatever the layers below it already composed.
 *
 * `box` simply fills. `blur` re-draws the CANVAS ONTO ITSELF through a blur
 * filter, clipped to the rect. Going through the canvas rather than through
 * one source layer is what makes it correct in the case it exists for: a
 * password on screen may be covered by a caption or sit where two layers
 * meet, and blurring a single source would miss whatever else was on top.
 * It also means the rect needs no source-space mapping — it is already in
 * the same output pixels the canvas is.
 */
function drawEffect(ctx: CanvasRenderingContext2D, item: EffectItem, outputWidth: number, outputHeight: number): void {
  const { rect } = item;
  if (rect.width <= 0 || rect.height <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (item.opacity ?? 100) / 100));

  if (item.effect === "box") {
    ctx.filter = "none";
    ctx.fillStyle = item.color ?? "#000000";
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.rect(rect.left, rect.top, rect.width, rect.height);
  ctx.clip();
  ctx.filter = `blur(${Math.max(1, item.strength ?? 12)}px)`;
  ctx.drawImage(ctx.canvas, 0, 0, outputWidth, outputHeight);
  ctx.restore();
}

/** Greedy word wrap inside the caption's own box, so long text never runs off the frame. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return [text];

  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + " " + word : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** True for the layer kinds the caller has to decode a picture for before calling {@link drawLayer}. */
export function needsPicture(item: VisualItem): boolean {
  return item.kind === "video" || item.kind === "image";
}

export { sourceRectToDest };
