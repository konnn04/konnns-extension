/**
 * Registers every embedded tool (side-effect imports populate the Embed Tool
 * Registry). Imported ONLY by the content script entrypoint — the popup reads
 * ./catalog instead so tool implementations stay out of its bundle.
 */
import "./page-to-markdown";
