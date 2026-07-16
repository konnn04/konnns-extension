import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { brandIcons } from "@/shared/icons";
import { buildSearchUrl, engines } from "./engines";
import { searchSettingsSchema } from "./settings.schema";
import "./search-bar.css";

export const SEARCH_FEATURE_ID = "search-bar";

interface SearchValues {
  [key: string]: unknown;
  engine?: string;
  customUrl?: string;
  autofocus?: boolean;
  position?: string;
}

function SearchBar() {
  const { t } = useTranslation();
  const values = useFeatureValues<SearchValues>(SEARCH_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const engineId = values.engine ?? "google";

  useEffect(() => {
    if (values.autofocus !== false) inputRef.current?.focus();
  }, [values.autofocus]);

  const submit = () => {
    const url = buildSearchUrl(engineId, values.customUrl ?? "", query);
    if (url) window.location.href = url;
  };

  const cycleEngine = () => {
    const ids = engines.map((e) => e.id);
    const next = ids[(ids.indexOf(engineId) + 1) % ids.length];
    setValue(SEARCH_FEATURE_ID, "engine", next);
  };

  const engineLabel =
    engineId === "custom" ? "Custom" : (engines.find((e) => e.id === engineId)?.label ?? "Google");
  const EngineIcon = brandIcons[engineId] ?? brandIcons.custom;

  const maxWidth = typeof values.maxWidth === "number" ? values.maxWidth : 620;
  const opacity = typeof values.opacity === "number" ? values.opacity : 100;
  const blur = typeof values.blur === "number" ? values.blur : 16;

  return (
    <form
      className="search-bar"
      role="search"
      style={{
        width: `min(${maxWidth}px, 86vw)`,
        background: `color-mix(in srgb, var(--surface) ${opacity}%, transparent)`,
        backdropFilter: `blur(${blur}px)`,
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Search size={20} className="search-bar__icon" aria-hidden />
      <input
        ref={inputRef}
        className="search-bar__input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        spellCheck={false}
      />
      <button
        type="button"
        className="search-bar__engine"
        onClick={cycleEngine}
        title={`${t("search.engine")}: ${engineLabel}`}
        aria-label={`${t("search.engine")}: ${engineLabel}`}
      >
        <EngineIcon size={18} />
        <span className="search-bar__engine-label">{engineLabel}</span>
      </button>
    </form>
  );
}

registerFeature({
  id: SEARCH_FEATURE_ID,
  zone: "center",
  nameKey: "features.search-bar",
  icon: Search,
  defaultEnabled: true,
  settingsSchema: searchSettingsSchema,
  component: SearchBar,
  order: 2,
});

export default SearchBar;
