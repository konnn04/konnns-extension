import { create } from "zustand";
import { db, type WindowStateRow } from "@/core/storage/db";

/**
 * Right-sidebar Window Manager (docs/phase-4 §1). Each tool is an independent
 * window with mode docked/floating/minimized/maximized. A single store owns the
 * z-index stack so clicks bring a window to the front without conflicts. Geometry
 * persists per-tool in IndexedDB (`window-states`) and is restored on new tab.
 */

export type WindowMode = "docked" | "floating" | "minimized" | "maximized";

export interface ToolWindowState {
  id: string;
  mode: WindowMode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  /** remembers the mode to return to when un-minimizing/un-maximizing */
  prevMode: WindowMode;
}

// windows sit above center (z 10) / quick-access (z 20); start the stack here
const Z_BASE = 30;

function defaultState(id: string, index: number): ToolWindowState {
  return {
    id,
    mode: "floating",
    position: { x: 140 + index * 32, y: 96 + index * 32 },
    size: { width: 320, height: 400 },
    zIndex: Z_BASE,
    prevMode: "floating",
  };
}

interface WMState {
  windows: Record<string, ToolWindowState>;
  open: string[];
  topZ: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: (id: string) => void;
  openWindow: (id: string) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  setMode: (id: string, mode: WindowMode) => void;
  setPosition: (id: string, x: number, y: number) => void;
  setSize: (id: string, w: number, h: number) => void;
  minimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
}

function persist(w: ToolWindowState) {
  const row: WindowStateRow = {
    id: w.id,
    mode: w.mode,
    position: w.position,
    size: w.size,
    zIndex: w.zIndex,
  };
  void db.windowStates.put(row);
}

// drag/resize fire rapidly — debounce writes so we don't hammer IndexedDB
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persistDebounced(w: ToolWindowState) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persist(w), 350);
}

export const useWindowManager = create<WMState>((set, get) => ({
  windows: {},
  open: [],
  topZ: Z_BASE,
  hydrated: false,

  hydrate: async () => {
    const rows = await db.windowStates.toArray();
    const windows: Record<string, ToolWindowState> = {};
    let topZ = Z_BASE;
    for (const r of rows) {
      const mode = r.mode === "minimized" ? "floating" : r.mode; // never restore minimized
      windows[r.id] = {
        id: r.id,
        mode,
        position: r.position,
        size: r.size,
        zIndex: r.zIndex,
        prevMode: mode === "maximized" ? "floating" : mode,
      };
      topZ = Math.max(topZ, r.zIndex);
    }
    set({ windows, topZ, hydrated: true });
  },

  toggle: (id) => (get().open.includes(id) ? get().close(id) : get().openWindow(id)),

  openWindow: (id) => {
    const state = get();
    const win = state.windows[id] ?? defaultState(id, state.open.length);
    const zIndex = state.topZ + 1;
    const next = { ...win, zIndex, mode: win.mode === "minimized" ? win.prevMode : win.mode };
    set({
      windows: { ...state.windows, [id]: next },
      open: state.open.includes(id) ? state.open : [...state.open, id],
      topZ: zIndex,
    });
    persist(next);
  },

  close: (id) => set((s) => ({ open: s.open.filter((x) => x !== id) })),

  focus: (id) => {
    const s = get();
    const win = s.windows[id];
    if (!win) return;
    const zIndex = s.topZ + 1;
    const next = { ...win, zIndex };
    set({ windows: { ...s.windows, [id]: next }, topZ: zIndex });
    persist(next);
  },

  setMode: (id, mode) => {
    const s = get();
    const win = s.windows[id];
    if (!win) return;
    const next = { ...win, mode, prevMode: mode === "minimized" || mode === "maximized" ? win.mode : mode };
    set({ windows: { ...s.windows, [id]: next } });
    persist(next);
  },

  setPosition: (id, x, y) => {
    const s = get();
    const win = s.windows[id];
    if (!win) return;
    const next = { ...win, position: { x, y } };
    set({ windows: { ...s.windows, [id]: next } });
    persistDebounced(next);
  },

  setSize: (id, w, h) => {
    const s = get();
    const win = s.windows[id];
    if (!win) return;
    const next = { ...win, size: { width: w, height: h } };
    set({ windows: { ...s.windows, [id]: next } });
    persistDebounced(next);
  },

  minimize: (id) => get().setMode(id, "minimized"),

  toggleMaximize: (id) => {
    const win = get().windows[id];
    if (!win) return;
    get().setMode(id, win.mode === "maximized" ? win.prevMode || "floating" : "maximized");
  },
}));
