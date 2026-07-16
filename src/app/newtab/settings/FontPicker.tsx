import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FONT_PRESETS } from "@/core/font-engine";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { Field, Select, TextInput, type Option } from "@/shared/ui";

export function FontPicker() {
  const { t } = useTranslation();
  const values = useFeatureValues(CORE_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);

  useEffect(() => {
    const id = "newtab-font-preview";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const fams = FONT_PRESETS.filter((p) => p.google).map((p) => `family=${p.google}`);
    link.href = `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap`;
  }, []);

  const options: Option[] = [
    ...FONT_PRESETS.map((p) => ({ value: p.id, label: t(p.labelKey), font: p.stack })),
    { value: "custom", label: t("fonts.custom") },
  ];

  const headingId = (values.fontHeading as string) ?? "system";
  const bodyId = (values.fontBody as string) ?? "system";

  return (
    <>
      <Field label={t("fonts.heading")}>
        <Select
          value={headingId}
          onChange={(v) => setValue(CORE_FEATURE_ID, "fontHeading", v)}
          options={options}
        />
        {headingId === "custom" && (
          <TextInput
            style={{ marginTop: "var(--space-2)" }}
            placeholder={t("fonts.customPlaceholder")}
            value={(values.fontHeadingCustom as string) ?? ""}
            onChange={(e) => setValue(CORE_FEATURE_ID, "fontHeadingCustom", e.target.value)}
          />
        )}
      </Field>

      <Field label={t("fonts.body")}>
        <Select
          value={bodyId}
          onChange={(v) => setValue(CORE_FEATURE_ID, "fontBody", v)}
          options={options}
        />
        {bodyId === "custom" && (
          <TextInput
            style={{ marginTop: "var(--space-2)" }}
            placeholder={t("fonts.customPlaceholder")}
            value={(values.fontBodyCustom as string) ?? ""}
            onChange={(e) => setValue(CORE_FEATURE_ID, "fontBodyCustom", e.target.value)}
          />
        )}
      </Field>
    </>
  );
}
