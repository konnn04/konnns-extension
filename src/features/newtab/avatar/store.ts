import { create } from "zustand";
import { db, type AvatarRow } from "@/core/storage/db";
import { processImage } from "@/features/newtab/wallpaper/image";

/**
 * Avatar (image / gif shown on the NewTab main area). GIFs are stored as-is to
 * keep animation; static images are downscaled like wallpapers.
 */

export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

export interface AvatarMeta {
  id: string;
  type: "image" | "gif";
  name: string;
  size: number;
  createdAt: number;
}

interface AvatarState {
  loaded: boolean;
  items: AvatarMeta[];
  load: () => Promise<void>;
  addFile: (file: File) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

function toMeta(row: AvatarRow): AvatarMeta {
  const { blob: _blob, ...meta } = row;
  return meta;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  loaded: false,
  items: [],

  load: async () => {
    const rows = await db.avatars.orderBy("createdAt").reverse().toArray();
    set({ items: rows.map(toMeta), loaded: true });
  },

  addFile: async (file) => {
    if (file.size > MAX_AVATAR_BYTES) throw new Error("avatar-too-large");
    const isGif = file.type === "image/gif";
    let blob: Blob = file;
    if (!isGif) {
      // small avatar → no need for full-res; cap around 512px via processImage-ish
      blob = (await processImage(file)).blob;
    }
    const row: AvatarRow = {
      id: crypto.randomUUID(),
      type: isGif ? "gif" : "image",
      blob,
      name: file.name,
      size: blob.size,
      createdAt: Date.now(),
    };
    await db.avatars.add(row);
    set({ items: [toMeta(row), ...get().items] });
    return row.id;
  },

  remove: async (id) => {
    await db.avatars.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));

export async function getAvatarUrl(id: string): Promise<string | null> {
  const row = await db.avatars.get(id);
  return row ? URL.createObjectURL(row.blob) : null;
}
