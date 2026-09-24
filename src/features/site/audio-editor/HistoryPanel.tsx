import { useTranslation } from "react-i18next";
import { Layers, TriangleAlert, X } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { useAudioEditor } from "./store";

/** Past this many steps the snapshot cache starts costing real memory. */
const FLATTEN_HINT_AT = 100;

/**
 * Browsable history — docs/site/01-audio-editor.md §6.3.
 *
 * Pure UI on top of the replay engine that already exists: jumping to step N
 * is `replay(source, ops.slice(0, N))`, the same call undo makes, so this
 * needed no change to the core beyond letting `cursor` move by more than one.
 */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const history = useAudioEditor((s) => s.history);
  const cursor = useAudioEditor((s) => s.cursor);
  const busy = useAudioEditor((s) => s.busy);
  const jumpTo = useAudioEditor((s) => s.jumpTo);
  const flattenBefore = useAudioEditor((s) => s.flattenBefore);

  return (
    <aside className="ae__history">
      <div className="ae__side-head">
        <h2>
          <Layers size={14} /> {t("audio.historyPanel")}
        </h2>
        <IconButton label={t("common.close")} onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>

      {history.length > FLATTEN_HINT_AT && (
        <div className="ae__history-warn">
          <TriangleAlert size={14} />
          <span>{t("audio.historyLong", { count: history.length })}</span>
          <Button size="sm" onClick={() => flattenBefore(cursor)}>
            {t("audio.flatten")}
          </Button>
        </div>
      )}

      <ol className="ae__history-list">
        <li>
          <button
            type="button"
            className={`ae__history-item ${cursor === 0 ? "ae__history-item--current" : ""}`}
            disabled={busy}
            onClick={() => void jumpTo(0)}
          >
            <span className="ae__history-no">0</span>
            <span>{t("audio.historyOriginal")}</span>
          </button>
        </li>
        {history.map((entry, i) => {
          const step = i + 1;
          return (
            <li key={step}>
              <button
                type="button"
                className={[
                  "ae__history-item",
                  step === cursor ? "ae__history-item--current" : "",
                  step > cursor ? "ae__history-item--undone" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={busy}
                onClick={() => void jumpTo(step)}
              >
                <span className="ae__history-no">{step}</span>
                <span>{t(entry.label.key, entry.label.params)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
