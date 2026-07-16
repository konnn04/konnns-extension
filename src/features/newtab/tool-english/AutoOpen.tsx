import { useEffect, useRef } from "react";
import { useWindowManager } from "@/core/layout-engine/windowManager";
import {
  useFeatureEnabled,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { learningDayKey } from "./api";
import { ENGLISH_FEATURE_ID } from "./constants";

/**
 * Always-mounted helper (renders nothing). On the first new tab of each new
 * learning day it pops the "English every day" window open — if the feature is
 * enabled and the user kept the "show first open" option on.
 */
export function EnglishDailyAutoOpen() {
  const enabled = useFeatureEnabled(ENGLISH_FEATURE_ID);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const setValue = useSettingsStore((s) => s.setValue);
  const values = useFeatureValues(ENGLISH_FEATURE_ID);
  const { hydrated, openWindow } = useWindowManager();
  const doneRef = useRef(false);

  const showFirstOpen = values.showFirstOpen !== false;
  const resetHour = (values.resetHour as number) ?? 3;
  const lastShownDay = values.lastShownDay as string | undefined;

  useEffect(() => {
    if (doneRef.current || !settingsHydrated || !hydrated) return;
    if (!enabled || !showFirstOpen) return;
    const today = learningDayKey(resetHour);
    if (lastShownDay === today) {
      doneRef.current = true;
      return;
    }
    doneRef.current = true;
    setValue(ENGLISH_FEATURE_ID, "lastShownDay", today);
    openWindow(ENGLISH_FEATURE_ID);
  }, [
    settingsHydrated,
    hydrated,
    enabled,
    showFirstOpen,
    resetHour,
    lastShownDay,
    openWindow,
    setValue,
  ]);

  return null;
}
