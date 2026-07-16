/**
 * Schema-driven settings — docs/core-he-thong/02-settings-engine.md §3.
 * Each feature declares a schema; the Settings modal renders the form automatically.
 */

export type FieldValues = Record<string, unknown>;

interface BaseField {
  /** i18n key for the label */
  label: string;
  /** i18n key for helper text under the field */
  description?: string;
  /** hide the field unless the predicate over current values passes */
  showIf?: (values: FieldValues) => boolean;
}

export interface TextField extends BaseField {
  type: "text";
  default?: string;
  placeholder?: string;
  /** password-mask, never logged (API keys...) */
  secret?: boolean;
}

export interface NumberField extends BaseField {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
}

export interface ToggleField extends BaseField {
  type: "toggle";
  default?: boolean;
}

export interface SelectField extends BaseField {
  type: "select";
  options: Array<{ value: string; label: string }>;
  default?: string;
}

export interface SliderField extends BaseField {
  type: "slider";
  default?: number;
  min: number;
  max: number;
  step?: number;
}

export interface ColorField extends BaseField {
  type: "color";
  default?: string;
}

export type FieldDef =
  | TextField
  | NumberField
  | ToggleField
  | SelectField
  | SliderField
  | ColorField;

export type SettingsSchema = Record<string, FieldDef>;

export function defineSchema<T extends SettingsSchema>(schema: T): T {
  return schema;
}

/** Default values extracted from a schema (used before the user changes anything). */
export function schemaDefaults(schema: SettingsSchema | undefined): FieldValues {
  const out: FieldValues = {};
  if (!schema) return out;
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) out[key] = field.default;
  }
  return out;
}
