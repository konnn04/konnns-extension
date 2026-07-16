import { defineSchema } from "@/core/settings-engine/schema";

export const clockWeatherSettingsSchema = defineSchema({
  clockStyle: {
    type: "select",
    label: "clock.style",
    options: [
      { value: "digital", label: "clock.styleDigital" },
      { value: "text", label: "clock.styleText" },
      { value: "analog", label: "clock.styleAnalog" },
      { value: "custom", label: "clock.styleCustom" },
    ],
    default: "digital",
  },
  showSeconds: { type: "toggle", label: "clock.showSeconds", default: false },
  hour24: { type: "toggle", label: "clock.hour24", default: true },
  showWeather: { type: "toggle", label: "weather.show", default: true },
  useGeolocation: {
    type: "toggle",
    label: "weather.useGeolocation",
    default: false,
    showIf: (v) => v.showWeather !== false,
  },
  location: {
    type: "text",
    label: "weather.location",
    placeholder: "weather.locationPlaceholder",
    showIf: (v) => v.showWeather !== false && v.useGeolocation !== true,
  },
});
