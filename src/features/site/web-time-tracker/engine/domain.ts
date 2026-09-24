/**
 * URL → domain, and whether a URL should be tracked at all — pure, no
 * chrome.* — docs/roadmap/04-web-time-tracker.md §5.
 */

/**
 * Schemes that must NEVER be recorded: internal browser pages, the
 * extension's own pages, local files. Tracking `chrome://` or the
 * extension's own site app would mean the tool logs itself being opened.
 */
const UNTRACKABLE_SCHEMES = new Set([
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "moz-extension:",
  "file:",
  "devtools:",
  "view-source:",
]);

/** "www.github.com" → "github.com". Returns null for anything not trackable. */
export function normalizeDomain(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (UNTRACKABLE_SCHEMES.has(parsed.protocol)) return null;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function isTrackable(url: string | undefined): boolean {
  return normalizeDomain(url) !== null;
}

/**
 * Favicon by domain, via Google's public favicon service — the same
 * technique already in use in this codebase for most-visited sites
 * (`features/newtab/most-visited/api.ts`). Reproduced here rather than
 * imported: the "one tool = one folder" ESLint rule blocks importing across
 * `features/**`, and this is a three-line URL formula, not worth promoting
 * to `@/shared` for its second use.
 */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export function isExcluded(domain: string, excludedDomains: string[]): boolean {
  return excludedDomains.includes(domain);
}
