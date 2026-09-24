/**
 * Export presets and the file-size estimate shown beside each one —
 * docs/test-001.md §7.2/§7.4: "hiển thị ngay dung lượng file ước tính cạnh
 * mỗi lựa chọn ... người dùng nhìn số mà quyết định, không cần hiểu khái
 * niệm bitrate/CRF".
 *
 * Pure on purpose: no DOM, no mediabunny, so the numbers can be checked
 * under Node instead of by exporting a file and looking at it.
 */

export type ResolutionId = "source" | "1080p" | "720p" | "480p" | "custom";
export type QualityId = "source" | "high" | "small";

export interface ResolutionPreset {
  id: ResolutionId;
  label: string;
  /** target height; undefined = derive from the project (source / custom) */
  height?: number;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: "source", label: "Source" },
  { id: "1080p", label: "1080p", height: 1080 },
  { id: "720p", label: "720p", height: 720 },
  { id: "480p", label: "480p", height: 480 },
  { id: "custom", label: "Custom" },
];

export const FRAME_RATE_PRESETS = [0, 24, 30, 60] as const;

/**
 * Bits per pixel per frame. These are the usual working numbers for H.264 at
 * each visual tier — an estimate, not a promise: the encoder spends fewer
 * bits on a static screen recording and more on motion, so treat the result
 * as an order of magnitude to choose by.
 */
const BITS_PER_PIXEL: Record<QualityId, number> = {
  source: 0.18,
  high: 0.1,
  small: 0.045,
};

const AUDIO_BITS_PER_SECOND = 128_000;

/** Never upscale on a preset: a 720p source asked for "1080p" stays 720p. */
export function resolveOutputSize(
  id: ResolutionId,
  projectWidth: number,
  projectHeight: number,
  custom: { width: number; height: number },
): { width: number; height: number } {
  const sourceW = projectWidth || 1920;
  const sourceH = projectHeight || 1080;

  if (id === "custom") return { width: even(custom.width), height: even(custom.height) };

  const preset = RESOLUTION_PRESETS.find((p) => p.id === id);
  if (!preset?.height || preset.height >= sourceH) return { width: even(sourceW), height: even(sourceH) };

  const scale = preset.height / sourceH;
  return { width: even(sourceW * scale), height: even(preset.height) };
}

/** Encoders reject odd dimensions on most H.264 profiles. */
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

export function estimateBytes(
  width: number,
  height: number,
  frameRate: number,
  durationSeconds: number,
  quality: QualityId,
): number {
  if (durationSeconds <= 0) return 0;
  const videoBps = width * height * frameRate * BITS_PER_PIXEL[quality];
  return Math.round(((videoBps + AUDIO_BITS_PER_SECOND) * durationSeconds) / 8);
}

export { formatBytes } from "@/shared/utils/format";

