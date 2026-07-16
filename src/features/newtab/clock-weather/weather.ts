import { create } from "zustand";
import { isOnline, swr } from "@/core/net";

/**
 * Weather via Open-Meteo (no API key — docs/phase-1-mvp/01 §2) with the
 * stale-while-revalidate pattern from docs/phase-1-mvp/03 §5 (shared core/net
 * helper): cached data renders instantly, refetch happens silently in the
 * background, and when the network drops the cache keeps showing.
 */

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
  locationLabel: string;
}

/** Multi-day + hourly forecast for the left-sidebar detail panel (Phase 2). */
export interface DailyForecast {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  uvMax: number;
}
export interface HourlyPoint {
  time: string;
  temp: number;
  code: number;
}
export interface ForecastData {
  locationLabel: string;
  tempNow: number;
  codeNow: number;
  humidityNow: number;
  uvNow: number;
  sunrise: string;
  sunset: string;
  aqi: number | null;
  daily: DailyForecast[];
  hourly: HourlyPoint[]; // next 24h from now
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface LocationOpts {
  city?: string;
  useGeolocation?: boolean;
}

interface WeatherState {
  status: AsyncStatus;
  data: WeatherData | null;
  error?: string;
  offline: boolean;
  lastFetchedAt?: number;
  fetch: (opts: LocationOpts, force?: boolean) => Promise<void>;

  forecastStatus: AsyncStatus;
  forecast: ForecastData | null;
  forecastOffline: boolean;
  fetchForecast: (opts: LocationOpts, force?: boolean) => Promise<void>;
}

const TTL_MS = 20 * 60 * 1000;
const FORECAST_TTL_MS = 60 * 60 * 1000;

async function geocode(city: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=vi&format=json`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  const hit = json?.results?.[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude, label: hit.name as string };
}

function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      reject,
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Resolve {lat, lon, label} from either the browser position or a city name. */
async function resolveLocation(
  opts: LocationOpts,
): Promise<{ lat: number; lon: number; label: string }> {
  if (opts.useGeolocation) {
    const pos = await getPosition();
    return { lat: pos.lat, lon: pos.lon, label: "" };
  }
  const geo = await geocode(opts.city!.trim());
  if (!geo) throw new Error("geocode failed");
  return geo;
}

async function fetchCurrent(lat: number, lon: number): Promise<Omit<WeatherData, "locationLabel">> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather http ${res.status}`);
  const json = await res.json();
  const c = json.current;
  return {
    temperature: Math.round(c.temperature_2m),
    weatherCode: c.weather_code,
    windSpeed: Math.round(c.wind_speed_10m),
    isDay: c.is_day === 1,
  };
}

async function fetchForecast(lat: number, lon: number): Promise<Omit<ForecastData, "locationLabel">> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,relative_humidity_2m,uv_index` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset` +
    `&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast http ${res.status}`);
  const json = await res.json();

  // air quality (European AQI) — separate keyless Open-Meteo endpoint
  let aqi: number | null = null;
  try {
    const aqRes = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
    );
    if (aqRes.ok) {
      const aq = await aqRes.json();
      aqi = aq.current?.european_aqi ?? null;
    }
  } catch {
    /* AQI optional */
  }

  const daily: DailyForecast[] = (json.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    code: json.daily.weather_code[i],
    tMax: Math.round(json.daily.temperature_2m_max[i]),
    tMin: Math.round(json.daily.temperature_2m_min[i]),
    uvMax: Math.round(json.daily.uv_index_max[i] ?? 0),
  }));

  // hourly: keep the next 24 hours starting from the current hour
  const times: string[] = json.hourly?.time ?? [];
  const temps: number[] = json.hourly?.temperature_2m ?? [];
  const codes: number[] = json.hourly?.weather_code ?? [];
  const nowIdx = Math.max(
    0,
    times.findIndex((t) => new Date(t).getTime() >= Date.now() - 3600_000),
  );
  const hourly: HourlyPoint[] = times.slice(nowIdx, nowIdx + 24).map((time, i) => ({
    time,
    temp: Math.round(temps[nowIdx + i]),
    code: codes[nowIdx + i] ?? 0,
  }));

  return {
    tempNow: Math.round(json.current?.temperature_2m ?? 0),
    codeNow: json.current?.weather_code ?? 0,
    humidityNow: Math.round(json.current?.relative_humidity_2m ?? 0),
    uvNow: Math.round(json.current?.uv_index ?? 0),
    sunrise: json.daily?.sunrise?.[0] ?? "",
    sunset: json.daily?.sunset?.[0] ?? "",
    aqi,
    daily,
    hourly,
  };
}

