/**
 * Redaction pixel math — docs/roadmap/07-image-editor.md §2 (the "làm mờ/che"
 * tool added beyond the original brief, for bug screenshots that carry tokens
 * or email addresses).
 *
 * Pixelation rather than a Gaussian blur on purpose: averaging each block to
 * a single flat colour is genuinely irreversible (the original values are
 * gone, not smeared), it reads unmistakably as "this was redacted" to whoever
 * opens the file, and it is simple enough to be obviously correct. A blur, by
 * contrast, can sometimes be partially inverted, and a weak blur *looks*
 * redacted while still leaking the text shape.
 *
 * Operates on a raw RGBA byte array rather than an `ImageData` so it stays
 * testable under plain Node — same reasoning as engine/assets.ts.
 */
export function pixelateRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number,
  // the non-shared buffer form is what `new ImageData(...)` accepts; a plain
  // `Uint8ClampedArray` widens to `ArrayBufferLike` and is rejected there
): Uint8ClampedArray<ArrayBuffer> {
  const block = Math.max(2, Math.floor(blockSize));
  const out = new Uint8ClampedArray(data.length);

  for (let blockY = 0; blockY < height; blockY += block) {
    const yEnd = Math.min(blockY + block, height);
    for (let blockX = 0; blockX < width; blockX += block) {
      const xEnd = Math.min(blockX + block, width);

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let y = blockY; y < yEnd; y++) {
        for (let x = blockX; x < xEnd; x++) {
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }
      if (count === 0) continue;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);

      for (let y = blockY; y < yEnd; y++) {
        for (let x = blockX; x < xEnd; x++) {
          const i = (y * width + x) * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = a;
        }
      }
    }
  }

  return out;
}

/** Block size scaled to the region — a fixed pixel size leaves a large redaction readable and makes a tiny one a single flat square. */
export function blockSizeFor(width: number, height: number): number {
  return Math.max(6, Math.round(Math.min(width, height) / 12));
}
