import { create } from "zustand";

/**
 * Left-sidebar panel manager — docs/01-tech-stack §4 + phase-2 + optim item 9.
 * Open state persists to localStorage so it survives tab reloads. Panel width
 * lives in the General settings (core.sidebarWidth) so it's discoverable.
 */

const OPEN_KEY = "newtab.leftSidebar.open";

function readOpen(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface LeftSidebarState {
  open: string[];
  toggle: (id: string, singleOpen: boolean) => void;
  close: (id: string) => void;
  closeAll: () => void;
  isOpen: (id: string) => boolean;
}

function persistOpen(open: string[]) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  } catch {
    /* ignore */
  }
}

export const useLeftSidebar = create<LeftSidebarState>((set, get) => ({
  open: readOpen(),
  toggle: (id, singleOpen) =>
    set((s) => {
      const open = s.open.includes(id)
        ? s.open.filter((x) => x !== id)
        : singleOpen
          ? [id]
          : [...s.open, id];
      persistOpen(open);
      return { open };
    }),
  close: (id) =>
    set((s) => {
      const open = s.open.filter((x) => x !== id);
      persistOpen(open);
      return { open };
    }),
  closeAll: () => {
    persistOpen([]);
    set({ open: [] });
  },
  isOpen: (id) => get().open.includes(id),
}));
