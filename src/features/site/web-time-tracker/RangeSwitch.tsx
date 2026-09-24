import { useTranslation } from "react-i18next";
import { Segmented } from "@/shared/ui";
import type { DashboardRange } from "./engine/range";

export function RangeSwitch({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (value: DashboardRange) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      value={value}
      onChange={(v) => onChange(v as DashboardRange)}
      options={[
        { value: "today", label: t("timeTracker.rangeToday") },
        { value: "week", label: t("timeTracker.rangeWeek") },
        { value: "30days", label: t("timeTracker.range30Days") },
      ]}
    />
  );
}
