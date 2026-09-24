import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Loader } from "lucide-react";
import { getSnapshot, subscribe } from "./engine/activity";
import { Button } from "@/shared/ui";

/**
 * "The editor is busy, and here is what it is busy with."
 *
 * It reads the activity channel directly rather than going through the editor
 * store, so a long render does not re-render the timeline while it runs.
 *
 * The elapsed counter matters more than it looks: a bar that only spins tells
 * you nothing about whether anything is still happening, whereas a number that
 * keeps climbing is the difference between "working" and "hung". If the main
 * thread really is blocked the counter freezes too — which is itself the
 * answer to "is it stuck?".
 */
export function ActivityBanner() {
  const { t } = useTranslation();
  const activity = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activity) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed((performance.now() - activity.startedAt) / 1000);
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [activity]);

  if (!activity) return null;

  const percent = activity.value === null ? null : Math.round(activity.value * 100);

  return (
    <div className="ae__activity" role="status" aria-live="polite">
      <Loader size={14} className="ae__activity-spin" />
      <span className="ae__activity-label">{t(activity.labelKey)}</span>

      <div className="ae__progress">
        <div
          className={`ae__progress-bar ${percent === null ? "ae__progress-bar--indeterminate" : ""}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>

      <span className="ae__activity-time">
        {percent === null ? `${elapsed.toFixed(1)}s` : `${percent}%`}
      </span>

      {activity.cancel && (
        <Button size="sm" onClick={activity.cancel}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}
