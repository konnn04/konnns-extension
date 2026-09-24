import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { Field, Select } from "@/shared/ui";

/**
 * Language and colour mode, reachable from the site itself.
 *
 * The site shares the NewTab's settings store, so it already FOLLOWED those
 * choices — but there was no way to make one without leaving for the NewTab,
 * which is a strange trip when the site is a surface of its own.
 *
 * Deliberately only the two settings that change how this page reads. The
 * full settings modal is a NewTab component wired to feature registries the
 * site does not host; dragging it over here would couple the two surfaces to
 * save one click.
 */
export function QuickSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const setValue = useSettingsStore((s) => s.setValue);
  const values = useFeatureValues(CORE_FEATURE_ID);
  const language = (values.language as string) ?? "vi";
  const colorMode = (values.colorMode as string) ?? "system";

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (boxRef.current?.contains(el)) return;
      /**
       * Select renders its option list through a portal on document.body, so
       * by DOM containment a click on an option lands "outside" this popover.
       * Closing on it unmounted the Select before its own click handler ran —
       * which is why picking a language or theme appeared to do nothing.
       */
      if (el?.closest?.(".ui-select-menu")) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="site__settings" ref={boxRef}>
      <button
        type="button"
        className="site__settings-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t("site.quickSettings")}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings size={17} />
      </button>

      {open && (
        <div className="site__settings-pop" role="dialog" aria-label={t("site.quickSettings")}>
          <Field label={t("settings.language")}>
            <Select
              value={language}
              onChange={(v) => setValue(CORE_FEATURE_ID, "language", v)}
              options={[
                { value: "vi", label: "Tiếng Việt" },
                { value: "en", label: "English" },
              ]}
            />
          </Field>

          <Field label={t("settings.colorMode")}>
            <Select
              value={colorMode}
              onChange={(v) => setValue(CORE_FEATURE_ID, "colorMode", v)}
              options={[
                { value: "system", label: t("settings.colorModeSystem") },
                { value: "light", label: t("settings.colorModeLight") },
                { value: "dark", label: t("settings.colorModeDark") },
              ]}
            />
          </Field>

          <p className="site__settings-note">{t("site.openFullSettings")}</p>
        </div>
      )}
    </div>
  );
}
