import { useEffect, useState } from "react";
import {
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSunRain,
  Droplets,
  Snowflake,
  Sun,
  SunMedium,
  Wind,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { ReloadButton, Skeleton } from "@/shared/ui";
import { CLOCK_FEATURE_ID } from "@/features/newtab/clock-weather";
import { describeWeatherCode, useWeatherStore } from "@/features/newtab/clock-weather/weather";
import { TempChart } from "./TempChart";
import { SunArc } from "./SunArc";
import { weatherDetailSettingsSchema } from "./settings.schema";
import "./weather-detail.css";

export const WEATHER_DETAIL_FEATURE_ID = "panel-weather-detail";

const bucketIcons: Record<string, typeof Sun> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  showers: CloudSunRain,
  thunder: CloudLightning,
};

function dayName(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", { weekday: "short" });
}

function PanelWeatherDetail() {
  const { t, i18n } = useTranslation();
  // shares location with the NewTab clock/weather summary (no duplicate config)
  const clock = useFeatureValues(CLOCK_FEATURE_ID);
  const wd = useFeatureValues(WEATHER_DETAIL_FEATURE_ID);
  const online = useOnlineStatus();
  const { forecastStatus, forecast, forecastOffline, fetchForecast } = useWeatherStore();
  const [reloading, setReloading] = useState(false);

  const showStats = wd.showStats !== false;
  const showSun = wd.showSun !== false;
  const showHourly = wd.showHourly !== false;
  const showDaily = wd.showDaily !== false;

  const city = (clock.location as string) ?? "";
  const useGeo = clock.useGeolocation === true;
  const configured = useGeo || city.trim().length > 0;

  useEffect(() => {
    if (configured) void fetchForecast({ city, useGeolocation: useGeo });
  }, [city, useGeo, online, configured, fetchForecast]);

  const forceReload = async () => {
    setReloading(true);
    await fetchForecast({ city, useGeolocation: useGeo }, true);
    setReloading(false);
  };

  if (!configured) {
    return <p className="ui-field__desc">{t("weather.notConfigured")}</p>;
  }

  if (forecastStatus === "loading" || forecastStatus === "idle") {
    return (
      <div>
        <Skeleton width="60%" height={16} />
        <div style={{ height: 12 }} />
        <Skeleton width="100%" height={96} radius="var(--radius-md)" />
        <div style={{ height: 16 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <Skeleton width="100%" height={28} />
          </div>
        ))}
      </div>
    );
  }

  if (forecastStatus === "error" || !forecast) {
    return <p className="ui-field__desc">{t("weather.error")}</p>;
  }

  const nowDesc = describeWeatherCode(forecast.codeNow);
  const NowIcon = bucketIcons[nowDesc.bucket] ?? Cloud;
  const hourLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language === "vi" ? "vi-VN" : "en-US", { hour: "2-digit" });

  return (
    <div className="wdetail">
      <div className="wdetail__head">
        <div className="wdetail__loc">
          {forecast.locationLabel}
          {forecastOffline ? ` · ${t("weather.offline")}` : ""}
        </div>
        <ReloadButton busy={reloading} label={t("common.retry")} onClick={() => void forceReload()} />
      </div>

      {/* current temperature + condition */}
      <div className="wdetail__now">
        <NowIcon size={44} className="wdetail__now-icon" />
        <div>
          <div className="wdetail__now-temp">{forecast.tempNow}°C</div>
          <div className="wdetail__now-cond">{t(nowDesc.labelKey)}</div>
        </div>
      </div>

      {/* compact stat grid (docs item 5 — limit big cards) */}
      {showStats && (
        <div className="wdetail__grid">
          <div className="wdetail__cell">
            <Droplets size={14} />
            <span>{t("weatherDetail.humidity")}</span>
            <b>{forecast.humidityNow}%</b>
          </div>
          <div className="wdetail__cell">
            <SunMedium size={14} />
            <span>{t("weatherDetail.uv")}</span>
            <b>{forecast.uvNow}</b>
          </div>
          {forecast.aqi !== null && (
            <div className="wdetail__cell">
              <Wind size={14} />
              <span>{t("weatherDetail.aqi")}</span>
              <b>{forecast.aqi}</b>
            </div>
          )}
        </div>
      )}

      {showSun && forecast.sunrise && (
        <SunArc sunrise={forecast.sunrise} sunset={forecast.sunset} />
      )}

      {showHourly && (
        <>
          <div className="wdetail__section-title">{t("weatherDetail.hourly")}</div>
          <TempChart hourly={forecast.hourly} />
          <div className="wdetail__hours">
            {forecast.hourly.slice(0, 12).map((h) => {
              const d = describeWeatherCode(h.code);
              const HIcon = bucketIcons[d.bucket] ?? Cloud;
              return (
                <div className="wdetail__hour" key={h.time}>
                  <span className="wdetail__hour-time">{hourLabel(h.time)}</span>
                  <HIcon size={18} className="wdetail__hour-icon" />
                  <span className="wdetail__hour-temp">{h.temp}°</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showDaily && (
        <>
      <div className="wdetail__section-title">{t("weatherDetail.daily")}</div>
      <div className="wdetail__days">
        {forecast.daily.map((d, idx) => {
          const desc = describeWeatherCode(d.code);
          const Icon = bucketIcons[desc.bucket] ?? Cloud;
          return (
            <div className="wdetail__day" key={d.date}>
              <span className="wdetail__day-name">
                <Icon size={16} />
                {idx === 0 ? t("weatherDetail.today") : dayName(d.date, i18n.language)}
              </span>
              <span className="wdetail__day-temp">
                <SunMedium size={11} style={{ verticalAlign: "-1px", opacity: 0.6 }} /> {d.uvMax}
              </span>
              <span className="wdetail__day-temp">
                <b>{d.tMax}°</b> <span>{d.tMin}°</span>
              </span>
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

registerFeature({
  id: WEATHER_DETAIL_FEATURE_ID,
  zone: "left-sidebar",
  nameKey: "features.panel-weather-detail",
  icon: CloudSun,
  defaultEnabled: true,
  requiresNetwork: true,
  settingsSchema: weatherDetailSettingsSchema,
  component: PanelWeatherDetail,
  order: 1,
});

export default PanelWeatherDetail;
