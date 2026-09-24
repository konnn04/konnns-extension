import { yieldToUI } from "./activity";
import { pitchShift, pitchShiftAsync } from "./dsp";
import type { Clip, Track } from "./project";

/**
 * Pitch-shifted copies of a source, cached by semitones and cents.
 *
 * Analogous to stretchCache, we cache by (sourceId, semitones, cents) rather than
 * per clip window. Trimming, splitting, and moving clips are completely free because
 * each clip reads from the same pitch-shifted buffer.
 */

const MAX_ENTRIES = 4;
const cache = new Map<string, AudioBuffer>();

function key(sourceId: string, semitones: number, cents: number): string {
  return `${sourceId}@p${semitones}@${cents}`;
}

export function pitchedSource(
  sourceId: string,
  source: AudioBuffer,
  semitones: number,
  cents: number = 0,
): AudioBuffer {
  if (semitones === 0 && cents === 0) return source;
  const id = key(sourceId, semitones, cents);
  const hit = cache.get(id);
  if (hit) return hit;

  const pitched = pitchShift(source, semitones, cents);
  store(id, pitched);
  return pitched;
}

function store(id: string, buffer: AudioBuffer): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(id, buffer);
}

export async function ensurePitch(
  sourceId: string,
  source: AudioBuffer,
  semitones: number,
  cents: number = 0,
  onProgress?: (value: number) => void,
): Promise<AudioBuffer> {
  if (semitones === 0 && cents === 0) return source;
  const id = key(sourceId, semitones, cents);
  const hit = cache.get(id);
  if (hit) return hit;

  const pitched = await pitchShiftAsync(source, semitones, cents, {
    onProgress,
    yieldBetween: yieldToUI,
  });
  store(id, pitched);
  return pitched;
}

export function hasPitch(sourceId: string, semitones: number, cents: number = 0): boolean {
  if (semitones === 0 && cents === 0) return true;
  return cache.has(key(sourceId, semitones, cents));
}

export function clearPitchCache(): void {
  cache.clear();
}

/**
 * Extract enabled pitch-shift parameters from a clip.
 */
export function clipPitchShift(clip: Clip): { semitones: number; cents: number } {
  const instance = clip.effects?.find((e) => e.enabled && e.effectId === "pitch-shift");
  if (!instance) return { semitones: 0, cents: 0 };
  return {
    semitones: Math.round(instance.params.semitones ?? 0),
    cents: Math.round(instance.params.cents ?? 0),
  };
}

/**
 * Extract enabled pitch-shift parameters from a track.
 */
export function trackPitchShift(track: Track): { semitones: number; cents: number } {
  const instance = track.effects?.find((e) => e.enabled && e.effectId === "pitch-shift");
  if (!instance) return { semitones: 0, cents: 0 };
  return {
    semitones: Math.round(instance.params.semitones ?? 0),
    cents: Math.round(instance.params.cents ?? 0),
  };
}

/**
 * Combine clip and track pitch shifts into total net semitones and cents.
 */
export function effectiveClipPitch(clip: Clip, track?: Track): { semitones: number; cents: number } {
  const c = clipPitchShift(clip);
  const t = track ? trackPitchShift(track) : { semitones: 0, cents: 0 };
  return {
    semitones: c.semitones + t.semitones,
    cents: c.cents + t.cents,
  };
}
