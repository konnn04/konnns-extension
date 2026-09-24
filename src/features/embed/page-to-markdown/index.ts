import { registerEmbedTool } from "@/core/embed-registry";
import { extractPageMarkdown } from "./extract";

/** Runtime registration — imported only by the content script. */
registerEmbedTool({
  id: "page-to-markdown",
  run: (params) => extractPageMarkdown(params),
});
