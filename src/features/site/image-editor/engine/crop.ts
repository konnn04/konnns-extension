export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Smallest crop worth applying — below this a drag was almost certainly a stray click. */
const MIN_CROP_SIZE = 8;

/**
 * Turn two drag corners into a clamped, positive-sized rect —
 * docs/roadmap/07-image-editor.md §5. Dragging up/left produces a negative
 * width/height, and dragging past the edge produces coordinates outside the
 * canvas; both are normalized here rather than in the component, so the
 * fiddly part is testable under plain Node.
 */
export function normalizeCropRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  canvasWidth: number,
  canvasHeight: number,
): CropRect | null {
  const left = Math.max(0, Math.min(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const right = Math.min(canvasWidth, Math.max(x1, x2));
  const bottom = Math.min(canvasHeight, Math.max(y1, y2));

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) return null;

  return { left: Math.round(left), top: Math.round(top), width, height };
}

/**
 * Where an object ends up after the canvas is cropped to `rect`. Every object
 * moves by the crop origin — forgetting this step is exactly the bug the
 * roadmap flags: the canvas resizes but every annotation "floats" away from
 * whatever it was pointing at.
 */
export function shiftForCrop(position: { left: number; top: number }, rect: CropRect): { left: number; top: number } {
  return { left: position.left - rect.left, top: position.top - rect.top };
}
