import Defuddle from "defuddle/full";
import type { MarkdownPayload } from "@/shared/utils/markdownResult";
import type { PageToMarkdownOptions } from "./settings";

/**
 * Turn the current page into Markdown for feeding an AI.
 *
 * Extraction is Defuddle's job (github.com/kepano/defuddle, MIT) — the library
 * behind Obsidian Web Clipper. It beats the classic Readability + Turndown pair
 * here because Readability is effectively unmaintained, Defuddle reads the
 * page's own mobile stylesheet to spot chrome worth dropping, and its
 * `defuddle/full` build converts to Markdown itself with consistent handling of
 * code blocks, footnotes and math — exactly the parts an LLM needs intact.
 *
 * Runs inside the content script, so it sees the live DOM after client-side
 * rendering; `useAsync: false` keeps Defuddle's site extractors from making
 * third-party network calls we have no host permission for.
 */

const DEFAULTS: PageToMarkdownOptions = {
  contentMode: "readable",
  includeFrontmatter: true,
  includeImages: false,
  includeLinks: true,
  maxChars: 0,
};

export function extractPageMarkdown(params?: Record<string, unknown>): MarkdownPayload {
  const opts: PageToMarkdownOptions = { ...DEFAULTS, ...(params as Partial<PageToMarkdownOptions>) };

  const { doc, contentSelector } = pickDocument(opts.contentMode);

  const result = new Defuddle(doc, {
    url: location.href,
    markdown: true,
    useAsync: false,
    removeImages: !opts.includeImages,
    ...(contentSelector ? { contentSelector, removeLowScoring: false } : {}),
  }).parse();

  let markdown = (result.content ?? "").trim();
  if (!markdown) throw new Error("embed.md.errNoContent");

  if (!opts.includeLinks) markdown = stripLinks(markdown);

  let body = markdown;
  if (opts.maxChars > 0 && body.length > opts.maxChars) {
    body = `${body.slice(0, opts.maxChars).trimEnd()}\n\n…[truncated]`;
  }

  const full = opts.includeFrontmatter ? frontmatter(result) + body : body;

  return {
    markdown: full,
    wordCount: countWords(body),
    charCount: full.length,
    title: result.title || document.title,
    url: location.href,
  };
}

/**
 * Which DOM does Defuddle get? ALWAYS a throwaway copy — never the live page.
 *
 * Defuddle.parse() writes to the document it is handed: it normalises
 * attribute casing and, worse, promotes real image URLs out of <noscript>
 * fallbacks straight onto the live <img> elements. Pointed at the page the
 * user is reading, that visibly breaks images and can confuse the site own
 * lazy loader. A reader must never damage what it reads.
 *
 * The cost is that a detached document has no window, so Defuddle
 * getComputedStyle helper returns null and its style-based heuristics (the
 * mobile-stylesheet trick, hidden-element removal) degrade to no-ops. That
 * trades a little extra boilerplate in the output for never corrupting the
 * page — and it also means less content is wrongly discarded.
 */
function pickDocument(mode: PageToMarkdownOptions["contentMode"]): {
  doc: Document;
  contentSelector?: string;
} {
  const scratch = document.implementation.createHTMLDocument(document.title);

  // Relative hrefs and srcs must still resolve against the real page.
  const base = scratch.createElement("base");
  base.href = location.href;
  scratch.head.append(base);

  if (mode === "selection") {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      throw new Error("embed.md.errNoSelection");
    }
    for (let i = 0; i < selection.rangeCount; i++) {
      scratch.body.append(scratch.importNode(selection.getRangeAt(i).cloneContents(), true));
    }
    return { doc: scratch, contentSelector: "body" };
  }

  scratch.body.append(scratch.importNode(document.body, true));

  // "readable" still lets Defuddle hunt for the article; "full" pins it to
  // the whole body and switches off the scoring that would trim it back.
  return mode === "full" ? { doc: scratch, contentSelector: "body" } : { doc: scratch };
}

/** YAML front matter so the source survives a copy-paste into a chat. */
function frontmatter(result: {
  title?: string;
  author?: string;
  published?: string;
  domain?: string;
  site?: string;
}): string {
  const rows: Array<[string, string | undefined]> = [
    ["title", result.title || document.title],
    ["source", location.href],
    ["author", result.author],
    ["published", result.published],
    ["site", result.site || result.domain],
    ["clipped", new Date().toISOString()],
  ];
  const lines = rows
    .filter((r): r is [string, string] => Boolean(r[1]))
    .map(([k, v]) => `${k}: ${yamlValue(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function yamlValue(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return /[:#"'\n[\]{}]/.test(flat) ? JSON.stringify(flat) : flat;
}

/**
 * Drop link targets but keep their text — URLs are a large share of the tokens
 * in a clipped page and rarely help the model. Images (`![]()`) are left alone;
 * they are controlled by the separate `includeImages` option.
 */
function stripLinks(markdown: string): string {
  return markdown
    .replace(/(^|[^!])\[([^\]]*)\]\([^)]*\)/g, "$1$2")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1");
}

function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}
