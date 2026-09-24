/**
 * Paper geometry for printing — docs/site/02-markdown-pdf.md.
 *
 * Pure millimetre maths, no DOM, so the conversion that decides where page
 * breaks land is testable under plain Node.
 *
 * Everything converts to CSS pixels at 96dpi because that is the unit the
 * browser lays the print layer out in: Chrome maps 1 CSS inch to 96px when
 * printing regardless of the physical printer's DPI, so a page box computed
 * this way matches what actually comes out.
 */

export type PaperSizeId = "a4" | "letter" | "a5" | "legal";
export type Orientation = "portrait" | "landscape";

export interface PaperSize {
  id: PaperSizeId;
  /** short edge × long edge, in millimetres */
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PaperSizeId, PaperSize> = {
  a4: { id: "a4", widthMm: 210, heightMm: 297 },
  letter: { id: "letter", widthMm: 215.9, heightMm: 279.4 },
  a5: { id: "a5", widthMm: 148, heightMm: 210 },
  legal: { id: "legal", widthMm: 215.9, heightMm: 355.6 },
};

const PX_PER_MM = 96 / 25.4;

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

export interface PrintSettings {
  paper: PaperSizeId;
  orientation: Orientation;
  /** uniform page margin in millimetres */
  marginMm: number;
  pageNumbers: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper: "a4",
  orientation: "portrait",
  marginMm: 20,
  pageNumbers: true,
};

/** The printable box (paper minus margins) in CSS pixels — the size each rendered page container gets. */
export function contentBoxPx(settings: PrintSettings): { width: number; height: number } {
  const paper = PAPER_SIZES[settings.paper];
  const [wMm, hMm] =
    settings.orientation === "landscape" ? [paper.heightMm, paper.widthMm] : [paper.widthMm, paper.heightMm];

  // margins apply on all four sides, and can't eat the whole sheet
  const margin = Math.max(0, Math.min(settings.marginMm, Math.min(wMm, hMm) / 2 - 5));
  return { width: mmToPx(wMm - margin * 2), height: mmToPx(hMm - margin * 2) };
}

/** The `@page` rule that tells the browser what sheet to lay out — without it, print falls back to the browser's own default paper and margins. */
export function pageRuleCss(settings: PrintSettings): string {
  const paper = PAPER_SIZES[settings.paper];
  const sizeName = settings.paper === "letter" ? "letter" : settings.paper === "legal" ? "legal" : settings.paper.toUpperCase();
  const margin = Math.max(0, Math.min(settings.marginMm, Math.min(paper.widthMm, paper.heightMm) / 2 - 5));
  return `@page { size: ${sizeName} ${settings.orientation}; margin: ${margin}mm; }`;
}
