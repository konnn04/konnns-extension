import type { LinkMetadata } from "../types";
import { parseMetadata } from "./parser";

export interface FetchResult {
  ok: boolean;
  data?: LinkMetadata;
  error?: string;
  source?: "direct" | "proxy";
}

export async function fetchLinkMetadata(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url) {
    return { ok: false, error: "linkPreview.errEmptyUrl" };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    new URL(url);
  } catch {
    return { ok: false, error: "linkPreview.errInvalidUrl" };
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.ok) {
      const html = await res.text();
      const data = parseMetadata(html, url);
      return { ok: true, data, source: "direct" };
    }
  } catch {
    // Direct fetch failed, fallback to proxy
  }

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (proxyRes.ok) {
      const html = await proxyRes.text();
      const data = parseMetadata(html, url);
      return { ok: true, data, source: "proxy" };
    }
  } catch {
    // Proxy also failed
  }

  try {
    const altProxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const altRes = await fetch(altProxy, {
      signal: AbortSignal.timeout(10000),
    });

    if (altRes.ok) {
      const html = await altRes.text();
      const data = parseMetadata(html, url);
      return { ok: true, data, source: "proxy" };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "linkPreview.errFetchFailed",
    };
  }

  return { ok: false, error: "linkPreview.errFetchFailed" };
}
