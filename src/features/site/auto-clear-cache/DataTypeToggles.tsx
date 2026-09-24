import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { Toggle } from "@/shared/ui";
import type { ClearDataTypes } from "./engine/types";
import { DATA_TYPE_KEYS } from "./engine/types";

/** One Toggle per data type — cookies gets an inline warning the first time it's turned on, docs/roadmap/06 §2 step 3. */
export function DataTypeToggles({
  value,
  onChange,
  blockedKeys,
}: {
  value: ClearDataTypes;
  onChange: (next: ClearDataTypes) => void;
  /** types an enterprise policy blocks (`browsingData.settings().dataRemovalPermitted`) — a toggle here would do nothing, so it's disabled with an explanation instead of silently no-op'ing */
  blockedKeys?: Set<keyof ClearDataTypes>;
}) {
  const { t } = useTranslation();
  const [showCookieWarning, setShowCookieWarning] = useState(false);

  const set = (key: keyof ClearDataTypes, checked: boolean) => {
    if (key === "cookies" && checked) setShowCookieWarning(true);
    onChange({ ...value, [key]: checked });
  };

  return (
    <div className="acc__types">
      {DATA_TYPE_KEYS.map((key) => {
        const blocked = blockedKeys?.has(key) ?? false;
        return (
          <div key={key} className="acc__type-row">
            <label className="acc__type-label">
              <Toggle checked={value[key] && !blocked} onChange={(v) => set(key, v)} disabled={blocked} />
              <span>{t(`autoClearCache.type.${key}`)}</span>
            </label>
            <span className="acc__type-desc">{blocked ? t("autoClearCache.blockedByPolicy") : t(`autoClearCache.typeDesc.${key}`)}</span>
          </div>
        );
      })}
      {showCookieWarning && value.cookies && (
        <p className="acc__cookie-warning">
          <TriangleAlert size={14} />
          {t("autoClearCache.cookieWarning")}
        </p>
      )}
    </div>
  );
}
