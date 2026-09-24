import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { ClearLogEntry } from "./engine/types";

export function ClearLogTable({ entries }: { entries: ClearLogEntry[] }) {
  const { t } = useTranslation();

  if (entries.length === 0) return <p className="acc__log-empty">{t("autoClearCache.noLog")}</p>;

  return (
    <table className="acc__log">
      <thead>
        <tr>
          <th>{t("autoClearCache.logTime")}</th>
          <th>{t("autoClearCache.logTrigger")}</th>
          <th>{t("autoClearCache.logTypes")}</th>
          <th>{t("autoClearCache.logResult")}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.ranAt).toLocaleString()}</td>
            <td>{e.trigger === "manual" ? t("autoClearCache.triggerManual") : t("autoClearCache.triggerScheduled")}</td>
            <td>{e.dataTypes.length > 0 ? e.dataTypes.map((k) => t(`autoClearCache.type.${k}`)).join(", ") : "—"}</td>
            <td className={e.success ? "acc__log-ok" : "acc__log-fail"} title={e.errorMessage}>
              {e.success ? <Check size={14} /> : <X size={14} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
