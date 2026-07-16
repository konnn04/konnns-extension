import { create } from "zustand";
import { db, type WallpaperRow } from "@/core/storage/db";
import { emit } from "@/core/event-bus";
import { fetchImageFromUrl, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, processImage } from "./image";

export interface WallpaperMeta {
  id: string;
  type: "image" | "video";
  name: string;
  size: number;
  createdAt: number;
  lastUsedAt: number;
}

interface WallpaperState {
  loaded: boolean;
  items: WallpaperMeta[];
  load: () => Promise<void>;
  addImageFile: (file: File) => Promise<string>;
  addVideoFile: (file: File) => Promise<string>;
  addFromUrl: (url: string) => Promise<string>;
  remove: (id: string) => Promise<void>;
  touch: (id: string) => Promise<void>;
  /** delete wallpapers not used in the last 30 days (quick cleanup) */
  cleanup: (keepIds: string[]) => Promise<number>;
}

function toMeta(row: WallpaperRow): WallpaperMeta {
  const { blob: _blob, ...meta } = row;
  return meta;
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  loaded: false,
  items: [],

  load: async () => {
    const rows = await db.wallpapers.orderBy("createdAt").reverse().toArray();
    set({ items: rows.map(toMeta), loaded: true });
  },

  addImageFile: async (file) => {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("image-too-large");
    const processed = await processImage(file);
    const row: WallpaperRow = {
      id: crypto.randomUUID(),
      type: "image",
      blob: processed.blob,
      name: file.name,
      size: processed.blob.size,
      width: processed.width,
      height: processed.height,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    await db.wallpapers.add(row);
    set({ items: [toMeta(row), ...get().items] });
    return row.id;
  },

  addVideoFile: async (file) => {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("video-too-large");
    // videos are stored as-is (docs/phase-1-mvp/01 §3 — no video processing)
    const row: WallpaperRow = {
      id: crypto.randomUUID(),
      type: "video",
      blob: file,
      name: file.name,
      size: file.size,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    await db.wallpapers.add(row);
    set({ items: [toMeta(row), ...get().items] });
    return row.id;
  },

  addFromUrl: async (url) => {
    const blob = await fetchImageFromUrl(url);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("image-too-large");
    const processed = await processImage(blob);
    const row: WallpaperRow = {
      id: crypto.randomUUID(),
      type: "image",
      blob: processed.blob,
      name: url.split("/").pop() ?? "url-image",
      size: processed.blob.size,
      width: processed.width,
      height: processed.height,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    await db.wallpapers.add(row);
    set({ items: [toMeta(row), ...get().items] });
    return row.id;
  },

  remove: async (id) => {
    await db.wallpapers.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
    emit("wallpaper:changed", { id: null });
  },

  touch: async (id) => {
    await db.wallpapers.update(id, { lastUsedAt: Date.now() });
  },

  cleanup: async (keepIds) => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const stale = get().items.filter((i) => i.lastUsedAt < cutoff && !keepIds.includes(i.id));
    await db.wallpapers.bulkDelete(stale.map((i) => i.id));
    set({ items: get().items.filter((i) => !stale.some((s) => s.id === i.id)) });
    return stale.length;
  },
}));

/** Load a wallpaper blob as an object URL (caller revokes). */
export async function getWallpaperUrl(id: string): Promise<{ url: string; type: "image" | "video" } | null> {
  const row = await db.wallpapers.get(id);
  if (!row) return null;
  return { url: URL.createObjectURL(row.blob), type: row.type };
}
