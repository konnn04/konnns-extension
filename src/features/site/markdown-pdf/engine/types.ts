/** Shared shapes — docs/roadmap/02-markdown-pdf.md §1. */

export interface MarkdownDoc {
  id: string;
  title: string;
  source: string;
  updatedAt: number;
}

export function titleFromSource(source: string, fallback: string): string {
  const h1 = source.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : fallback;
}

export function newDoc(): MarkdownDoc {
  return { id: crypto.randomUUID(), title: "", source: "", updatedAt: Date.now() };
}
