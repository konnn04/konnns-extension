import type { CropRect } from "./model";

/**
 * Crop geometry — docs/test-001.md §4.1.
 *
 * The old crop was four number fields and nothing else, which is how the
 * screenshot ended up with a "crop" of 3840×2160 on a 3840×2160 source (i.e.
 * no crop at all). These are the pure pieces the draggable frame needs:
 * clamping, and snapping to an aspect ratio. No DOM, so testable under Node.
 */

export interface AspectPreset {
  id: string;
  /** width / height, or null for "whatever the source is" */
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "source", ratio: null },
  { id: "16:9", ratio: 16 / 9 },
  { id: "9:16", ratio: 9 / 16 },
  { id: "1:1", ratio: 1 },
  { id: "4:3", ratio: 4 / 3 },
];

const MIN_SIZE = 16;

/** Keep a rect inside the source frame, never smaller than MIN_SIZE, always whole pixels. */
export function clampCrop(rect: CropRect, sourceWidth: number, sourceHeight: number): CropRect {
  const width = Math.round(Math.max(MIN_SIZE, Math.min(rect.width, sourceWidth)));
  const height = Math.round(Math.max(MIN_SIZE, Math.min(rect.height, sourceHeight)));
  const left = Math.round(Math.max(0, Math.min(rect.left, sourceWidth - width)));
  const top = Math.round(Math.max(0, Math.min(rect.top, sourceHeight - height)));
  return { left, top, width, height };
}

/**
 * Resize a rect to a target aspect ratio, keeping its centre where it is and
 * growing to the largest size that still fits inside the source.
 *
 * `null` means "back to the full source frame" — that is what the Gốc/source
 * preset does, and it doubles as the reset.
 */
export function applyAspect(
  rect: CropRect,
  ratio: number | null,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  if (ratio === null) return { left: 0, top: 0, width: sourceWidth, height: sourceHeight };

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // start from the largest box of this ratio that fits the source, then
  // shrink to no bigger than the rect the user already had
  let width = Math.min(sourceWidth, sourceHeight * ratio);
  let height = width / ratio;
  const currentArea = Math.max(rect.width, rect.height);
  if (width > currentArea && height > currentArea) {
    width = Math.min(width, Math.max(MIN_SIZE, currentArea * (ratio >= 1 ? 1 : ratio)));
    height = width / ratio;
  }

  return clampCrop({ left: centerX - width / 2, top: centerY - height / 2, width, height }, sourceWidth, sourceHeight);
}

export type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

/**
 * Apply a drag of (dx, dy) source-pixels to one handle. The opposite edge
 * stays put for edge/corner handles — which is what makes a crop frame feel
 * right — while "move" slides the whole rect.
 */
export function dragCrop(
  rect: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  if (handle === "move") {
    return clampCrop({ ...rect, left: rect.left + dx, top: rect.top + dy }, sourceWidth, sourceHeight);
  }

  let { left, top, width, height } = rect;

  if (handle.includes("w")) {
    const next = Math.min(left + dx, left + width - MIN_SIZE);
    width += left - next;
    left = next;
  }
  if (handle.includes("e")) width += dx;
  if (handle.includes("n")) {
    const next = Math.min(top + dy, top + height - MIN_SIZE);
    height += top - next;
    top = next;
  }
  if (handle.includes("s")) height += dy;

  return clampCrop({ left, top, width, height }, sourceWidth, sourceHeight);
}

/** True when the rect covers the whole source — i.e. cropping is effectively off. */
export function isFullFrame(rect: CropRect | undefined, sourceWidth: number, sourceHeight: number): boolean {
  if (!rect) return true;
  return rect.left === 0 && rect.top === 0 && rect.width >= sourceWidth && rect.height >= sourceHeight;
}
