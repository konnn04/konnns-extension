import { FileText } from "lucide-react";
import type { EmbedToolMeta } from "@/core/embed-registry";
import { pageToMarkdownSchema, PAGE_TO_MARKDOWN_ID } from "./page-to-markdown/settings";
import type { SettingsSchema } from "@/core/settings-engine/schema";

/**
 * Display metadata for the embedded tools, importable from anywhere (the popup
 * lists them from here). Ids must match the registrations in ./index.ts — the
 * content script is the one that actually runs them.
 */
export interface EmbedToolEntry extends EmbedToolMeta {
  /** options form shown under the tool in the popup */
  settingsSchema?: SettingsSchema;
}

export const EMBED_CATALOG: EmbedToolEntry[] = [
  {
    id: "page-to-markdown",
    nameKey: "embed.tools.page-to-markdown.name",
    descKey: "embed.tools.page-to-markdown.desc",
    icon: FileText,
    settingsSchema: pageToMarkdownSchema,
  },
];

/** Settings featureId for a tool; ids and featureIds are intentionally 1:1. */
export const EMBED_SETTINGS_ID: Record<string, string> = {
  "page-to-markdown": PAGE_TO_MARKDOWN_ID,
};
