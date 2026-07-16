import { browser } from "wxt/browser";
import { hasPermissions, requestPermissions } from "@/core/permissions";

/** Most-visited sites via the browser topSites API (optional runtime permission). */

export interface TopSite {
  title: string;
  url: string;
}

export function hasTopSitesPermission(): Promise<boolean> {
  return hasPermissions({ permissions: ["topSites"] });
}

export function requestTopSitesPermission(): Promise<boolean> {
  return requestPermissions({ permissions: ["topSites"] });
}

export async function getTopSites(limit: number): Promise<TopSite[]> {
  try {
    const sites = await browser.topSites.get();
    return sites.slice(0, limit).map((s) => ({ title: s.title ?? s.url, url: s.url }));
  } catch {
    return [];
  }
}

export function faviconFor(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}
