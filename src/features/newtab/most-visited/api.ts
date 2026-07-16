import { browser } from "wxt/browser";

/** Most-visited sites via the browser topSites API (optional runtime permission). */

export interface TopSite {
  title: string;
  url: string;
}

export async function hasTopSitesPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: ["topSites"] });
  } catch {
    return false;
  }
}

export async function requestTopSitesPermission(): Promise<boolean> {
  try {
    return await browser.permissions.request({ permissions: ["topSites"] });
  } catch {
    return false;
  }
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
