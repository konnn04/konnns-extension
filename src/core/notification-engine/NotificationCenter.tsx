import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/shared/ui";
import { useNotificationCenter } from "./index";
import "./notification-center.css";

function timeAgo(ts: number, lang: string): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "vi" ? "vi" : "en", { numeric: "auto" });
  if (mins < 1) return rtf.format(0, "minute");
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function NotificationCenter() {
  const { t, i18n } = useTranslation();
  const { items, loaded, load, markRead, markAllRead, clear, unreadCount } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = unreadCount();

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <>
      <div className="notif-trigger-zone">
        <button
          type="button"
          className={`notif-trigger ${unread > 0 ? "notif-trigger--has-unread" : ""}`}
          aria-label={t("notifications.title")}
          onClick={() => {
            setOpen((o) => !o);
            if (!open && unread > 0) void markAllRead();
          }}
        >
          <Bell size={20} />
          {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="notif-panel"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="notif-panel__header">
              <span className="notif-panel__title">{t("notifications.title")}</span>
              <div className="notif-panel__actions">
                <IconButton label={t("notifications.markAllRead")} onClick={() => void markAllRead()}>
                  <Check size={16} />
                </IconButton>
                <IconButton label={t("notifications.clear")} onClick={() => void clear()}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </div>
            <div className="notif-panel__list">
              {items.length === 0 ? (
                <div className="notif-panel__empty">{t("notifications.empty")}</div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-row ${n.readAt === null ? "notif-row--unread" : ""}`}
                    onMouseEnter={() => n.readAt === null && void markRead(n.id)}
                  >
                    <span className={`notif-row__dot ${n.readAt !== null ? "notif-row__dot--read" : ""}`} />
                    <div className="notif-row__body">
                      <div className="notif-row__title">{n.title}</div>
                      <div className="notif-row__text">{n.body}</div>
                      <div className="notif-row__meta">
                        <span className="notif-row__source">{n.source}</span> ·{" "}
                        {timeAgo(n.createdAt, i18n.language)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
