/**
 * What the editor is busy doing, as one channel the whole tool reports into.
 *
 * The problem this solves is specific. Most of the heavy work here — decoding,
 * time-stretching, rendering an effect, encoding a WAV — is SYNCHRONOUS. Set a
 * "busy" flag and start the loop in the same turn and the browser never gets a
 * chance to paint, so the message appears only once the work has finished,
 * which is precisely when it is useless. The page just freezes and the user is
 * left guessing.
 *
 * `report()` fixes that by yielding a real painted frame between announcing
 * the work and starting it. Everything expensive goes through it.
 *
 * Deliberately plain — no React, no store — because `engine/` is imported by
 * code that runs under Node in tests, and because the store is not allowed to
 * be a dependency of the DSP layer.
 */

export interface Activity {
  id: number;
  labelKey: string;
  /** 0..1 when the work can count itself, null when it simply takes a while */
  value: number | null;
  /** performance.now() when it started, so the UI can show it ticking */
  startedAt: number;
  cancel?: () => void;
}

type Listener = () => void;

const running = new Map<number, Activity>();
const listeners = new Set<Listener>();
let nextId = 1;

/**
 * Cached so `getSnapshot` returns the SAME object until something really
 * changes. useSyncExternalStore compares snapshots by identity and would loop
 * forever on a fresh object every call — the trap this codebase has hit before.
 */
let snapshot: Activity | null = null;

function refresh(): void {
  // the most recently started wins: it is the one the user just triggered
  let latest: Activity | null = null;
  for (const activity of running.values()) {
    if (!latest || activity.id > latest.id) latest = activity;
  }
  if (snapshot === latest) return;
  snapshot = latest;
  for (const listener of listeners) listener();
}

export function begin(
  labelKey: string,
  options: { value?: number | null; cancel?: () => void } = {},
): number {
  const id = nextId++;
  running.set(id, {
    id,
    labelKey,
    value: options.value ?? null,
    startedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    cancel: options.cancel,
  });
  refresh();
  return id;
}

export function update(id: number, patch: Partial<Pick<Activity, "value" | "labelKey">>): void {
  const current = running.get(id);
  if (!current) return;
  running.set(id, { ...current, ...patch });
  // force a new snapshot identity so subscribers see the change
  snapshot = null;
  refresh();
}

export function end(id: number): void {
  if (running.delete(id)) refresh();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Activity | null {
  return snapshot;
}

/**
 * Let the browser actually paint.
 *
 * rAF lands just BEFORE a paint, so a task queued from inside it is the
 * earliest point at which the frame is on screen — `setTimeout` from within
 * rAF is the reliable way to wait for that.
 */
function nextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/**
 * Hand the main thread back so the banner can repaint.
 *
 * Long work has to call this BETWEEN chunks, not just before starting. A
 * counter that never updates because the thread is blocked looks identical to
 * one that is broken, which is exactly the complaint this answers.
 */
export function yieldToUI(): Promise<void> {
  return nextPaint();
}

/**
 * Announce a piece of work, give the UI a frame to say so, then do it.
 *
 * The callback receives a `progress` function; call it with 0..1 if the work
 * can count itself, and the banner turns into a real bar instead of a stripe.
 */
export async function report<T>(
  labelKey: string,
  work: (progress: (value: number | null) => void) => T | Promise<T>,
  options: { cancel?: () => void } = {},
): Promise<T> {
  const id = begin(labelKey, options);
  await nextPaint();
  try {
    return await work((value) => update(id, { value }));
  } finally {
    end(id);
  }
}

/** Test seam. */
export function resetActivity(): void {
  running.clear();
  snapshot = null;
  nextId = 1;
}
