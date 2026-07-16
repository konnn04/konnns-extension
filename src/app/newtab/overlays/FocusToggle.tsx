import { useEffect } from "react";
import { Focus, ScanEye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFocusMode } from "@/core/focus";
import "./focus.css";

export function FocusToggle() {
  const { t } = useTranslation();
  const { active, toggle } = useFocusMode();

  useEffect(() => {
    document.documentElement.dataset.focus = active ? "true" : "false";
  }, [active]);

  return (
    <div className="focus-trigger-zone">
      <button
        type="button"
        className={`focus-trigger ${active ? "focus-trigger--active" : ""}`}
        aria-pressed={active}
        aria-label={t("focus.toggle")}
        title={t("focus.toggle")}
        onClick={toggle}
      >
        {active ? <ScanEye size={20} /> : <Focus size={20} />}
      </button>
    </div>
  );
}
