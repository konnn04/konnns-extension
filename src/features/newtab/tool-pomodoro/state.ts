import { browser } from "wxt/browser";

/**
 * Pomodoro timer state, shared by the UI and the background service worker.
 * The timer runs on `chrome.alarms` (never setTimeout — MV3 SW can be killed,
 * docs/phase-3 §4 / phase-4 §2), so it stays accurate even with the tab closed.
 * State lives in storage.local so both contexts read/write the same source.
 */

export type Phase = "work" | "short" | "long";

export interface PomodoroConfig {
  workMin: number;
  shortMin: number;
  longMin: number;
  sessionsBeforeLong: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  sessionsBeforeLong: 4,
};

export interface PomodoroState {
  phase: Phase;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
  completedWork: number;
  config: PomodoroConfig;
}

export const ALARM_NAME = "pomodoro";
const KEY = "pomodoro:state";

export function phaseDurationMs(phase: Phase, c: PomodoroConfig): number {
  const min = phase === "work" ? c.workMin : phase === "short" ? c.shortMin : c.longMin;
  return Math.max(1, min) * 60_000;
}

export function nextPhase(current: Phase, completedWork: number, c: PomodoroConfig): Phase {
  if (current !== "work") return "work";
  return (completedWork + 1) % Math.max(1, c.sessionsBeforeLong) === 0 ? "long" : "short";
}

function defaultState(config = DEFAULT_CONFIG): PomodoroState {
  return {
    phase: "work",
    running: false,
    endsAt: null,
    remainingMs: phaseDurationMs("work", config),
    completedWork: 0,
    config,
  };
}

// storage/alarms only exist in a real extension context; guard so the UI never
// hard-crashes if they're missing (e.g. wxt-dev page served over localhost)
function localArea() {
  return browser.storage?.local;
}

export async function getState(): Promise<PomodoroState> {
  const area = localArea();
  if (!area) return defaultState();
  const res = await area.get(KEY);
  return (res[KEY] as PomodoroState) ?? defaultState();
}

export async function setState(s: PomodoroState): Promise<void> {
  await localArea()?.set({ [KEY]: s });
}

async function setAlarm(endsAt: number): Promise<void> {
  await browser.alarms?.create(ALARM_NAME, { when: endsAt });
}
async function clearAlarm(): Promise<void> {
  await browser.alarms?.clear(ALARM_NAME);
}

export async function start(config?: PomodoroConfig): Promise<PomodoroState> {
  const s = await getState();
  if (config) s.config = config;
  if (s.running) return s;
  const ms = s.remainingMs > 0 ? s.remainingMs : phaseDurationMs(s.phase, s.config);
  s.endsAt = Date.now() + ms;
  s.remainingMs = ms;
  s.running = true;
  await setAlarm(s.endsAt);
  await setState(s);
  return s;
}

export async function pause(): Promise<PomodoroState> {
  const s = await getState();
  if (s.running && s.endsAt) s.remainingMs = Math.max(0, s.endsAt - Date.now());
  s.running = false;
  s.endsAt = null;
  await clearAlarm();
  await setState(s);
  return s;
}

export async function reset(config?: PomodoroConfig): Promise<PomodoroState> {
  const s = defaultState(config ?? (await getState()).config);
  await clearAlarm();
  await setState(s);
  return s;
}

export async function skip(): Promise<PomodoroState> {
  const s = await getState();
  if (s.phase === "work") s.completedWork += 1;
  s.phase = nextPhase(s.phase, s.completedWork - (s.phase === "work" ? 1 : 0), s.config);
  s.running = false;
  s.endsAt = null;
  s.remainingMs = phaseDurationMs(s.phase, s.config);
  await clearAlarm();
  await setState(s);
  return s;
}

export async function applyConfig(config: PomodoroConfig): Promise<void> {
  const s = await getState();
  s.config = config;
  if (!s.running) s.remainingMs = phaseDurationMs(s.phase, config);
  await setState(s);
}

/** Called by the background worker when the alarm fires; advances & auto-starts. */
export async function advanceOnFire(): Promise<{ phase: Phase; title: string; body: string }> {
  const s = await getState();
  const finished = s.phase;
  if (finished === "work") s.completedWork += 1;
  const next = nextPhase(finished, s.completedWork - (finished === "work" ? 1 : 0), s.config);

  s.phase = next;
  s.remainingMs = phaseDurationMs(next, s.config);
  s.endsAt = Date.now() + s.remainingMs;
  s.running = true;
  await setAlarm(s.endsAt);
  await setState(s);

  const title = "Pomodoro";
  const body =
    finished === "work"
      ? next === "long"
        ? "Hết giờ làm việc — nghỉ dài!"
        : "Hết giờ làm việc — nghỉ ngắn!"
      : "Hết giờ nghỉ — quay lại làm việc!";
  return { phase: next, title, body };
}
