import { create } from "zustand";
import { db, type TaskRow, type TaskType } from "@/core/storage/db";

interface TaskState {
  items: TaskRow[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (text: string, taskType?: TaskType, deadline?: number) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  edit: (id: string, text: string) => Promise<void>;
  setDeadline: (id: string, deadline: number | undefined) => Promise<void>;
  setTaskType: (id: string, taskType: TaskType) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (fromId: string, toId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  items: [],
  loaded: false,

  load: async () => {
    const items = await db.tasks.orderBy("order").toArray();
    set({ items, loaded: true });
  },

  add: async (text, taskType = "once", deadline) => {
    const t = text.trim();
    if (!t) return;
    const list = get().items;
    const order = (list.length ? list[list.length - 1].order : 0) + 1;
    const row: TaskRow = {
      id: crypto.randomUUID(),
      text: t,
      done: false,
      order,
      deadline,
      taskType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.tasks.add(row);
    set({ items: [...get().items, row] });
  },

  toggle: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const done = !item.done;
    set({ items: get().items.map((i) => (i.id === id ? { ...i, done } : i)) });
    await db.tasks.update(id, { done, updatedAt: Date.now() });
  },

  edit: async (id, text) => {
    set({ items: get().items.map((i) => (i.id === id ? { ...i, text } : i)) });
    await db.tasks.update(id, { text, updatedAt: Date.now() });
  },

  setDeadline: async (id, deadline) => {
    set({ items: get().items.map((i) => (i.id === id ? { ...i, deadline } : i)) });
    await db.tasks.update(id, { deadline, updatedAt: Date.now() });
  },

  setTaskType: async (id, taskType) => {
    set({ items: get().items.map((i) => (i.id === id ? { ...i, taskType } : i)) });
    await db.tasks.update(id, { taskType, updatedAt: Date.now() });
  },

  remove: async (id) => {
    await db.tasks.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  reorder: async (fromId, toId) => {
    const items = [...get().items];
    const from = items.findIndex((i) => i.id === fromId);
    const to = items.findIndex((i) => i.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    const reordered = items.map((i, idx) => ({ ...i, order: idx }));
    set({ items: reordered });
    await db.tasks.bulkPut(reordered);
  },
}));
