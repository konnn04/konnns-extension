import { useEffect } from "react";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
} from "@/core/settings-engine/settingsStore";

/**
 * Font engine (docs item 7). Two ways to set fonts: pick a built-in preset, or
 * enter any Google Font name. Fonts stream from Google Fonts (extension pages
 * allow font-src by default); the family names below all include a Vietnamese
 * subset so VI + EN render correctly. System default needs no network.
 */

export interface FontPreset {
  id: string;
  labelKey: string;
  /** CSS font-family value */
  stack: string;
  /** Google Fonts `family=` spec, or null for the system default */
  google: string | null;
}

const FALLBACK = ', "Segoe UI", system-ui, sans-serif';

export const FONT_PRESETS: FontPreset[] = [
  { id: "system", labelKey: "fonts.system", stack: '"Segoe UI", system-ui, sans-serif', google: null },
  { id: "be-vietnam", labelKey: "fonts.modern", stack: '"Be Vietnam Pro"' + FALLBACK, google: "Be+Vietnam+Pro:wght@400;600;700" },
  { id: "inter", labelKey: "fonts.clean", stack: '"Inter"' + FALLBACK, google: "Inter:wght@400;600;700" },
  { id: "lora", labelKey: "fonts.serif", stack: '"Lora", Georgia, serif', google: "Lora:wght@400;600;700" },
  { id: "playfair", labelKey: "fonts.classic", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;600;700" },
  { id: "dancing", labelKey: "fonts.handwriting", stack: '"Dancing Script", cursive', google: "Dancing+Script:wght@400;700" },
  { id: "orbitron", labelKey: "fonts.digital", stack: '"Orbitron", sans-serif', google: "Orbitron:wght@400;700" },
  { id: "jetbrains", labelKey: "fonts.mono", stack: '"JetBrains Mono", monospace', google: "JetBrains+Mono:wght@400;700" },
  { id: "quicksand", labelKey: "fonts.round", stack: '"Quicksand"' + FALLBACK, google: "Quicksand:wght@400;600;700" },
  { id: "montserrat", labelKey: "fonts.bold", stack: '"Montserrat"' + FALLBACK, google: "Montserrat:wght@400;600;700" },
];

function preset(id: string): FontPreset {
  return FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0];
}

/** Resolve a font selection (preset id or "custom" + a Google Font name). */
function resolve(id: string, custom: string): { stack: string; google: string | null } {
  if (id === "custom" && custom.trim()) {
    const name = custom.trim();
    return {
      stack: `"${name}"${FALLBACK}`,
      google: `${name.replace(/\s+/g, "+")}:wght@400;600;700`,
    };
  }
  const p = preset(id);
  return { stack: p.stack, google: p.google };
}

function ensureGoogleFontLink(families: string[]) {
  const id = "newtab-google-fonts";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (families.length === 0) {
    link?.remove();
    return;
  }
  const href =
    "https://fonts.googleapis.com/css2?" +
    families.map((f) => `family=${f}`).join("&") +
    "&display=swap";
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

export function useFontEngine(): void {
  const core = useFeatureValues(CORE_FEATURE_ID);
  const headingId = (core.fontHeading as string) ?? "system";
  const bodyId = (core.fontBody as string) ?? "system";
  const headingCustom = (core.fontHeadingCustom as string) ?? "";
  const bodyCustom = (core.fontBodyCustom as string) ?? "";

  useEffect(() => {
    const h = resolve(headingId, headingCustom);
    const b = resolve(bodyId, bodyCustom);
    const root = document.documentElement.style;
    root.setProperty("--font-heading", h.stack);
    root.setProperty("--font-body", b.stack);

    const families = [h.google, b.google].filter((g): g is string => !!g);
    ensureGoogleFontLink([...new Set(families)]);
  }, [headingId, bodyId, headingCustom, bodyCustom]);
}
