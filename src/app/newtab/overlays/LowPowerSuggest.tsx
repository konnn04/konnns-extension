import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BatteryLow, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { Button, IconButton } from "@/shared/ui";
import "./low-power-suggest.css";

const DISMISS_KEY = "newtab.lowPowerSuggestDismissed";

/**
 * Detects OS-level `prefers-reduced-motion` and *suggests* Low-power mode
 * (docs/phase-5 §3 — suggest, never force). Shown once until dismissed/enabled.
 */
export function LowPowerSuggest() {
  const { t } = useTranslation();
  const core = useFeatureValues(CORE_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setShow(reduced && core.lowPower !== true && !dismissed);
  }, [core.lowPower]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="lp-suggest"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <BatteryLow size={18} className="lp-suggest__icon" />
          <span className="lp-suggest__text">{t("settings.lowPowerSuggest")}</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setValue(CORE_FEATURE_ID, "lowPower", true);
              dismiss();
            }}
          >
            {t("common.enable")}
          </Button>
          <IconButton label={t("common.close")} onClick={dismiss}>
            <X size={16} />
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
