import { browser } from "wxt/browser";
import { CORE_FEATURE_ID, useSettingsStore } from "@/core/settings-engine/settingsStore";

/**
 * Sound engine (docs item 18). Plays bundled 8-bit mockup sounds
 * (src/public/sounds/*.wav — replace with your own, keep filenames). Volume and
 * on/off come from the General → Sound settings.
 */

export type SoundName = "click" | "notify" | "pomodoro";

const cache = new Map<SoundName, HTMLAudioElement>();

function soundUrl(name: SoundName): string {
  try {
    return browser.runtime.getURL(`sounds/${name}.wav` as never);
  } catch {
    return `/sounds/${name}.wav`;
  }
}

function prefs(): Record<string, unknown> {
  return useSettingsStore.getState().values[CORE_FEATURE_ID] ?? {};
}

export function soundEnabled(): boolean {
  return prefs().soundEnabled !== false;
}

export function playSound(name: SoundName): void {
  const p = prefs();
  if (p.soundEnabled === false) return;
  if (name === "click" && p.clickSound !== true) return;
  const vol = (typeof p.soundVolume === "number" ? p.soundVolume : 60) / 100;
  try {
    let audio = cache.get(name);
    if (!audio) {
      audio = new Audio(soundUrl(name));
      cache.set(name, audio);
    }
    audio.volume = Math.max(0, Math.min(1, vol));
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    /* audio unavailable */
  }
}

/** Global UI click sound — attach once from the app root. */
export function installClickSound(): () => void {
  const handler = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, [role='button'], .ui-btn")) playSound("click");
  };
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
