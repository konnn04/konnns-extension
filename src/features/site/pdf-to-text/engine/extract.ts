import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import { MIN_REAL_TEXT_CHARS, type PageStatus, type PdfDocumentMeta } from "./types";

/**
 * Worker setup — docs/roadmap/01-pdf-to-text.md §5, "Worker của pdf.js phải
 * tự host, không CDN". `new URL(..., import.meta.url)` makes Vite bundle the
 * worker as a same-origin asset instead of the CDN URL most pdf.js guides
 * point at (which the extension_pages CSP, `script-src 'self'`, would block).
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export class PdfPasswordRequired extends Error {
  constructor() {
    super("password required");
    this.name = "PdfPasswordRequired";
  }
}

export class PdfLoadError extends Error {}

/** Opens a PDF and returns the live document proxy plus its lightweight metadata. */
export async function openPdf(
  bytes: ArrayBuffer,
  fileName: string,
  password?: string,
): Promise<{ doc: PDFDocumentProxy; meta: PdfDocumentMeta }> {
  const task = pdfjsLib.getDocument({ data: bytes, password });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (err) {
    // pdf.js's own PasswordException carries `.name === "PasswordException"`
    if (err instanceof Error && err.name === "PasswordException") {
      throw new PdfPasswordRequired();
    }
    throw new PdfLoadError(err instanceof Error ? err.message : "could not open PDF");
  }
  return {
    doc,
    meta: {
      fileName,
      byteLength: bytes.byteLength,
      pageCount: doc.numPages,
      fingerprint: doc.fingerprints[0] ?? "",
    },
  };
}

/**
 * Reconstruct readable text from pdf.js's text items — docs/roadmap/01 §5,
 * "getTextContent() không giữ khoảng trắng/xuống dòng đáng tin cậy".
 * `items[].str` joined naively glues lines together for PDFs (InDesign,
 * LaTeX output) that lay text out by absolute position rather than a real
 * text stream. Two signals decide a line break: pdf.js's own `hasEOL` flag
 * (set when it detects trailing whitespace before a position jump) OR a
 * vertical (Y) jump between consecutive items bigger than half the current
 * item's own font height — the item's height is the only per-item scale we
 * have, so it doubles as the threshold instead of one fixed pixel constant
 * that would be wrong at other zoom/font sizes.
 */
export async function extractPageText(page: PDFPageProxy): Promise<PageStatus> {
  try {
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = "";
    let lastY: number | null = null;

    for (const raw of content.items) {
      if (!("str" in raw)) continue; // TextMarkedContent — no text
      const item = raw as TextItem;
      const y = item.transform[5];
      const threshold = Math.max(item.height, 4) * 0.5;

      if (lastY !== null && Math.abs(y - lastY) > threshold && current.length > 0) {
        lines.push(current);
        current = "";
      }

      current += item.str;

      if (item.hasEOL) {
        lines.push(current);
        current = "";
        lastY = null;
      } else {
        lastY = y;
      }
    }
    if (current.length > 0) lines.push(current);

    const text = lines.join("\n").replace(/[ \t]+\n/g, "\n").trim();
    if (text.replace(/\s+/g, "").length < MIN_REAL_TEXT_CHARS) return { kind: "empty" };
    return { kind: "text", text, charCount: text.length };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "extraction failed" };
  }
}

export async function loadPage(doc: PDFDocumentProxy, pageNumber: number): Promise<PDFPageProxy> {
  return doc.getPage(pageNumber);
}

/** Rasterize a page for OCR input — scale 2 trades a bit of memory for materially better recognition accuracy on small print. */
export async function renderPageToCanvas(page: PDFPageProxy, scale = 2): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfLoadError("2D canvas context unavailable");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}
