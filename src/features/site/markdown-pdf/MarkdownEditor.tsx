import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EditorView } from "codemirror";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { DocList } from "./DocList";
import { SourcePane, scrollSourceTo } from "./SourcePane";
import { PreviewPane, type PreviewPaneHandle } from "./PreviewPane";
import { FormatToolbar } from "./FormatToolbar";
import { SplitDivider, loadSplitRatio } from "./SplitDivider";
import { PrintLayer } from "./PrintLayer";
import { ExportPdfButton } from "./ExportPdfButton";
import { renderMarkdown } from "./engine/render";
import { useHashRoute } from "@/core/router/useHashRoute";
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from "./engine/paper";
import { getDoc, saveDoc } from "./engine/store";
import { newDoc, titleFromSource, type MarkdownDoc } from "./engine/types";
import "./markdown-pdf.css";

const PREVIEW_DEBOUNCE_MS = 150;
const AUTOSAVE_DEBOUNCE_MS = 800;

export default function MarkdownEditor() {
  const { t } = useTranslation();
  const { segments, navigate: nav } = useHashRoute();
  const routeDocId = segments[1];

  const [doc, setDoc] = useState<MarkdownDoc | null>(null);
  const [source, setSource] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  /** bumped to force the print layer to re-measure before the dialog opens */
  const [printRevision, setPrintRevision] = useState(0);
  const [view, setView] = useState<EditorView | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<PreviewPaneHandle>(null);
  const syncingRef = useRef(false);
  const viewRef = useRef<EditorView | null>(null);

  // ---- preview re-render, debounced so fast typing does not re-parse every keystroke ----
  useEffect(() => {
    const id = setTimeout(() => setHtml(renderMarkdown(source)), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [source]);

  // ---- autosave, same cadence Audio Editor uses ----
  useEffect(() => {
    if (!doc) return;
    setSaving(true);
    const id = setTimeout(() => {
      const updated: MarkdownDoc = { ...doc, source, title: titleFromSource(source, doc.title), updatedAt: Date.now() };
      void saveDoc(updated).then(() => setSaving(false));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `source` should re-trigger the timer; `doc` changes come from opening a different document, handled by openDoc directly
  }, [source]);

  const openDoc = useCallback((d: MarkdownDoc) => {
    setDoc(d);
    setSource(d.source);
    setHtml(renderMarkdown(d.source));
    nav(`/markdown-pdf/${d.id}`);
  }, [nav]);

  useEffect(() => {
    if (routeDocId) {
      if (doc?.id !== routeDocId) {
        void getDoc(routeDocId).then((found) => {
          if (found) {
            setDoc(found);
            setSource(found.source);
            setHtml(renderMarkdown(found.source));
          }
        });
      }
    } else {
      if (doc) setDoc(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDocId]);

  const createDoc = useCallback(() => {
    openDoc(newDoc());
  }, [openDoc]);

  const importDoc = useCallback(
    (title: string, source: string) => {
      openDoc({ id: crypto.randomUUID(), title: titleFromSource(source, title), source, updatedAt: Date.now() });
    },
    [openDoc],
  );

  // ---- two-way scroll sync — a `syncing` flag stops the loop, docs/roadmap/02 §2.3 ----
  const onSourceScroll = useCallback((ratio: number) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    previewRef.current?.scrollTo(ratio);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const onPreviewScroll = useCallback((ratio: number) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (viewRef.current) scrollSourceTo(viewRef.current, ratio);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  if (!doc) {
    return <DocList onOpen={openDoc} onImport={importDoc} onCreate={createDoc} />;
  }

  return (
    <div className="mdp">
      <header className="mdp__header">
        <IconButton
          label={t("common.back")}
          onClick={() => {
            setDoc(null);
            nav("/markdown-pdf");
          }}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <span className="mdp__doc-title">{doc.title || t("markdownPdf.untitled")}</span>
        <span className="mdp__save-state">
          {saving ? (
            <>
              <Loader2 size={13} className="mdp__spin" />
              {t("markdownPdf.saving")}
            </>
          ) : (
            <>
              <Check size={13} />
              {t("markdownPdf.saved")}
            </>
          )}
        </span>
        <Button
          size="sm"
          onClick={() => {
            setSaving(true);
            void saveDoc({ ...doc, source, title: titleFromSource(source, doc.title), updatedAt: Date.now() }).then(() =>
              setSaving(false),
            );
          }}
        >
          {t("markdownPdf.saveNow")}
        </Button>
        <FormatToolbar view={view} />
        <ExportPdfButton
          settings={printSettings}
          onSettingsChange={setPrintSettings}
          onBeforePrint={async () => {
            // the preview is debounced, so the very latest keystrokes may not
            // be in `html` yet — render synchronously for the print copy
            setHtml(renderMarkdown(source));
            setPrintRevision((n) => n + 1);
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }}
        />
      </header>

      <div className="mdp__split" ref={containerRef} style={{ gridTemplateColumns: `${splitRatio}fr 4px ${1 - splitRatio}fr` }}>
        <SourcePane
          source={source}
          onChange={setSource}
          onScroll={onSourceScroll}
          onViewReady={(v) => {
            viewRef.current = v;
            setView(v);
          }}
        />
        <SplitDivider containerRef={containerRef} ratio={splitRatio} onChange={setSplitRatio} />
        <PreviewPane ref={previewRef} html={html} onScroll={onPreviewScroll} />
      </div>

      <PrintLayer
        title={doc.title || t("markdownPdf.untitled")}
        html={html}
        settings={printSettings}
        revision={printRevision}
      />
    </div>
  );
}
