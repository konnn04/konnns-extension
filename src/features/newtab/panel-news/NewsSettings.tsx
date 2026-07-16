import { useTranslation } from "react-i18next";
import { Combobox, Field, Select, TextInput } from "@/shared/ui";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { CURATED_FEEDS, TOPICS } from "./rss";

export const NEWS_FEATURE_ID = "panel-news";

/**
 * News settings — mode: topic-mix (default) or a curated RSS list (docs item 8).
 * Both use the multi-select Combobox.
 */
export function NewsSettings() {
  const { t } = useTranslation();
  const values = useFeatureValues(NEWS_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const mode = (values.mode as string) ?? "topics";
  const topics = (values.topics as string[]) ?? ["tech"];
  const feeds = (values.feeds as string[]) ?? ["techcrunch", "vne-news"];

  return (
    <div>
      <Field label={t("news.mode")}>
        <Select
          value={mode}
          onChange={(v) => setValue(NEWS_FEATURE_ID, "mode", v)}
          options={[
            { value: "topics", label: t("news.modeTopics") },
            { value: "rss", label: t("news.modeRss") },
          ]}
        />
      </Field>

      {mode === "topics" ? (
        <Field label={t("news.chooseTopics")} description={t("news.chooseTopicsDesc")}>
          <Combobox
            multiple
            value={topics}
            onChange={(v) => setValue(NEWS_FEATURE_ID, "topics", v)}
            options={TOPICS.map((tp) => ({ value: tp.id, label: t(tp.labelKey) }))}
            placeholder={t("news.chooseTopics")}
            searchPlaceholder={t("news.searchTopic")}
          />
        </Field>
      ) : (
        <Field label={t("news.chooseFeeds")} description={t("news.chooseFeedsDesc")}>
          <Combobox
            multiple
            value={feeds}
            onChange={(v) => setValue(NEWS_FEATURE_ID, "feeds", v)}
            options={CURATED_FEEDS.map((f) => ({ value: f.id, label: f.label }))}
            placeholder={t("news.chooseFeeds")}
            searchPlaceholder={t("news.searchTopic")}
          />
        </Field>
      )}

      <Field label={t("news.translateEndpoint")} description={t("news.translateEndpointDesc")}>
        <TextInput
          placeholder="https://libretranslate.com"
          value={(values.translateEndpoint as string) ?? ""}
          onChange={(e) => setValue(NEWS_FEATURE_ID, "translateEndpoint", e.target.value)}
        />
      </Field>
    </div>
  );
}
