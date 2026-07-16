import { create } from "zustand";
import { db, type CustomClockRow } from "@/core/storage/db";
import { DEFAULT_CLOCK_CSS } from "./CustomClock";

interface CustomClockState {
  items: CustomClockRow[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (name: string) => Promise<string>;
  updateCss: (id: string, css: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCustomClockStore = create<CustomClockState>((set, get) => ({
  items: [],
  loaded: false,

  load: async () => {
    const items = await db.customClocks.orderBy("updatedAt").reverse().toArray();
    set({ items, loaded: true });
  },

  add: async (name) => {
    const row: CustomClockRow = {
      id: crypto.randomUUID(),
      name: name.trim() || "Clock",
      css: DEFAULT_CLOCK_CSS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.customClocks.add(row);
    set({ items: [row, ...get().items] });
    return row.id;
  },

  updateCss: async (id, css) => {
    await db.customClocks.update(id, { css, updatedAt: Date.now() });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, css } : i)) });
  },

  rename: async (id, name) => {
    await db.customClocks.update(id, { name, updatedAt: Date.now() });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, name } : i)) });
  },

  remove: async (id) => {
    await db.customClocks.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));
