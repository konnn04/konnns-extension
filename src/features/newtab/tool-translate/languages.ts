export interface Lang {
  code: string;
  name: string;
}

/** Languages offered by the translator (MyMemory supports all of these). */
export const LANGUAGES: Lang[] = [
  { code: "en", name: "English" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "es", name: "Español (Spanish)" },
  { code: "ru", name: "Русский (Russian)" },
  { code: "th", name: "ไทย (Thai)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
];

export function langName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
