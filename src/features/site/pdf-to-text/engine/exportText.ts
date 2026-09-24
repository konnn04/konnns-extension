import type { PageStatus } from "./types";

export type ExportFormat = "txt" | "md";
export type ExportScope = "current" | "all";

function textOf(status: PageStatus | undefined): string | null {
  if (!status) return null;
  if (status.kind === "text") return status.text;
  if (status.kind === "ocr-done") return status.text;
  return null;
}

export function buildExport(
  pages: Map<number, PageStatus>,
  pageCount: number,
  format: ExportFormat,
  scope: ExportScope,
  activePage: number,
): string {
  const numbers = scope === "current" ? [activePage] : Array.from({ length: pageCount }, (_, i) => i + 1);

  if (format === "txt") {
    return numbers
      .map((n) => textOf(pages.get(n)) ?? "")
      .filter((t) => t.length > 0)
      .join("\n\n---\n\n");
  }

  return numbers
    .map((n) => {
      const text = textOf(pages.get(n));
      if (text === null) return null;
      return `## Trang ${n}\n\n${text}`;
    })
    .filter((s): s is string => s !== null)
    .join("\n\n");
}

export function downloadText(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
