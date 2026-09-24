import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ArrowLeft, ExternalLink, Minimize2, Pencil } from "lucide-react";
import { IconButton } from "@/shared/ui";
import { useHashRoute } from "@/core/router/useHashRoute";
import { siteUrl } from "@/core/messaging";
import { ExportMenu } from "./ExportMenu";

/** The one bar this tool owns — everything else on screen is Excalidraw's own floating toolbar. Docs/roadmap/03-whiteboard.md §2/§3. */
export function BoardToolbar({
  boardId,
  name,
  onRename,
  onBack,
  api,
}: {
  boardId?: string;
  name: string;
  onRename: (name: string) => void;
  onBack: () => void;
  api: ExcalidrawImperativeAPI | null;
}) {
  const { t } = useTranslation();
  const route = useHashRoute();
  const isZen = route.query.zen === "1";
  const [draft, setDraft] = useState<string | null>(null);

  const done = () => {
    if (draft === null) return;
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    setDraft(null);
  };

  const handleOpenTab = () => {
    if (isZen) {
      route.navigate(`/whiteboard/${boardId || ""}`);
    } else {
      const url = siteUrl(`/whiteboard/${boardId || ""}?zen=1`);
      window.open(url, "_blank");
    }
  };

  return (
    <header className="wb__toolbar">
      <IconButton label={t("whiteboard.backToList")} onClick={onBack}>
        <ArrowLeft size={16} />
      </IconButton>

      {draft === null ? (
        <button type="button" className="wb__title" title={t("whiteboard.renameBoard")} onClick={() => setDraft(name)}>
          <strong>{name || t("whiteboard.untitled")}</strong>
          <Pencil size={12} />
        </button>
      ) : (
        <input
          className="wb__title-input"
          autoFocus
          value={draft}
          aria-label={t("whiteboard.renameBoard")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => {
            if (e.key === "Enter") done();
            if (e.key === "Escape") setDraft(null);
          }}
        />
      )}

      <span className="wb__spacer" />
      <IconButton
        label={isZen ? t("whiteboard.exitZenMode") : t("whiteboard.openInNewTab")}
        title={isZen ? t("whiteboard.exitZenMode") : t("whiteboard.openInNewTab")}
        onClick={handleOpenTab}
      >
        {isZen ? <Minimize2 size={16} /> : <ExternalLink size={16} />}
      </IconButton>
      <ExportMenu api={api} boardName={name} />
    </header>
  );
}
