import { useTranslation } from "react-i18next";
import { Select } from "@/shared/ui";
import type { ClearFrequency } from "./engine/types";

export function ScheduleSelect({ value, onChange }: { value: ClearFrequency; onChange: (v: ClearFrequency) => void }) {
  const { t } = useTranslation();
  return (
    <Select<ClearFrequency>
      value={value}
      onChange={onChange}
      options={[
        { value: "hourly", label: t("autoClearCache.freqHourly") },
        { value: "daily", label: t("autoClearCache.freqDaily") },
        { value: "weekly", label: t("autoClearCache.freqWeekly") },
        { value: "onBrowserClose", label: t("autoClearCache.freqOnClose") },
      ]}
    />
  );
}
