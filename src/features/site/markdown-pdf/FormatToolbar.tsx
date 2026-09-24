import { useTranslation } from "react-i18next";
import type { EditorView } from "codemirror";
import { Bold, Code, Italic, Link2, List, Quote } from "lucide-react";
import { IconButton } from "@/shared/ui";

/** Wrap the selection in `before`/`after` (or insert both at the cursor with nothing selected) via `EditorView.dispatch()` — never hand-rolled text splicing. */
function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
  view.focus();
}

/** Prefix every selected line (or the current line) with `prefix` — for list/quote toggles. */
function prefixLines(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes = [];
  for (let n = startLine.number; n <= endLine.number; n++) {
    const line = view.state.doc.line(n);
    changes.push({ from: line.from, insert: prefix });
  }
  view.dispatch({ changes });
  view.focus();
}

export function FormatToolbar({ view }: { view: EditorView | null }) {
  const { t } = useTranslation();
  if (!view) return null;

  return (
    <div className="mdp__toolbar">
      <IconButton label={t("markdownPdf.bold")} onClick={() => wrapSelection(view, "**", "**")}>
        <Bold size={15} />
      </IconButton>
      <IconButton label={t("markdownPdf.italic")} onClick={() => wrapSelection(view, "_", "_")}>
        <Italic size={15} />
      </IconButton>
      <IconButton label={t("markdownPdf.code")} onClick={() => wrapSelection(view, "`", "`")}>
        <Code size={15} />
      </IconButton>
      <IconButton label={t("markdownPdf.link")} onClick={() => wrapSelection(view, "[", "](https://)")}>
        <Link2 size={15} />
      </IconButton>
      <IconButton label={t("markdownPdf.list")} onClick={() => prefixLines(view, "- ")}>
        <List size={15} />
      </IconButton>
      <IconButton label={t("markdownPdf.quote")} onClick={() => prefixLines(view, "> ")}>
        <Quote size={15} />
      </IconButton>
    </div>
  );
}
