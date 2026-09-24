import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";

/**
 * Bare CodeMirror 6 — docs/roadmap/02-markdown-pdf.md §5, chosen over
 * `@uiw/react-md-editor` specifically so nothing here can reach for an
 * outside font/asset, and so there is exactly one markdown renderer in the
 * tool (`engine/render.ts`) rather than one for editing and a different one
 * baked into a wrapper package.
 *
 * Undo/redo is `basicSetup`'s built-in `history()` + `historyKeymap` — see
 * §4 of the same doc for why that is the right call here (a linear string,
 * unlike Audio Editor's clip tree).
 */
export function SourcePane({
  source,
  onChange,
  onScroll,
  onViewReady,
}: {
  source: string;
  onChange: (source: string) => void;
  onScroll: (ratio: number) => void;
  onViewReady: (view: EditorView) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: source,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    onViewReady(view);

    const scroller = view.scrollDOM;
    const onScrollEvt = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      onScrollRef.current(max > 0 ? scroller.scrollTop / max : 0);
    };
    scroller.addEventListener("scroll", onScrollEvt);

    return () => {
      scroller.removeEventListener("scroll", onScrollEvt);
      view.destroy();
      viewRef.current = null;
    };
    // mount once — `source` here only seeds the initial doc; later external
    // changes (opening a different document) go through the imperative
    // effect below so typing does not fight the editor's own state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === source) return; // this change came FROM the editor, not to it
    view.dispatch({ changes: { from: 0, to: current.length, insert: source } });
  }, [source]);

  return <div className="mdp__source" ref={hostRef} />;
}

/** Set the scroller's scrollTop from an external ratio (the preview pane leading) without re-firing onScroll in a loop — caller is responsible for the "syncing" guard. */
export function scrollSourceTo(view: EditorView, ratio: number): void {
  const scroller = view.scrollDOM;
  const max = scroller.scrollHeight - scroller.clientHeight;
  scroller.scrollTop = max * ratio;
}
