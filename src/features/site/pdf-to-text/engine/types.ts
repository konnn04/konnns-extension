/**
 * Shared shapes — docs/roadmap/01-pdf-to-text.md §1.
 *
 * State lives for the session only (no "reopen this PDF later" requirement),
 * so unlike Audio Editor / Web Time Tracker there is no Dexie table here.
 */

export interface PdfDocumentMeta {
  fileName: string;
  byteLength: number;
  pageCount: number;
  /** pdf.js Document.fingerprints[0] — lets a re-drop of the same file be recognized */
  fingerprint: string;
}

export type PageStatus =
  | { kind: "pending" }
  | { kind: "text"; text: string; charCount: number }
  /** extracted successfully but the page truly has (near) no characters — likely a scan, not a bug */
  | { kind: "empty" }
  | { kind: "ocr-pending"; progress: number }
  | { kind: "ocr-done"; text: string; confidence: number }
  | { kind: "error"; message: string };

export type OcrLanguage = "eng" | "vie";

export interface PdfWorkspace {
  doc: PdfDocumentMeta | null;
  /** 1-based page number -> status, matching pdf.js's own page numbering */
  pages: Map<number, PageStatus>;
  activePage: number;
  /** true once extraction has finished and most pages came back "empty" */
  looksLikeScan: boolean;
  busy: boolean;
  error: string | null;
  /** set while a PasswordException is being resolved */
  needsPassword: boolean;
  passwordError: string | null;
}

export function emptyWorkspace(): PdfWorkspace {
  return {
    doc: null,
    pages: new Map(),
    activePage: 1,
    looksLikeScan: false,
    busy: false,
    error: null,
    needsPassword: false,
    passwordError: null,
  };
}

/** A page counts as real text once it clears a small noise floor — a lone page number in a corner is not a "scan". */
export const MIN_REAL_TEXT_CHARS = 10;
