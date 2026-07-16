import { create } from "zustand";
import { db, type NoteRow } from "@/core/storage/db";

interface NoteState {
  items: NoteRow[];
  activeId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  add: () => Promise<void>;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  items: [],
  activeId: null,
  loaded: false,

  load: async () => {
    const items = await db.notes.orderBy("updatedAt").reverse().toArray();
    set({ items, loaded: true, activeId: items[0]?.id ?? null });
  },

  add: async () => {
    const row: NoteRow = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.notes.add(row);
    set({ items: [row, ...get().items], activeId: row.id });
  },

  setActive: (id) => set({ activeId: id }),

  updateContent: async (id, content) => {
    await db.notes.update(id, { content, updatedAt: Date.now() });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, content } : i)) });
  },

  updateTitle: async (id, title) => {
    await db.notes.update(id, { title, updatedAt: Date.now() });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, title } : i)) });
  },

  remove: async (id) => {
    await db.notes.delete(id);
    const items = get().items.filter((i) => i.id !== id);
    set({ items, activeId: get().activeId === id ? (items[0]?.id ?? null) : get().activeId });
  },
}));
