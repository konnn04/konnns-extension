import { useEffect } from "react";
import {
  Clock as ClockIcon,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  WifiOff,
  Wind,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { emit } from "@/core/event-bus";
import { useOnlineStatus } from "@/core/net";
import { Skeleton } from "@/shared/ui";
import { AnalogClock, DigitalClock, TextClock } from "./clocks";
import { CustomClock, DEFAULT_CLOCK_CSS } from "./CustomClock";
import { useCustomClockStore } from "./customClockStore";
import { ClockPresetManager } from "./ClockPresetManager";
import { describeWeatherCode, useWeatherStore } from "./weather";
import { clockWeatherSettingsSchema } from "./settings.schema";
import "./clock-weather.css";

export const CLOCK_FEATURE_ID = "clock-weather";

interface ClockValues {
  [key: string]: unknown;
  clockStyle?: string;
  showSeconds?: boolean;
  hour24?: boolean;
  showWeather?: boolean;
  useGeolocation?: boolean;
  location?: string;
}

const weatherIcons: Record<string, typeof Sun> = {
  clear: Sun,
  "clear-night": Moon,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  showers: CloudRain,
  thunder: CloudLightning,
};

function WeatherSummary({ values }: { values: ClockValues }) {
  const { t } = useTranslation();
  const { status, data, offline, fetch } = useWeatherStore();
  const online = useOnlineStatus();
  const city = values.location ?? "";
  const useGeo = values.useGeolocation === true;

  // refetch on location change and whenever the connection is (re)established
  useEffect(() => {
    void fetch({ city, useGeolocation: useGeo });
  }, [city, useGeo, online, fetch]);

  if (!useGeo && !city.trim()) {
    // graceful "not configured" placeholder — never raw errors (docs/phase-1-mvp/01 §2)
    return (
      <div className="weather-summary">
        <button
          className="weather-summary__setup"
          onClick={() => emit("settings:open", { featureId: CLOCK_FEATURE_ID })}
        >
          {t("weather.notConfigured")} — {t("weather.configure")}
        </button>
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="weather-summary" aria-hidden>
        <Skeleton width={200} height={28} radius="var(--radius-full)" />
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="weather-summary">
        <button
          className="weather-summary__setup"
          onClick={() => emit("settings:open", { featureId: CLOCK_FEATURE_ID })}
        >
          {t("weather.error")} — {t("weather.configure")}
        </button>
      </div>
    );
  }

  const desc = describeWeatherCode(data.weatherCode);
  const iconKey = desc.bucket === "clear" && !data.isDay ? "clear-night" : desc.bucket;
  const Icon = weatherIcons[iconKey] ?? Cloud;

  return (
    <div className="weather-summary">
      <Icon size={26} className="weather-summary__icon" aria-hidden />
      <span className="weather-summary__temp">{data.temperature}°C</span>
      <span>{t(desc.labelKey)}</span>
      <span className="weather-summary__meta">
        <Wind size={14} style={{ verticalAlign: "-2px" }} aria-hidden /> {data.windSpeed} km/h
        {data.locationLabel ? ` · ${data.locationLabel}` : ""}
      </span>
      {offline && (
        <span className="weather-summary__offline" title={t("weather.offline")}>
          <WifiOff size={14} aria-hidden /> {t("weather.offline")}
        </span>
      )}
    </div>
  );
}

function ClockWeather() {
  const values = useFeatureValues<ClockValues>(CLOCK_FEATURE_ID);
  const style = values.clockStyle ?? "digital";
  const showSeconds = values.showSeconds === true;
  const hour24 = values.hour24 !== false;

  const customLoaded = useCustomClockStore((s) => s.loaded);
  const customItems = useCustomClockStore((s) => s.items);
  const loadCustom = useCustomClockStore((s) => s.load);
  useEffect(() => {
    if (style === "custom" && !customLoaded) void loadCustom();
  }, [style, customLoaded, loadCustom]);

  const activeCss =
    customItems.find((c) => c.id === (values.customClockId as string))?.css ??
    customItems[0]?.css ??
    DEFAULT_CLOCK_CSS;

  return (
    <div>
      {style === "analog" ? (
        <AnalogClock showSeconds={showSeconds} />
      ) : style === "text" ? (
        <TextClock hour24={hour24} />
      ) : style === "custom" ? (
        <CustomClock css={activeCss} />
      ) : (
        <DigitalClock showSeconds={showSeconds} hour24={hour24} />
      )}
      {values.showWeather !== false && <WeatherSummary values={values} />}
    </div>
  );
}

registerFeature({
  id: CLOCK_FEATURE_ID,
  zone: "center",
  nameKey: "features.clock-weather",
  icon: ClockIcon,
  defaultEnabled: true,
  requiresNetwork: true,
  settingsSchema: clockWeatherSettingsSchema,
  settingsExtra: ClockPresetManager,
  component: ClockWeather,
  order: 1,
});

export default ClockWeather;
