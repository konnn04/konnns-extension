import { yieldToUI } from "./activity";
import { timeStretch, timeStretchAsync } from "./dsp";

/**
 * Pitch-preserved copies of a source, cached by playback rate.
 *
 * Why the WHOLE source rather than each clip's window: a clip's window moves
 * every time you trim it, so keying on the window would throw the work away on
 * every edit. Stretching the source once per rate means trimming, splitting and
 * moving are all free, because a clip simply reads a different part of the same
 * stretched buffer.
 *
 * A stretched copy is as big as the original divided by the rate, so the cache
 * is deliberately tiny — a couple of entries, oldest evicted. Holding six of
 * these for a long song would cost hundreds of megabytes for no benefit.
 */

const MAX_ENTRIES = 3;
const cache = new Map<string, AudioBuffer>();

function key(sourceId: string, rate: number): string {
  return `${sourceId}@${rate.toFixed(4)}`;
}

/**
 * The stretched buffer, computing it synchronously if it is not cached.
 *
 * This is the LAST RESORT, not the normal route. `scheduleProject` is sync, so
 * it cannot await anything — and a cache miss here means WSOLA runs inside the
 * schedule, freezing whatever triggered it. Every interactive path therefore
 * calls `ensureStretch` first, behind the progress banner: pressing play, and
 * any edit that forces the running graph to be rebuilt.
 *
 * What is left reaching this is export, which already runs under a banner and
 * where a correct result matters more than a smooth frame.
 */
export function stretchedSource(
  sourceId: string,
  source: AudioBuffer,
  rate: number,
): AudioBuffer {
  if (!(rate > 0) || Math.abs(rate - 1) < 1e-6) return source;
  const id = key(sourceId, rate);
  const hit = cache.get(id);
  if (hit) return hit;

  const stretched = timeStretch(source, rate);
  store(id, stretched);
  return stretched;
}

function store(id: string, buffer: AudioBuffer): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(id, buffer);
}

/**
 * Where a clip reads inside the stretched buffer.
 *
 * Stretching maps source second `t` to `t / rate`, so a window that began at
 * `offset` now begins at `offset / rate` — and its length is exactly the
 * clip's timeline duration, which is the whole point: the stretched audio
 * plays back at rate 1.
 */
export function stretchedOffset(offset: number, rate: number): number {
  return rate > 0 ? offset / rate : offset;
}

/**
 * Build it without freezing the page.
 *
 * The synchronous version runs a whole song's worth of arithmetic in one turn,
 * which is exactly the freeze the progress banner was supposed to explain —
 * and could not, because the thread never came back to draw it. This one hands
 * the thread over every few frames and reports how far along it is.
 */
export async function ensureStretch(
  sourceId: string,
  source: AudioBuffer,
  rate: number,
  onProgress?: (value: number) => void,
): Promise<AudioBuffer> {
  if (!(rate > 0) || Math.abs(rate - 1) < 1e-6) return source;
  const id = key(sourceId, rate);
  const hit = cache.get(id);
  if (hit) return hit;

  const stretched = await timeStretchAsync(source, rate, {
    onProgress,
    yieldBetween: yieldToUI,
  });
  store(id, stretched);
  return stretched;
}

/** Is this one already built? Lets callers warm the cache deliberately. */
export function hasStretch(sourceId: string, rate: number): boolean {
  if (!(rate > 0) || Math.abs(rate - 1) < 1e-6) return true;
  return cache.has(key(sourceId, rate));
}

/** Test seam, and a way to reclaim the memory when a project closes. */
export function clearStretchCache(): void {
  cache.clear();
}
