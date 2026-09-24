import type { ColorAdjust, CropRect, ResolvedVisual } from "./model";

/**
 * Where a layer's pixels land inside the output frame, and what filters apply
 * — docs/test-001.md §3.2/§3.3/§4.2/§4.3.
 *
 * Pure: takes numbers, returns numbers and a CSS filter string. The canvas
 * work that uses these lives in layerRender.ts, so the geometry that decides
 * whether a crop or a scale is right can be tested under plain Node.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FramePlacement {
  /** the part of the SOURCE frame to read (crop, or the whole thing) */
  source: Rect;
  /** where to draw it in the OUTPUT frame */
  dest: Rect;
}

/**
 * Fit the (possibly cropped) source into the output frame, then apply the
 * layer's scale and position on top.
 *
 * "contain" rather than "cover" as the base: a source of a different aspect
 * ratio gets letterboxed rather than silently losing its edges, and Fill is
 * available as one button for when the opposite is wanted (§3.3).
 */
export function placeFrame(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  effects: Pick<ResolvedVisual, "crop" | "scale" | "position">,
): FramePlacement {
  const source: Rect = effects.crop
    ? { left: effects.crop.left, top: effects.crop.top, width: effects.crop.width, height: effects.crop.height }
    : { left: 0, top: 0, width: sourceWidth, height: sourceHeight };

  if (source.width <= 0 || source.height <= 0 || outputWidth <= 0 || outputHeight <= 0) {
    return { source, dest: { left: 0, top: 0, width: 0, height: 0 } };
  }

  const contain = Math.min(outputWidth / source.width, outputHeight / source.height);
  const scale = contain * (effects.scale / 100);

  const width = source.width * scale;
  const height = source.height * scale;

  return {
    source,
    dest: {
      left: (outputWidth - width) / 2 + effects.position.x,
      top: (outputHeight - height) / 2 + effects.position.y,
      width,
      height,
    },
  };
}

/**
 * The scale percentage that makes the source cover the whole output frame —
 * the Fill button (§3.3). Because `placeFrame` starts from a "contain" fit,
 * this is simply the ratio between the two fits.
 */
export function fillScalePercent(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  crop: CropRect | null,
): number {
  const w = crop?.width || sourceWidth;
  const h = crop?.height || sourceHeight;
  if (w <= 0 || h <= 0 || outputWidth <= 0 || outputHeight <= 0) return 100;

  const contain = Math.min(outputWidth / w, outputHeight / h);
  const cover = Math.max(outputWidth / w, outputHeight / h);
  return Math.round((cover / contain) * 100);
}

/** Linear fade at either edge of an item; 1 in the middle, 0 at the very ends. */
export function fadeOpacityAt(timeInItem: number, duration: number, fadeIn: number, fadeOut: number): number {
  if (duration <= 0) return 1;
  let opacity = 1;
  if (fadeIn > 0 && timeInItem < fadeIn) opacity = Math.min(opacity, Math.max(0, timeInItem / fadeIn));
  if (fadeOut > 0 && timeInItem > duration - fadeOut) {
    opacity = Math.min(opacity, Math.max(0, (duration - timeInItem) / fadeOut));
  }
  return opacity;
}

/**
 * Colour correction as a CSS `filter` string — the same string works on a 2D
 * canvas context and in the preview, so one pipeline covers both.
 *
 * Temperature has no CSS primitive; warming is approximated by leaning on
 * sepia and hue-rotate, which is close enough for the "fix a phone video that
 * came out yellow" job this is for (§4.2) and costs no shader.
 */
export function colorFilterCss(color: ColorAdjust | null): string {
  if (!color) return "none";
  const parts: string[] = [];

  if (color.brightness !== 0) parts.push(`brightness(${1 + color.brightness / 100})`);
  if (color.contrast !== 0) parts.push(`contrast(${1 + color.contrast / 100})`);
  if (color.saturation !== 0) parts.push(`saturate(${1 + color.saturation / 100})`);
  if (color.temperature !== 0) {
    const amount = Math.abs(color.temperature) / 100;
    parts.push(`sepia(${amount * 0.6})`);
    // negative = cooler, so rotate the sepia's warmth towards blue
    parts.push(`hue-rotate(${color.temperature < 0 ? -30 * amount : 10 * amount}deg)`);
  }

  return parts.length > 0 ? parts.join(" ") : "none";
}

/**
 * Map a rect from SOURCE pixel space into OUTPUT pixel space, following the
 * same crop/scale/position the frame itself went through — this is what keeps
 * a crop box stuck to the picture it belongs to.
 */
export function sourceRectToDest(rect: Rect, placement: FramePlacement): Rect {
  const scaleX = placement.source.width > 0 ? placement.dest.width / placement.source.width : 0;
  const scaleY = placement.source.height > 0 ? placement.dest.height / placement.source.height : 0;
  return {
    left: placement.dest.left + (rect.left - placement.source.left) * scaleX,
    top: placement.dest.top + (rect.top - placement.source.top) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}
