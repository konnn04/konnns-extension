import { useEffect, useRef } from "react";
import { Bold, Italic, List, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { Button, IconButton } from "@/shared/ui";
import { useNoteStore } from "./store";
import "./notes.css";

export const NOTES_FEATURE_ID = "tool-notes";

function ToolNotes() {
  const { t } = useTranslation();
  const { items, activeId, loaded, load, add, setActive, updateContent, updateTitle, remove } =
    useNoteStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const active = items.find((i) => i.id === activeId) ?? null;

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const onInput = () => {
    if (!active || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateContent(active.id, html), 500);
  };

  const fmt = (cmd: string) => {
    document.execCommand(cmd);
    editorRef.current?.focus();
    onInput();
  };

  return (
    <div className="notes">
      <div className="notes__tabs">
        {items.map((n) => (
          <button
            key={n.id}
            className={`notes__tab ${n.id === activeId ? "notes__tab--active" : ""}`}
            onClick={() => setActive(n.id)}
          >
            {n.title.trim() || t("notes.untitled")}
          </button>
        ))}
        <IconButton label={t("notes.add")} className="notes__add" onClick={() => void add()}>
          <Plus size={16} />
        </IconButton>
      </div>

      {!active ? (
        <div className="notes__empty">
          {t("notes.empty")}
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button size="sm" variant="primary" onClick={() => void add()}>
              <Plus size={15} /> {t("notes.add")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <input
            key={activeId}
            className="notes__title"
            defaultValue={active.title}
            placeholder={t("notes.titlePlaceholder")}
            onChange={(e) => void updateTitle(active.id, e.target.value)}
          />
          <div className="notes__toolbar">
            <button className="notes__fmt" title="Bold" onClick={() => fmt("bold")}>
              <Bold size={13} />
            </button>
            <button className="notes__fmt" title="Italic" onClick={() => fmt("italic")}>
              <Italic size={13} />
            </button>
            <button
              className="notes__fmt"
              title="List"
              onClick={() => fmt("insertUnorderedList")}
            >
              <List size={13} />
            </button>
          </div>
          <div
            key={activeId}
            ref={editorRef}
            className="notes__editor"
            contentEditable
            data-placeholder={t("notes.placeholder")}
            onInput={onInput}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: active.content }}
          />
          <div className="notes__footer">
            <Button size="sm" variant="ghost" onClick={() => void remove(active.id)}>
              <Trash2 size={14} /> {t("common.delete")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

registerFeature({
  id: NOTES_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-notes",
  icon: NotebookPen,
  defaultEnabled: true,
  component: ToolNotes,
  order: 3,
});

export default ToolNotes;
