import { create } from "zustand";
import { browser } from "wxt/browser";
import { db, type NotificationRow, type NotificationType } from "@/core/storage/db";
import { requestPermissions } from "@/core/permissions";
import { useSettingsStore } from "@/core/settings-engine/settingsStore";

/**
 * Central notification service — docs/phase-3/02-notification-system.md.
 * Every feature calls notify() instead of touching chrome.notifications directly.
 * Two layers: OS-level (when the tab is hidden / for alarms) + an in-app
 * Notification Center that logs everything (bell + badge + history).
 */

export const NOTIF_FEATURE_ID = "notifications";

export interface NotifyInput {
  source: string;
  type?: NotificationType;
  title: string;
  body: string;
  sound?: boolean;
  /** force OS-level notification even if the tab is focused */
  os?: boolean;
}

interface NotifPrefs {
  master?: boolean;
  sound?: boolean;
  [perSource: string]: boolean | undefined; // "src:<source>" keys
}

function prefs(): NotifPrefs {
  return (useSettingsStore.getState().values[NOTIF_FEATURE_ID] as NotifPrefs) ?? {};
}

export function isSourceEnabled(source: string): boolean {
  const p = prefs();
  return p.master !== false && p[`src:${source}`] !== false;
}

// 1x1 accent tile — Chrome requires an iconUrl; data URL keeps us asset-free
const ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function osNotify(row: NotificationRow): Promise<void> {
  try {
    const granted = await browser.permissions.contains({ permissions: ["notifications"] });
    if (!granted) return;
    await browser.notifications.create(`${row.source}:${row.id}`, {
      type: "basic",
      iconUrl: ICON_DATA_URL,
      title: row.title,
      message: row.body,
    });
  } catch {
    /* notifications unavailable — in-app center still has it */
  }
}

interface NotifCenterState {
  items: NotificationRow[];
  loaded: boolean;
  load: () => Promise<void>;
  push: (row: NotificationRow) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => Promise<void>;
  unreadCount: () => number;
}

export const useNotificationCenter = create<NotifCenterState>((set, get) => ({
  items: [],
  loaded: false,

  load: async () => {
    const items = await db.notificationsLog.orderBy("createdAt").reverse().limit(100).toArray();
    set({ items, loaded: true });
  },

  push: (row) => set((s) => ({ items: [row, ...s.items].slice(0, 100) })),

  markRead: async (id) => {
    await db.notificationsLog.update(id, { readAt: Date.now() });
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, readAt: Date.now() } : i)),
    }));
  },

  markAllRead: async () => {
    const now = Date.now();
    const unread = get().items.filter((i) => i.readAt === null);
    await db.notificationsLog.bulkPut(unread.map((i) => ({ ...i, readAt: now })));
    set((s) => ({ items: s.items.map((i) => (i.readAt === null ? { ...i, readAt: now } : i)) }));
  },

  clear: async () => {
    await db.notificationsLog.clear();
    set({ items: [] });
  },

  unreadCount: () => get().items.filter((i) => i.readAt === null).length,
}));

// simple rate-limit: swallow an identical (source+title) notification within 30s
const recent = new Map<string, number>();

/** The one entry point features use to raise a notification. */
export async function notify(input: NotifyInput): Promise<void> {
  const source = input.source;
  if (!isSourceEnabled(source)) return;

  const dedupeKey = `${source}|${input.title}`;
  const now = Date.now();
  if (now - (recent.get(dedupeKey) ?? 0) < 30_000) return;
  recent.set(dedupeKey, now);

  const row: NotificationRow = {
    id: crypto.randomUUID(),
    source,
    type: input.type ?? "info",
    title: input.title,
    body: input.body,
    createdAt: now,
    readAt: null,
  };

  await db.notificationsLog.add(row);
  useNotificationCenter.getState().push(row);

  // OS-level when the tab isn't focused, or when explicitly requested / an alarm
  const wantOs = input.os || row.type === "alarm" || row.type === "reminder" || document.hidden;
  if (wantOs) await osNotify(row);

  if ((input.sound ?? prefs().sound) === true && (row.type === "alarm" || input.sound)) {
    try {
      // short beep via WebAudio (no audio asset needed)
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* audio blocked */
    }
  }
}

export function requestNotificationPermission(): Promise<boolean> {
  return requestPermissions({ permissions: ["notifications"] });
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: ["notifications"] });
  } catch {
    return false;
  }
}
