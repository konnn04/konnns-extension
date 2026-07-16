export interface SearchEngine {
  id: string;
  label: string;
  url: string; // %s = query placeholder
  bang: string;
}

export const engines: SearchEngine[] = [
  { id: "google", label: "Google", url: "https://www.google.com/search?q=%s", bang: "g" },
  { id: "bing", label: "Bing", url: "https://www.bing.com/search?q=%s", bang: "b" },
  { id: "duckduckgo", label: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", bang: "d" },
  {
    id: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/results?search_query=%s",
    bang: "yt",
  },
];

/**
 * Resolve the final URL. Bang shortcuts ("!yt query") override the default
 * engine — kept minimal for MVP but the architecture is in place (docs/phase-1-mvp/01 §1).
 */
export function buildSearchUrl(defaultEngineId: string, customUrl: string, rawQuery: string): string | null {
  let query = rawQuery.trim();
  if (!query) return null;

  let engineId = defaultEngineId;
  const bangMatch = query.match(/^!(\w+)\s+(.+)$/);
  if (bangMatch) {
    const byBang = engines.find((e) => e.bang === bangMatch[1].toLowerCase());
    if (byBang) {
      engineId = byBang.id;
      query = bangMatch[2];
    }
  }

  const pattern =
    engineId === "custom" && customUrl.includes("%s")
      ? customUrl
      : (engines.find((e) => e.id === engineId) ?? engines[0]).url;

  return pattern.replace("%s", encodeURIComponent(query));
}
