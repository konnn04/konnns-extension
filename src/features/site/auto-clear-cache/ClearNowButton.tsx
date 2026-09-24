import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui";
import { runClear } from "./background/autoClear";
import type { ClearLogEntry } from "./engine/types";

/** `chrome.browsingData.remove()` is quick enough in practice not to need the activity channel — docs/roadmap/06 §3. */
export function ClearNowButton({ onDone }: { onDone: (entry: ClearLogEntry) => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  const run = async () => {
    setState("running");
    const entry = await runClear("manual");
    onDone(entry);
    setState("done");
    setTimeout(() => setState("idle"), 1600);
  };

  return (
    <Button variant="primary" disabled={state === "running"} onClick={() => void run()}>
      {state === "done" ? <Check size={15} /> : <Trash2 size={15} />}
      {state === "running" ? t("autoClearCache.running") : t("autoClearCache.clearNow")}
    </Button>
  );
}
