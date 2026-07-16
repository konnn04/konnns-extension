import { create } from "zustand";

/**
 * Focus Mode — hides every panel/tool/decoration, leaving only wallpaper +
 * clock + search so the user can concentrate. State persists across tabs.
 */

const KEY = "newtab.focusMode";

interface FocusState {
  active: boolean;
  toggle: () => void;
  set: (v: boolean) => void;
}

export const useFocusMode = create<FocusState>((set, get) => ({
  active: localStorage.getItem(KEY) === "1",
  toggle: () => {
    const active = !get().active;
    localStorage.setItem(KEY, active ? "1" : "0");
    set({ active });
  },
  set: (active) => {
    localStorage.setItem(KEY, active ? "1" : "0");
    set({ active });
  },
}));
