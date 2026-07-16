import { useRef, useState } from "react";
import { Smile } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { EMOJI_CATEGORIES } from "./emojis";
import "./emoji.css";

export const EMOJI_FEATURE_ID = "tool-emoji";

function ToolEmoji() {
  const { t } = useTranslation();
  const [cat, setCat] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copy = (emoji: string) => {
    void navigator.clipboard?.writeText(emoji).catch(() => {});
    setCopied(emoji);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="emoji-picker">
      <div className="emoji-picker__tabs">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            className={`emoji-picker__tab ${i === cat ? "emoji-picker__tab--active" : ""}`}
            onClick={() => setCat(i)}
            title={c.id}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-picker__grid">
        {EMOJI_CATEGORIES[cat].emojis.map((e, i) => (
          <button key={`${e}-${i}`} className="emoji-picker__btn" onClick={() => copy(e)}>
            {e}
          </button>
        ))}
      </div>
      <div className="emoji-picker__copied">
        {copied ? `${copied}  ${t("emoji.copied")}` : ""}
      </div>
    </div>
  );
}

registerFeature({
  id: EMOJI_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-emoji",
  icon: Smile,
  defaultEnabled: false,
  component: ToolEmoji,
  order: 6,
});

export default ToolEmoji;
