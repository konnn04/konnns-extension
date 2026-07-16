import { browser } from "wxt/browser";
import { db } from "@/core/storage/db";
import { fetchUnreadCount } from "@/features/newtab/panel-github/api";
import { ALARM_NAME as POMODORO_ALARM, advanceOnFire } from "@/features/newtab/tool-pomodoro/state";

/**
 * Background service worker. MV3 workers can be killed at any time, so periodic
 * work uses chrome.alarms (never setTimeout) — docs/phase-3 §4. Phase 3 wires a
 * GitHub notification poll here so alerts fire even when no NewTab is open.
 * Pomodoro alarms (Phase 4) will hang off the same alarm handler.
 */

const GITHUB_ALARM = "github-poll";
const ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export default defineBackground(() => {
  // Provide redirect URI to pages that can't access browser.identity directly
  // (e.g. newtab in wxt dev mode served from localhost)
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "getRedirectUri") {
      const base = browser.identity.getRedirectURL();
      const path = (msg as { path?: string }).path ?? "";
      sendResponse(path ? `${base}${path}` : base);
      return true; // Keep the message channel open for async response
    }
  });

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      browser.storage.local.set({ installedAt: Date.now() });
    }
    // poll GitHub every 15 minutes (cheap; no-ops when no token/permission)
    browser.alarms.create(GITHUB_ALARM, { periodInMinutes: 15 });
  });

  browser.runtime.onStartup?.addListener(() => {
    browser.alarms.create(GITHUB_ALARM, { periodInMinutes: 15 });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === GITHUB_ALARM) void pollGitHub();
    else if (alarm.name === POMODORO_ALARM) void firePomodoro();
  });
});

async function firePomodoro(): Promise<void> {
  try {
    const { title, body } = await advanceOnFire();
    const notif = await db.settings.get("notifications");
    const prefs = notif?.values ?? {};
    if (prefs.master === false || prefs["src:tool-pomodoro"] === false) return;

    const row = {
      id: crypto.randomUUID(),
      source: "tool-pomodoro",
      type: "alarm" as const,
      title,
      body,
      createdAt: Date.now(),
      readAt: null,
    };
    await db.notificationsLog.add(row);
    if (await browser.permissions.contains({ permissions: ["notifications"] })) {
      await browser.notifications.create(row.id, {
        type: "basic",
        iconUrl: ICON,
        title,
        message: body,
      });
    }
  } catch {
    /* ignore */
  }
}

async function pollGitHub(): Promise<void> {
  try {
    const [ghSettings, notifSettings, hasPerm] = await Promise.all([
      db.settings.get("panel-github"),
      db.settings.get("notifications"),
      browser.permissions.contains({ permissions: ["notifications"] }),
    ]);

    const token = (ghSettings?.values?.token as string | undefined)?.trim();
    if (!token || !ghSettings?.enabled) return;

    // respect per-source + master notification toggles
    const notif = notifSettings?.values ?? {};
    if (notif.master === false || notif["src:panel-github"] === false) return;

    const count = await fetchUnreadCount(token);
    const prevRes = await browser.storage.local.get("github.lastUnread");
    const prev = Number(prevRes["github.lastUnread"] ?? 0);
    await browser.storage.local.set({ "github.lastUnread": count });

    if (count > prev && hasPerm) {
      const row = {
        id: crypto.randomUUID(),
        source: "panel-github",
        type: "info" as const,
        title: "GitHub",
        body: `${count} new notifications`,
        createdAt: Date.now(),
        readAt: null,
      };
      // log so the in-app center shows it next time a NewTab opens
      await db.notificationsLog.add(row);
      await browser.notifications.create(row.id, {
        type: "basic",
        iconUrl: ICON,
        title: row.title,
        message: row.body,
      });
    }
  } catch {
    /* worker may be torn down / offline — next alarm retries */
  }
}
