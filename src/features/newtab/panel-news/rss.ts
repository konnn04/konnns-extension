import { browser } from "wxt/browser";
import { requestPermissions } from "@/core/permissions";

/**
 * News via public RSS (keyless, docs/phase-2 §2 + bonus-public-api). Feeds are
 * fetched cross-origin, which needs an optional host permission requested at
 * runtime (not at install) — same pattern as the bookmarks permission.
 */

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
  image?: string;
}

export interface FeedTopic {
  id: string;
  labelKey: string;
  feeds: Array<{ url: string; source: string }>;
}

/** Built-in topics → keyless public RSS feeds (config-driven, easy to extend). */
export const TOPICS: FeedTopic[] = [
  {
    id: "tech",
    labelKey: "news.topics.tech",
    feeds: [
      { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
      { url: "https://hnrss.org/frontpage", source: "Hacker News" },
    ],
  },
  {
    id: "security",
    labelKey: "news.topics.security",
    feeds: [{ url: "https://feeds.feedburner.com/TheHackersNews", source: "The Hacker News" }],
  },
  {
    id: "world",
    labelKey: "news.topics.world",
    feeds: [{ url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" }],
  },
  {
    id: "vietnam",
    labelKey: "news.topics.vietnam",
    feeds: [{ url: "https://vnexpress.net/rss/tin-moi-nhat.rss", source: "VnExpress" }],
  },
];

/** Curated RSS mode (docs item 8) — a fixed set of feeds to keep load light. */
export const CURATED_FEEDS: Array<{ id: string; label: string; url: string; source: string }> = [
  { id: "techcrunch", label: "TechCrunch", url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { id: "tinhte", label: "Tinh tế", url: "https://tinhte.vn/rss/", source: "Tinh tế" },
  { id: "vne-world", label: "VnExpress · Thế giới", url: "https://vnexpress.net/rss/the-gioi.rss", source: "VnExpress" },
  { id: "vne-news", label: "VnExpress · Thời sự", url: "https://vnexpress.net/rss/thoi-su.rss", source: "VnExpress" },
  { id: "vne-law", label: "VnExpress · Pháp luật", url: "https://vnexpress.net/rss/phap-luat.rss", source: "VnExpress" },
  { id: "vne-tech", label: "VnExpress · KHCN", url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss", source: "VnExpress" },
  { id: "cnn", label: "CNN Top Stories", url: "http://rss.cnn.com/rss/cnn_topstories.rss", source: "CNN" },
  { id: "nbc-world", label: "NBC World", url: "https://feeds.nbcnews.com/nbcnews/public/world", source: "NBC" },
  { id: "eurogamer", label: "Eurogamer", url: "https://www.eurogamer.net/feed", source: "Eurogamer" },
];

const HOST_PATTERN = "*://*/*";

export async function hasHostPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [HOST_PATTERN] });
  } catch {
    return false;
  }
}

export function requestHostPermission(): Promise<boolean> {
  return requestPermissions({ origins: [HOST_PATTERN] });
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Best-effort thumbnail: media:thumbnail/content, enclosure, or first <img>. */
function extractImage(item: Element, html: string): string | undefined {
  const byTag = (tag: string, attr: string) => {
    const el = item.getElementsByTagName(tag)[0];
    return el?.getAttribute(attr) ?? undefined;
  };
  const media =
    byTag("media:thumbnail", "url") ??
    byTag("media:content", "url") ??
    byTag("enclosure", "url");
  if (media && /^https?:/.test(media)) return media;

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && /^https?:/.test(imgMatch[1])) return imgMatch[1];
  return undefined;
}

function parseFeed(xml: string, source: string): NewsArticle[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return [];

  const items = [...doc.querySelectorAll("item")];
  if (items.length > 0) {
    // RSS 2.0
    return items.map((it) => {
      const title = it.querySelector("title")?.textContent ?? "";
      const link = it.querySelector("link")?.textContent ?? "";
      const date = it.querySelector("pubDate")?.textContent ?? "";
      const desc = it.querySelector("description")?.textContent ?? "";
      const contentEncoded = it.getElementsByTagName("content:encoded")[0]?.textContent ?? "";
      return {
        id: link || title,
        title: stripHtml(title),
        link,
        source,
        publishedAt: date ? new Date(date).getTime() : 0,
        summary: stripHtml(desc).slice(0, 220),
        image: extractImage(it, desc + contentEncoded),
      };
    });
  }

  // Atom
  return [...doc.querySelectorAll("entry")].map((en) => {
    const title = en.querySelector("title")?.textContent ?? "";
    const link =
      en.querySelector("link[rel='alternate']")?.getAttribute("href") ??
      en.querySelector("link")?.getAttribute("href") ??
      "";
    const date =
      en.querySelector("updated")?.textContent ?? en.querySelector("published")?.textContent ?? "";
    const content = en.querySelector("content")?.textContent ?? "";
    const summary = en.querySelector("summary")?.textContent ?? content;
    return {
      id: link || title,
      title: stripHtml(title),
      link,
      source,
      publishedAt: date ? new Date(date).getTime() : 0,
      summary: stripHtml(summary).slice(0, 220),
      image: extractImage(en, content + summary),
    };
  });
}

/** Fetch + merge feeds, newest first, deduped by link. Failed feeds are skipped. */
export async function fetchFeeds(
  feeds: Array<{ url: string; source: string }>,
): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    feeds.map(async ({ url, source }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`rss ${res.status}`);
      return parseFeed(await res.text(), source);
    }),
  );

  const merged: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const a of r.value) {
      if (!a.link || seen.has(a.link)) continue;
      seen.add(a.link);
      merged.push(a);
    }
  }
  return merged.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 40);
}

/** Optional quick-translate via a user-configured LibreTranslate endpoint. */
export async function translateText(
  endpoint: string,
  text: string,
  target: string,
): Promise<string | null> {
  try {
    const res = await fetch(endpoint.replace(/\/$/, "") + "/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: "auto", target, format: "text" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.translatedText ?? null;
  } catch {
    return null;
  }
}