function locKeyOf(opts: LocationOpts): string {
  return opts.useGeolocation ? "geo" : `city:${(opts.city ?? "").trim().toLowerCase()}`;
}
function hasLocation(opts: LocationOpts): boolean {
  return opts.useGeolocation === true || (opts.city ?? "").trim().length > 0;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  status: "idle",
  data: null,
  offline: !isOnline(),
  forecastStatus: "idle",
  forecast: null,
  forecastOffline: false,

  fetch: async (opts, force) => {
    if (!hasLocation(opts)) {
      set({ status: "idle", data: null });
      return;
    }
    if (get().status !== "success") set({ status: "loading" });

    await swr<WeatherData>({
      namespace: "weather",
      key: locKeyOf(opts),
      ttlMs: TTL_MS,
      force,
      fetcher: async () => {
        const loc = await resolveLocation(opts);
        const current = await fetchCurrent(loc.lat, loc.lon);
        return { ...current, locationLabel: loc.label };
      },
      onData: (data, fromCache) =>
        set({
          status: "success",
          data,
          error: undefined,
          offline: fromCache && !isOnline(),
          lastFetchedAt: Date.now(),
        }),
      onError: (err, hadCache) => {
        if (hadCache || get().data) {
          set({ offline: !isOnline() }); // keep stale data, just flag offline
          return;
        }
        set({ status: "error", error: err instanceof Error ? err.message : "unknown" });
      },
    });
  },

  fetchForecast: async (opts, force) => {
    if (!hasLocation(opts)) {
      set({ forecastStatus: "idle", forecast: null });
      return;
    }
    if (get().forecastStatus !== "success") set({ forecastStatus: "loading" });

    await swr<ForecastData>({
      namespace: "weather-forecast",
      key: locKeyOf(opts),
      ttlMs: FORECAST_TTL_MS,
      force,
      fetcher: async () => {
        const loc = await resolveLocation(opts);
        const fc = await fetchForecast(loc.lat, loc.lon);
        return { ...fc, locationLabel: loc.label };
      },
      onData: (forecast, fromCache) =>
        set({
          forecastStatus: "success",
          forecast,
          forecastOffline: fromCache && !isOnline(),
        }),
      onError: (_err, hadCache) => {
        if (hadCache || get().forecast) {
          set({ forecastOffline: !isOnline() });
          return;
        }
        set({ forecastStatus: "error" });
      },
    });
  },
}));

/** WMO weather code → { icon name bucket, i18n key } */
export function describeWeatherCode(code: number): { bucket: string; labelKey: string } {
  if (code === 0) return { bucket: "clear", labelKey: "weather.codes.clear" };
  if (code <= 2) return { bucket: "partly", labelKey: "weather.codes.partlyCloudy" };
  if (code === 3) return { bucket: "cloudy", labelKey: "weather.codes.cloudy" };
  if (code === 45 || code === 48) return { bucket: "fog", labelKey: "weather.codes.fog" };
  if (code >= 51 && code <= 57) return { bucket: "drizzle", labelKey: "weather.codes.drizzle" };
  if (code >= 61 && code <= 67) return { bucket: "rain", labelKey: "weather.codes.rain" };
  if (code >= 71 && code <= 77) return { bucket: "snow", labelKey: "weather.codes.snow" };
  if (code >= 80 && code <= 82) return { bucket: "showers", labelKey: "weather.codes.showers" };
  if (code >= 85 && code <= 86) return { bucket: "snow", labelKey: "weather.codes.snow" };
  if (code >= 95) return { bucket: "thunder", labelKey: "weather.codes.thunder" };
  return { bucket: "cloudy", labelKey: "weather.codes.cloudy" };
}
