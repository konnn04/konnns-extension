/**
 * Shared vocabulary for the audio core — docs/site/01-audio-editor.md §2.
 * Everything here is plain data so ops can be serialized into an undo history.
 */

/** 16/24-bit integer PCM, or 32-bit float. */
export type BitDepth = 16 | 24 | 32;

export type ChannelMode = "as-is" | "mono" | "stereo";

/** How long a fade runs when the user has not selected a range. */
export const DEFAULT_FADE_SECONDS = 3;

export type FadeCurve = "linear" | "exponential" | "logarithmic" | "s-curve";

export interface TimeRange {
  /** seconds from the start of the buffer */
  start: number;
  end: number;
}

export interface EnhanceParams {
  /** cut rumble and handling noise below this frequency */
  highpass: boolean;
  highpassHz: number;
  /** squelch anything quieter than the threshold */
  gate: boolean;
  gateThresholdDb: number;
  compressor: boolean;
  compThresholdDb: number;
  compRatio: number;
  /** lift around 3 kHz, where speech intelligibility lives */
  presence: boolean;
  presenceDb: number;
  normalize: boolean;
  normalizeDb: number;
}

export const VOICE_ENHANCE: EnhanceParams = {
  highpass: true,
  highpassHz: 80,
  gate: true,
  gateThresholdDb: -45,
  compressor: true,
  compThresholdDb: -22,
  compRatio: 4,
  presence: true,
  presenceDb: 3,
  normalize: true,
  normalizeDb: -1,
};

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 1e-6));
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
