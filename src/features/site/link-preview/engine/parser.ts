import type { LinkMetadata } from "../types";

function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  if (!relativeOrAbsolute) return "";
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}

export function parseMetadata(html: string, targetUrl: string): LinkMetadata {
  let hostname = "";
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    hostname = targetUrl;
  }

  const metaMap = new Map<string, string>();
  let title = "";
  let canonical = "";
  let favicon = "";

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");

      const titleTag = doc.querySelector("title");
      if (titleTag && titleTag.textContent) {
        title = titleTag.textContent.trim();
      }

      const metaTags = doc.querySelectorAll("meta");
      metaTags.forEach((tag) => {
        const prop = (tag.getAttribute("property") || tag.getAttribute("name") || "").toLowerCase().trim();
        const content = tag.getAttribute("content") || "";
        if (prop && content) {
          metaMap.set(prop, content.trim());
        }
      });

      const canonicalTag = doc.querySelector("link[rel='canonical']");
      if (canonicalTag) {
        canonical = canonicalTag.getAttribute("href") || "";
      }

      const iconTag = doc.querySelector(
        "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']",
      );
      if (iconTag) {
        favicon = iconTag.getAttribute("href") || "";
      }
    } catch {
      // DOMParser failed, fallback to regex
    }
  }

  if (metaMap.size === 0 && !title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    const metaRegex = /<meta\s+[^>]*?(?:name|property)=["']([^"']+)["'][^>]*?content=["']([^"']*)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = metaRegex.exec(html)) !== null) {
      if (match[1] && match[2]) {
        metaMap.set(match[1].toLowerCase().trim(), match[2].trim());
      }
    }

    const metaRegexAlt = /<meta\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']([^"']+)["'][^>]*>/gi;
    while ((match = metaRegexAlt.exec(html)) !== null) {
      if (match[1] && match[2]) {
        metaMap.set(match[2].toLowerCase().trim(), match[1].trim());
      }
    }

    const canonicalMatch = html.match(/<link\s+[^>]*?rel=["']canonical["'][^>]*?href=["']([^"']+)["']/i);
    if (canonicalMatch && canonicalMatch[1]) {
      canonical = canonicalMatch[1].trim();
    }

    const iconMatch = html.match(/<link\s+[^>]*?rel=["'](?:shortcut )?icon["'][^>]*?href=["']([^"']+)["']/i);
    if (iconMatch && iconMatch[1]) {
      favicon = iconMatch[1].trim();
    }
  }

  const resolvedFavicon = favicon
    ? resolveUrl(favicon, targetUrl)
    : hostname
      ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
      : "";

  const rawImage =
    metaMap.get("og:image") ||
    metaMap.get("twitter:image") ||
    metaMap.get("twitter:image:src") ||
    "";
  const resolvedImage = rawImage ? resolveUrl(rawImage, targetUrl) : "";

  const resolvedCanonical = canonical ? resolveUrl(canonical, targetUrl) : "";
  const resolvedOgUrl = metaMap.get("og:url") ? resolveUrl(metaMap.get("og:url")!, targetUrl) : "";

  const widthParsed = parseInt(metaMap.get("og:image:width") || "", 10);
  const heightParsed = parseInt(metaMap.get("og:image:height") || "", 10);

  const rawKeywords = metaMap.get("keywords") || "";
  const keywords = rawKeywords
    ? rawKeywords.split(",").map((k) => k.trim()).filter(Boolean)
    : undefined;

  let twitterCard = metaMap.get("twitter:card") as LinkMetadata["twitterCard"];
  if (twitterCard && !["summary", "summary_large_image", "app", "player"].includes(twitterCard)) {
    twitterCard = undefined;
  }

  return {
    url: resolvedOgUrl || resolvedCanonical || targetUrl,
    originalUrl: targetUrl,
    title: metaMap.get("og:title") || metaMap.get("twitter:title") || title || hostname || "",
    description:
      metaMap.get("og:description") ||
      metaMap.get("twitter:description") ||
      metaMap.get("description") ||
      "",
    siteName: metaMap.get("og:site_name") || metaMap.get("application-name") || hostname || "",
    image: resolvedImage,
    imageWidth: isNaN(widthParsed) ? undefined : widthParsed,
    imageHeight: isNaN(heightParsed) ? undefined : heightParsed,
    imageAlt: metaMap.get("og:image:alt") || metaMap.get("twitter:image:alt") || undefined,
    favicon: resolvedFavicon,
    author: metaMap.get("author") || metaMap.get("article:author") || undefined,
    publishedTime: metaMap.get("article:published_time") || undefined,
    type: metaMap.get("og:type") || "website",
    locale: metaMap.get("og:locale") || undefined,
    themeColor: metaMap.get("theme-color") || undefined,
    twitterCard: twitterCard || (resolvedImage ? "summary_large_image" : "summary"),
    twitterSite: metaMap.get("twitter:site") || undefined,
    twitterCreator: metaMap.get("twitter:creator") || undefined,
    canonical: resolvedCanonical || undefined,
    robots: metaMap.get("robots") || undefined,
    keywords,
  };
}
