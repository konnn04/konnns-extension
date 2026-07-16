import { useEffect, useState } from "react";
import { CircleUserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { getAvatarUrl } from "./store";
import { avatarSettingsSchema } from "./settings.schema";
import { AvatarManager } from "./AvatarManager";
import "./avatar.css";

export const AVATAR_FEATURE_ID = "avatar";

interface AvatarValues {
  [key: string]: unknown;
  activeId?: string;
  shape?: string;
  size?: number;
  showGreeting?: boolean;
  greetingName?: string;
}

function Avatar() {
  const { t } = useTranslation();
  const values = useFeatureValues<AvatarValues>(AVATAR_FEATURE_ID);
  const [url, setUrl] = useState<string | null>(null);
  const activeId = values.activeId ?? "";
  const size = values.size ?? 96;
  const shape = values.shape ?? "circle";

  useEffect(() => {
    let current: string | null = null;
    if (!activeId) {
      setUrl(null);
      return;
    }
    void getAvatarUrl(activeId).then((u) => {
      current = u;
      setUrl(u);
    });
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [activeId]);

  // nothing chosen yet → render nothing (keeps center zone clean)
  if (!url) return null;

  return (
    <div className="avatar">
      <div
        className={`avatar__frame avatar__frame--${shape}`}
        style={{ width: size, height: size }}
      >
        <img className="avatar__img" src={url} alt={t("features.avatar")} />
      </div>
      {values.showGreeting && values.greetingName && (
        <div className="avatar__greeting">{values.greetingName}</div>
      )}
    </div>
  );
}

registerFeature({
  id: AVATAR_FEATURE_ID,
  zone: "center",
  nameKey: "features.avatar",
  icon: CircleUserRound,
  defaultEnabled: false,
  settingsSchema: avatarSettingsSchema,
  settingsExtra: AvatarManager,
  component: Avatar,
  order: 0, // renders above the clock (clock is order 1)
});

export default Avatar;
