/**
 * Shared shape for embedded tools that produce Markdown, so the popup and the
 * site's clip viewer agree on one payload without importing each other.
 */
export interface MarkdownPayload {
  markdown: string;
  wordCount: number;
  charCount: number;
  /** source page, filled in when the payload is handed to another surface */
  url?: string;
  title?: string;
}

export function isMarkdownPayload(value: unknown): value is MarkdownPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MarkdownPayload).markdown === "string"
  );
}

/**
 * Rough token count for sizing an LLM prompt. ~4 characters per token is the
 * usual English/Vietnamese ballpark; this is a hint, not a billing figure.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
