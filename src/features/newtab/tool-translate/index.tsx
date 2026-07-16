import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Copy, Languages, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { Combobox, IconButton } from "@/shared/ui";
import { LANGUAGES } from "./languages";
import { translate } from "./api";
import "./translate.css";

export const TRANSLATE_FEATURE_ID = "tool-translate";

const OPTIONS = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));

function ToolTranslate() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const values = useFeatureValues(TRANSLATE_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);

  const from = (values.sourceLang as string) ?? "en";
  const to = (values.targetLang as string) ?? "vi";

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const reqId = useRef(0);

  const setFrom = (v: string) => setValue(TRANSLATE_FEATURE_ID, "sourceLang", v);
  const setTo = (v: string) => setValue(TRANSLATE_FEATURE_ID, "targetLang", v);

  const run = useCallback(
    async (text: string, f: string, tgt: string) => {
      const id = ++reqId.current;
      if (!text.trim()) {
        setOutput("");
        setBusy(false);
        setError(false);
        return;
      }
      setBusy(true);
      setError(false);
      try {
        const res = await translate(text, f, tgt);
        if (id === reqId.current) setOutput(res);
      } catch {
        if (id === reqId.current) {
          setError(true);
          setOutput("");
        }
      } finally {
        if (id === reqId.current) setBusy(false);
      }
    },
    [],
  );

  // debounce auto-translate as the user types / changes languages
  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      return;
    }
    const h = window.setTimeout(() => void run(input, from, to), 550);
    return () => window.clearTimeout(h);
  }, [input, from, to, run]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    // move the current translation up so it can be re-translated back
    setInput(output);
    setOutput(input);
  };

  const copyOut = () => {
    if (!output) return;
    void navigator.clipboard?.writeText(output).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="xlate">
      <div className="xlate__bar">
        <Combobox
          value={[from]}
          onChange={(v) => v[0] && setFrom(v[0])}
          options={OPTIONS}
          searchPlaceholder={t("translate.search")}
          className="xlate__lang"
        />
        <IconButton label={t("translate.swap")} className="xlate__swap" onClick={swap}>
          <ArrowLeftRight size={16} />
        </IconButton>
        <Combobox
          value={[to]}
          onChange={(v) => v[0] && setTo(v[0])}
          options={OPTIONS}
          searchPlaceholder={t("translate.search")}
          className="xlate__lang"
        />
      </div>

      <textarea
        className="xlate__input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("translate.inputPlaceholder")}
        rows={4}
      />

      <div className="xlate__output-wrap">
        <div className="xlate__output" aria-live="polite">
          {busy ? (
            <span className="xlate__loading">
              <Loader2 size={16} className="xlate__spin" /> {t("translate.translating")}
            </span>
          ) : error ? (
            <span className="xlate__error">
              {online ? t("translate.failed") : t("translate.offline")}
            </span>
          ) : (
            output || <span className="xlate__placeholder">{t("translate.outputPlaceholder")}</span>
          )}
        </div>
        {output && !busy && (
          <IconButton label={t("common.copy")} className="xlate__copy" onClick={copyOut}>
            <Copy size={15} />
          </IconButton>
        )}
      </div>
      {copied && <div className="xlate__copied">{t("translate.copied")}</div>}
    </div>
  );
}

registerFeature({
  id: TRANSLATE_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-translate",
  icon: Languages,
  defaultEnabled: false,
  requiresNetwork: true,
  component: ToolTranslate,
  order: 7,
});

export default ToolTranslate;
