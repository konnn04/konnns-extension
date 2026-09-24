import { buildChain, getEffect } from "./effects";
import type { EffectInstance } from "./effects/Effect";
import { peaksForWindow } from "./peaks";
import type { Clip } from "./project";

/**
 * Waveform peaks for a clip window AFTER its effect chain —
 * docs/site/01-audio-editor.md §3.
 *
 * Clip gain and fades are arithmetic the drawer can do itself, so those are
 * multiplied straight onto the source peaks. A filter is not: there is no way
 * to know what a Bass shelf does to a waveform without running the audio
 * through it. So the VISIBLE window is rendered offline and its peaks cached.
 *
 * The drawer asks synchronously. On a miss it gets null, draws the unprocessed
 * peaks, and is told to repaint once the processed ones land — a waveform that
 * is briefly un-filtered beats a timeline that stutters on every slider move.
 */

/** Lead-in fed to the filters so the first pixels are not a startup transient. */
const PREROLL_SECONDS = 0.25;

/**
 * Past this, an offline render costs more than the picture is worth; the
 * drawer keeps the raw peaks. You only see a window this long when zoomed far
 * enough out that a filter's effect on the shape is invisible anyway.
 */
const MAX_WINDOW_SECONDS = 600;

/** How long to wait for a slider to settle before rendering. */
const DEBOUNCE_MS = 180;

/** Plenty for a few clips at a few zoom levels; keeps memory bounded. */
const MAX_ENTRIES = 48;

type Peaks = Float32Array[];

const cache = new Map<string, Peaks>();
/** Keys that threw once; retrying them every frame would be a busy loop. */
const failed = new Set<string>();
const listeners = new Set<() => void>();

let pendingKey: string | null = null;
let pendingRun: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Does this clip have anything that actually reshapes the waveform? */
export function hasAudibleChain(clip: Clip): boolean {
  return (clip.effects ?? []).some((instance) => {
    if (!instance.enabled) return false;
    return getEffect(instance.effectId)?.isLive ?? false;
  });
}

/** Identity of a chain, so a parameter change misses the cache. */
function chainKey(effects: EffectInstance[]): string {
  return effects
    .filter((e) => e.enabled)
    .map((e) => {
      const params = Object.keys(e.params)
        .sort()
        .map((k) => `${k}=${e.params[k]}`)
        .join(",");
      return `${e.effectId}(${params})`;
    })
    .join(">");
}

function keyFor(clip: Clip, from: number, to: number, buckets: number): string {
  return [
    clip.sourceId,
    chainKey(clip.effects ?? []),
    from.toFixed(3),
    to.toFixed(3),
    buckets,
  ].join("|");
}

/**
 * Processed peaks if they are ready, else null.
 *
 * Never throws and never blocks: a miss quietly schedules the render.
 */
export function clipEffectPeaks(
  source: AudioBuffer,
  clip: Clip,
  from: number,
  to: number,
  buckets: number,
): Peaks | null {
  if (!hasAudibleChain(clip)) return null;
  if (!(to > from) || to - from > MAX_WINDOW_SECONDS) return null;

  const key = keyFor(clip, from, to, buckets);
  const hit = cache.get(key);
  if (hit) return hit;
  if (failed.has(key)) return null;

  schedule(key, source, clip, from, to, buckets);
  return null;
}

function schedule(
  key: string,
  source: AudioBuffer,
  clip: Clip,
  from: number,
  to: number,
  buckets: number,
): void {
  // Dragging a slider rewrites the key on every pointer move. Only the last
  // one is worth rendering, so a newer request replaces the waiting one.
  if (pendingKey === key) return;
  pendingKey = key;
  pendingRun = () => void run(key, source, clip, from, to, buckets);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const go = pendingRun;
    pendingKey = null;
    pendingRun = null;
    go?.();
  }, DEBOUNCE_MS);
}

async function run(
  key: string,
  source: AudioBuffer,
  clip: Clip,
  from: number,
  to: number,
  buckets: number,
): Promise<void> {
  if (cache.has(key)) return;
  try {
    const rendered = await renderWindow(source, clip.effects ?? [], from, to);
    // the lead-in is context for the filters, not something to draw
    const pre = Math.min(PREROLL_SECONDS, from);
    const peaks = peaksForWindow(rendered, pre, rendered.duration, buckets);

    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, peaks);
    for (const listener of listeners) listener();
  } catch {
    // An unsupported context or an over-long render: fall back to raw peaks
    // for good, rather than retrying on every repaint.
    failed.add(key);
  }
}

async function renderWindow(
  source: AudioBuffer,
  effects: EffectInstance[],
  from: number,
  to: number,
): Promise<AudioBuffer> {
  const rate = source.sampleRate;
  const pre = Math.min(PREROLL_SECONDS, from);
  const startAt = from - pre;
  const seconds = to - startAt;
  const ctx = new OfflineAudioContext(
    source.numberOfChannels,
    Math.max(1, Math.ceil(seconds * rate)),
    rate,
  );

  const node = ctx.createBufferSource();
  node.buffer = source;

  /**
   * The chain only — clip gain and fades are left to the drawer, which
   * multiplies them on afterwards. For the filters here that is exact, since
   * a gain commutes with them; for a compressor it is a close approximation,
   * and a display is what it is for.
   */
  const chain = buildChain(ctx, effects);
  if (chain) {
    node.connect(chain.input);
    chain.output.connect(ctx.destination);
  } else {
    node.connect(ctx.destination);
  }

  node.start(0, startAt, seconds);
  return ctx.startRendering();
}

/** Repaint hook: fires when a processed window becomes available. */
export function onEffectPeaks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam. */
export function resetEffectPeaks(): void {
  cache.clear();
  failed.clear();
  clearTimeout(timer);
  pendingKey = null;
  pendingRun = null;
}
