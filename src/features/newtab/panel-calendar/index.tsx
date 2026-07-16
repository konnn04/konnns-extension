import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { RedirectUriField } from "@/core/oauth/RedirectUriField";
import { Button, IconButton } from "@/shared/ui";
import {
  connectCalendar,
  disconnectCalendar,
  fetchEvents,
  getValidToken,
  type CalendarEvent,
} from "./api";
import { calendarSettingsSchema } from "./settings.schema";
import { solarToLunar } from "./lunar";
import { MonthGrid } from "./MonthGrid";
import "./calendar.css";

export const CALENDAR_FEATURE_ID = "panel-calendar";

function PanelCalendar() {
  const { t, i18n } = useTranslation();
  const values = useFeatureValues(CALENDAR_FEATURE_ID);
  const online = useOnlineStatus();
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const showLunar = values.showLunar !== false;
  const useGoogle = values.useGoogle === true;
  const clientId = ((values.clientId as string) ?? "").trim();

  const [view, setView] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!useGoogle || !clientId) {
      setConnected(false);
      setEvents([]);
      return;
    }
    const token = await getValidToken();
    setConnected(!!token);
    if (!token) return;
    try {
      setEvents(await fetchEvents(token));
    } catch {
      /* keep */
    }
  }, [useGoogle, clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh, online]);

  const eventDays = useMemo(
    () => new Set(events.map((e) => new Date(e.start).toDateString())),
    [events],
  );
  const selectedEvents = events.filter(
    (e) => new Date(e.start).toDateString() === selected.toDateString(),
  );

  const weekdayLabels =
    i18n.language === "vi"
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const monthLabel = new Date(view.getFullYear(), view.getMonth(), 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  const selLunar = solarToLunar(selected.getDate(), selected.getMonth() + 1, selected.getFullYear());
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="cal">
      <div className="cal__header">
        <span className="cal__month">{monthLabel}</span>
        <div className="cal__nav">
          <IconButton label="prev" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <button
            className="cal__today-btn"
            onClick={() => {
              const now = new Date();
              setView(now);
              setSelected(now);
            }}
          >
            {t("calendar.today")}
          </button>
          <IconButton label="next" onClick={() => shiftMonth(1)}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>

      <MonthGrid
        year={view.getFullYear()}
        month={view.getMonth()}
        selected={selected}
        onSelect={setSelected}
        showLunar={showLunar}
        eventDays={eventDays}
        weekdayLabels={weekdayLabels}
      />

      <div className="cal__selected">
        <div className="cal__selected-solar">
          {selected.toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        {showLunar && (
          <div className="cal__selected-lunar">
            {t("calendar.lunar")}: {selLunar.day}/{selLunar.month}
            {selLunar.leap ? " (nhuận)" : ""}
          </div>
        )}
      </div>

      {/* Google Calendar is optional — link it to pull events */}
      {useGoogle && clientId ? (
        connected ? (
          <>
            {selectedEvents.length > 0 ? (
              <div className="cal__events">
                {selectedEvents.map((e) => (
                  <div className="cal__event" key={e.id}>
                    <span className="cal__time">{e.allDay ? t("calendar.allDay") : fmtTime(e.start)}</span>
                    <div>
                      <div className="cal__title">{e.title}</div>
                      {e.location && <div className="cal__loc">{e.location}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ui-field__desc">{t("calendar.noEvents")}</p>
            )}
            <button className="cal__unlink" onClick={() => void disconnectCalendar().then(refresh)}>
              <Unlink size={13} /> {t("calendar.disconnect")}
            </button>
          </>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              if (await connectCalendar(clientId)) void refresh();
            }}
          >
            <Link2 size={15} /> {t("calendar.connect")}
          </Button>
        )
      ) : null}
    </div>
  );
}

function CalendarRedirectInfo() {
  const { t } = useTranslation();
  return <RedirectUriField label={t("calendar.redirectUri")} path="google-calendar" />;
}

registerFeature({
  id: CALENDAR_FEATURE_ID,
  zone: "left-sidebar",
  nameKey: "features.panel-calendar",
  icon: CalendarDays,
  defaultEnabled: false,
  notifiable: true,
  settingsSchema: calendarSettingsSchema,
  settingsExtra: CalendarRedirectInfo,
  component: PanelCalendar,
  order: 5,
});

export default PanelCalendar;
