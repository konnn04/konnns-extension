/**
 * Image processing before storing — docs/phase-1-mvp/01 §3:
 * resize to the actual screen resolution (≤1080p screens cap at 1080p,
 * larger screens keep up to original size), via createImageBitmap + OffscreenCanvas.
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export async function processImage(
  blob: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dpr = window.devicePixelRatio || 1;
  const screenW = window.screen.width * dpr;
  const screenH = window.screen.height * dpr;

  // ≤1080p screen → cap at 1080p; larger screens → cap at screen size (never upscale)
  const capW = screenH <= 1080 ? 1920 : screenW;
  const capH = screenH <= 1080 ? 1080 : screenH;
  const scale = Math.min(1, capW / bitmap.width, capH / bitmap.height);

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if (scale === 1 && blob.size < 3 * 1024 * 1024) {
    bitmap.close();
    return { blob, width, height };
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const out = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
  return { blob: out, width, height };
}

export async function fetchImageFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("not an image");
  return blob;
}
