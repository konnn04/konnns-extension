import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { Button, TextInput } from "@/shared/ui";
import { extractPageText, loadPage, openPdf, PdfLoadError, PdfPasswordRequired, renderPageToCanvas } from "./engine/extract";
import { disposeOcrWorker, ocrImage } from "./engine/ocr";
import { emptyWorkspace, type OcrLanguage, type PageStatus, type PdfWorkspace } from "./engine/types";
import { PdfDropzone } from "./PdfDropzone";
import { PageList } from "./PageList";
import { PageViewer } from "./PageViewer";
import { ExportMenu } from "./ExportMenu";
import "./pdf-to-text.css";

const SCAN_THRESHOLD = 0.9; // >90% of pages empty => "looks like a scan", docs/roadmap/01 §2

export default function PdfToText() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<PdfWorkspace>(emptyWorkspace());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>("eng");
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const extractionToken = useRef(0);

  useEffect(
    () => () => {
      void docRef.current?.loadingTask.destroy();
      void disposeOcrWorker();
    },
    [],
  );

  const patchPage = useCallback((n: number, status: PageStatus) => {
    setWs((prev) => {
      const pages = new Map(prev.pages);
      pages.set(n, status);
      return { ...prev, pages };
    });
  }, []);

  const runExtraction = useCallback(
    async (doc: PDFDocumentProxy, pageCount: number, activeFirst: number, token: number) => {
      const order = [activeFirst, ...Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n !== activeFirst)];
      let emptyCount = 0;
      for (const n of order) {
        if (extractionToken.current !== token) return; // superseded by a newer file
        try {
          const page = await loadPage(doc, n);
          const status = await extractPageText(page);
          if (status.kind === "empty") emptyCount++;
          patchPage(n, status);
        } catch (err) {
          patchPage(n, { kind: "error", message: err instanceof Error ? err.message : "extraction failed" });
        }
      }
      if (extractionToken.current === token) {
        setWs((prev) => ({ ...prev, looksLikeScan: emptyCount / pageCount > SCAN_THRESHOLD, busy: false }));
      }
    },
    [patchPage],
  );

  const openFile = useCallback(
    async (file: File, password?: string) => {
      const token = ++extractionToken.current;
      setWs((prev) => ({ ...emptyWorkspace(), busy: true, activePage: prev.activePage || 1 }));
      try {
        const bytes = await file.arrayBuffer();
        const { doc, meta } = await openPdf(bytes, file.name, password);
        if (extractionToken.current !== token) {
          void doc.loadingTask.destroy();
          return;
        }
        void docRef.current?.loadingTask.destroy();
        docRef.current = doc;
        setPendingFile(null);
        setWs({
          doc: meta,
          pages: new Map(Array.from({ length: meta.pageCount }, (_, i) => [i + 1, { kind: "pending" } as PageStatus])),
          activePage: 1,
          looksLikeScan: false,
          busy: true,
          error: null,
          needsPassword: false,
          passwordError: null,
        });
        void runExtraction(doc, meta.pageCount, 1, token);
      } catch (err) {
        if (err instanceof PdfPasswordRequired) {
          setPendingFile(file);
          setWs((prev) => ({ ...prev, busy: false, needsPassword: true, passwordError: password ? t("pdfText.wrongPassword") : null }));
          return;
        }
        const message = err instanceof PdfLoadError ? err.message : t("pdfText.openError");
        setWs({ ...emptyWorkspace(), error: message });
      }
    },
    [runExtraction, t],
  );

  const [confirmReplace, setConfirmReplace] = useState<File | null>(null);

  const handleDrop = useCallback(
    (file: File) => {
      if (ws.doc) {
        setConfirmReplace(file);
        return;
      }
      void openFile(file);
    },
    [ws.doc, openFile],
  );

  const setActivePage = useCallback((n: number) => {
    setWs((prev) => ({ ...prev, activePage: n }));
  }, []);

  const runOcr = useCallback(
    async (pages: number[]) => {
      const doc = docRef.current;
      if (!doc) return;
      for (const n of pages) {
        patchPage(n, { kind: "ocr-pending", progress: 0 });
        try {
          const page = await loadPage(doc, n);
          const canvas = await renderPageToCanvas(page);
          const result = await ocrImage(canvas, ocrLanguage, (progress) => patchPage(n, { kind: "ocr-pending", progress }));
          patchPage(n, { kind: "ocr-done", text: result.text, confidence: result.confidence });
        } catch (err) {
          patchPage(n, { kind: "error", message: err instanceof Error ? err.message : "OCR failed" });
        }
      }
    },
    [ocrLanguage, patchPage],
  );

  const ocrWholeDocument = useCallback(() => {
    const pending = [...ws.pages.entries()].filter(([, s]) => s.kind === "empty").map(([n]) => n);
    void runOcr(pending);
  }, [ws.pages, runOcr]);

  if (ws.needsPassword) {
    return (
      <div className="pdftxt pdftxt--center">
        <form
          className="pdftxt__password"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("password") as HTMLInputElement;
            if (pendingFile) void openFile(pendingFile, input.value);
          }}
        >
          <h2>{t("pdfText.passwordTitle")}</h2>
          <TextInput name="password" type="password" autoFocus placeholder={t("pdfText.passwordPlaceholder")} />
          {ws.passwordError && <p className="pdftxt__error">{ws.passwordError}</p>}
          <Button type="submit" variant="primary">
            {t("common.confirm")}
          </Button>
        </form>
      </div>
    );
  }

  if (!ws.doc) {
    return (
      <div className="pdftxt pdftxt--center">
        <PdfDropzone onFile={handleDrop} error={ws.error} />
      </div>
    );
  }

  return (
    <div className="pdftxt">
      {confirmReplace && (
        <div className="pdftxt__modal-backdrop" onClick={() => setConfirmReplace(null)}>
          <div className="pdftxt__modal" onClick={(e) => e.stopPropagation()}>
            <p>{t("pdfText.confirmReplace")}</p>
            <div className="pdftxt__modal-actions">
              <Button onClick={() => setConfirmReplace(null)}>{t("common.cancel")}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const f = confirmReplace;
                  setConfirmReplace(null);
                  if (f) void openFile(f);
                }}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="pdftxt__header">
        <div className="pdftxt__title" title={ws.doc.fileName}>
          {ws.doc.fileName}
        </div>
        <ExportMenu workspace={ws} />
      </header>

      <div className="pdftxt__body">
        <PageList workspace={ws} onSelect={setActivePage} onDropReplace={handleDrop} onOcrDocument={ocrWholeDocument} />
        <PageViewer
          workspace={ws}
          ocrLanguage={ocrLanguage}
          onOcrLanguageChange={setOcrLanguage}
          onOcrPage={(n) => void runOcr([n])}
          onOcrDocument={ocrWholeDocument}
        />
      </div>
    </div>
  );
}
