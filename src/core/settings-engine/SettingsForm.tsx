import { useTranslation } from "react-i18next";
import { Field, Select, Slider, TextInput, Toggle } from "@/shared/ui";
import type { FieldDef, SettingsSchema } from "./schema";
import { useFeatureValues, useSettingsStore } from "./settingsStore";

/**
 * Renders a feature's settings form straight from its schema — no per-feature
 * form code (docs/core-he-thong/02-settings-engine.md §3). Changes apply live.
 */
export function SettingsForm({
  featureId,
  schema,
}: {
  featureId: string;
  schema: SettingsSchema;
}) {
  const { t } = useTranslation();
  const values = useFeatureValues(featureId);
  const setValue = useSettingsStore((s) => s.setValue);

  return (
    <div>
      {Object.entries(schema).map(([key, field]) => {
        if (field.showIf && !field.showIf(values)) return null;
        return (
          <SettingsField
            key={key}
            field={field}
            value={values[key] ?? field.default}
            onChange={(v) => setValue(featureId, key, v)}
            t={t}
          />
        );
      })}
    </div>
  );
}

function SettingsField({
  field,
  value,
  onChange,
  t,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  t: (key: string) => string;
}) {
  const label = t(field.label);
  const description = field.description ? t(field.description) : undefined;

  switch (field.type) {
    case "toggle":
      return (
        <Field label={label} description={description} inline>
          <Toggle checked={value === true} onChange={onChange} />
        </Field>
      );
    case "select":
      return (
        <Field label={label} description={description} inline>
          <div style={{ maxWidth: 240 }}>
            <Select
              value={(value as string) ?? ""}
              onChange={onChange}
              options={field.options.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
          </div>
        </Field>
      );
    case "text":
      return (
        <Field label={label} description={description}>
          <TextInput
            type={field.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder ? t(field.placeholder) : undefined}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case "number":
      return (
        <Field label={label} description={description}>
          <TextInput
            type="number"
            min={field.min}
            max={field.max}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
      );
    case "slider":
      return (
        <Field label={label} description={description}>
          <Slider
            value={(value as number) ?? field.min}
            onChange={onChange}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        </Field>
      );
    case "color":
      return (
        <Field label={label} description={description} inline>
          <input
            type="color"
            value={(value as string) ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    default:
      return null;
  }
}
