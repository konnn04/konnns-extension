import { create } from "zustand";
import { db, type MediaAssetRow } from "@/core/storage/db";
import type { Phase } from "./state";

/**
 * Optional user images (static or GIF) shown in the pomodoro ring for each
 * phase. Stored in the generic `mediaAssets` table keyed by `pomo:<phase>`.
 * A version counter lets the timer + settings re-read after any change.
 */

export const MAX_PHASE_IMAGE_BYTES = 8 * 1024 * 1024;

const keyFor = (phase: Phase) => `pomo:${phase}`;

interface PhaseMediaState {
  /** bumped on every change so consumers can refetch object URLs */
  version: number;
  present: Record<Phase, boolean>;
  refresh: () => Promise<void>;
  setImage: (phase: Phase, file: File) => Promise<void>;
  clear: (phase: Phase) => Promise<void>;
}

export const usePhaseMedia = create<PhaseMediaState>((set, get) => ({
  version: 0,
  present: { work: false, short: false, long: false },

  refresh: async () => {
    const ids = (["work", "short", "long"] as Phase[]).map(keyFor);
    const rows = await db.mediaAssets.bulkGet(ids);
    set({
      present: {
        work: !!rows[0],
        short: !!rows[1],
        long: !!rows[2],
      },
    });
  },

  setImage: async (phase, file) => {
    if (file.size > MAX_PHASE_IMAGE_BYTES) throw new Error("image-too-large");
    const isGif = file.type === "image/gif";
    const row: MediaAssetRow = {
      id: keyFor(phase),
      type: isGif ? "gif" : "image",
      blob: file,
      name: file.name,
      updatedAt: Date.now(),
    };
    await db.mediaAssets.put(row);
    set((s) => ({
      version: s.version + 1,
      present: { ...s.present, [phase]: true },
    }));
  },

  clear: async (phase) => {
    await db.mediaAssets.delete(keyFor(phase));
    set((s) => ({
      version: s.version + 1,
      present: { ...s.present, [phase]: false },
    }));
    void get().refresh();
  },
}));

export async function getPhaseImageUrl(phase: Phase): Promise<string | null> {
  const row = await db.mediaAssets.get(keyFor(phase));
  return row ? URL.createObjectURL(row.blob) : null;
}
