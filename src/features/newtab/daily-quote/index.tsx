import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleHeart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { defineSchema } from "@/core/settings-engine/schema";
import { IconButton } from "@/shared/ui";
import { X } from "lucide-react";
import { getDailyQuote, greetingKey, type Quote } from "./api";
import "./daily-quote.css";

export const DAILY_QUOTE_FEATURE_ID = "daily-quote";

const dailyQuoteSchema = defineSchema({
  showQuote: { type: "toggle", label: "dailyQuote.showQuote", default: true },
  autoHide: { type: "toggle", label: "dailyQuote.autoHide", description: "dailyQuote.autoHideDesc", default: true },
});

function DailyQuote() {
  const { t } = useTranslation();
  const values = useFeatureValues(DAILY_QUOTE_FEATURE_ID);
  const showQuote = values.showQuote !== false;
  const autoHide = values.autoHide !== false;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    void getDailyQuote().then(setQuote);
  }, []);

  useEffect(() => {
    if (!autoHide) return;
    const id = window.setTimeout(() => setVisible(false), 15000);
    return () => window.clearTimeout(id);
  }, [autoHide]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="daily-quote"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <IconButton label={t("common.close")} className="daily-quote__close" onClick={() => setVisible(false)}>
            <X size={16} />
          </IconButton>
          <div className="daily-quote__greeting">{t(greetingKey())} 👋</div>
          {showQuote && quote && (
            <>
              <div className="daily-quote__text">“{quote.text}”</div>
              {quote.author && <div className="daily-quote__author">— {quote.author}</div>}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

registerFeature({
  id: DAILY_QUOTE_FEATURE_ID,
  zone: "center",
  nameKey: "features.daily-quote",
  icon: MessageCircleHeart,
  defaultEnabled: false,
  requiresNetwork: true,
  settingsSchema: dailyQuoteSchema,
  component: DailyQuote,
  order: 5,
});

export default DailyQuote;
