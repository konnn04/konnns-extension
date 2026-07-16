import {
  clearToken,
  getRedirectUri,
  isExpired,
  launchWebAuthFlow,
  loadToken,
  parseCallback,
  saveToken,
} from "@/core/oauth";

/**
 * Google Calendar (read-only) via the client-side OAuth token flow
 * (docs/phase-3 §1). The user registers an OAuth client and provides the Client
 * ID; there is no refresh token in this flow, so we re-auth when it expires.
 */

const CALENDAR_REDIRECT_PATH = "google-calendar";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  allDay: boolean;
  location?: string;
}

export async function connectCalendar(clientId: string): Promise<boolean> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(CALENDAR_REDIRECT_PATH),
    response_type: "token",
    scope: SCOPE,
    prompt: "consent",
  });
  const redirect = await launchWebAuthFlow(`${AUTH}?${params}`);
  const cb = parseCallback(redirect);
  const accessToken = cb.get("access_token");
  const expiresIn = Number(cb.get("expires_in") ?? "3600");
  if (!accessToken) return false;
  await saveToken("gcal", { accessToken, expiresAt: Date.now() + expiresIn * 1000 });
  return true;
}

export async function getValidToken(): Promise<string | null> {
  const token = await loadToken("gcal");
  if (!token || isExpired(token)) return null;
  return token.accessToken;
}

export async function disconnectCalendar(): Promise<void> {
  await clearToken("gcal");
}

export async function fetchEvents(token: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`gcal ${res.status}`);
  const json = await res.json();
  return (json.items ?? []).map(
    (e: {
      id: string;
      summary?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
    }): CalendarEvent => {
      const allDay = !e.start.dateTime;
      const start = new Date(e.start.dateTime ?? e.start.date ?? Date.now()).getTime();
      return { id: e.id, title: e.summary ?? "(no title)", start, allDay, location: e.location };
    },
  );
}
