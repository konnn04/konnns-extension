/** Longest edge of a stored project thumbnail. */
const MAX_DIM = 320;

/**
 * A small JPEG of whatever the preview canvas is currently showing, for the
 * project list.
 *
 * Downscaled through a second canvas rather than stored at full frame size:
 * these live in IndexedDB next to the project row, and a 1920×1080 PNG per
 * project would dwarf the project itself.
 *
 * Returns "" rather than throwing — a card without a picture is a cosmetic
 * loss, and is not worth failing a save over.
 */
export function captureCanvasThumbnail(source: HTMLCanvasElement): string {
  try {
    if (source.width <= 0 || source.height <= 0) return "";

    const scale = Math.min(1, MAX_DIM / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.drawImage(source, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    // a tainted or zero-sized canvas simply leaves the card blank
    return "";
  }
}
