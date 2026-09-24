import { defineSchema } from "@/core/settings-engine/schema";

/**
 * Options for the page → Markdown tool.
 *
 * They live in the normal settings engine (Dexie, featureId below), but the
 * READER is the popup, not the content script: a content script runs in the
 * page's origin, so it cannot see the extension's IndexedDB. The popup resolves
 * these values and passes them along as message params.
 */
export const PAGE_TO_MARKDOWN_ID = "embed-page-to-markdown";

export const pageToMarkdownSchema = defineSchema({
  contentMode: {
    type: "select",
    label: "embed.md.contentMode",
    description: "embed.md.contentModeDesc",
    default: "readable",
    options: [
      { value: "readable", label: "embed.md.modeReadable" },
      { value: "selection", label: "embed.md.modeSelection" },
      { value: "full", label: "embed.md.modeFull" },
    ],
  },
  includeFrontmatter: {
    type: "toggle",
    label: "embed.md.frontmatter",
    description: "embed.md.frontmatterDesc",
    default: true,
  },
  includeImages: {
    type: "toggle",
    label: "embed.md.images",
    default: false,
  },
  includeLinks: {
    type: "toggle",
    label: "embed.md.links",
    description: "embed.md.linksDesc",
    default: true,
  },
  maxChars: {
    type: "number",
    label: "embed.md.maxChars",
    description: "embed.md.maxCharsDesc",
    default: 0,
    min: 0,
    max: 2_000_000,
  },
});

export interface PageToMarkdownOptions {
  contentMode: "readable" | "selection" | "full";
  includeFrontmatter: boolean;
  includeImages: boolean;
  includeLinks: boolean;
  /** 0 = no limit */
  maxChars: number;
}
