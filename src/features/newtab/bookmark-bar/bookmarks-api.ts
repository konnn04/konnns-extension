import { browser } from "wxt/browser";

/**
 * Bookmark source = native browser bookmarks API (Option A per
 * docs/phase-1-mvp/01 §4 recommendation). "bookmarks" is an optional
 * permission requested at enable-time, not install-time.
 */

export interface BookmarkItem {
  id: string;
  title: string;
  url?: string; // undefined = folder
  children?: BookmarkItem[];
}

export async function hasBookmarkPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: ["bookmarks"] });
  } catch {
    return false;
  }
}

export async function requestBookmarkPermission(): Promise<boolean> {
  try {
    return await browser.permissions.request({ permissions: ["bookmarks"] });
  } catch {
    return false;
  }
}

/** Children of the "bookmarks bar" folder (Chrome id "1", Firefox "toolbar_____"). */
export async function getBookmarkBarItems(): Promise<BookmarkItem[]> {
  const tree = await browser.bookmarks.getTree();
  const root = tree[0];
  const candidates = root.children ?? [];
  const bar =
    candidates.find((n) => n.id === "1" || n.id === "toolbar_____") ??
    candidates.find((n) => /bookmarks bar|toolbar|thanh dấu trang/i.test(n.title ?? "")) ??
    candidates[0];

  const mapNode = (n: (typeof candidates)[number]): BookmarkItem => ({
    id: n.id,
    title: n.title ?? "",
    url: n.url ?? undefined,
    children: n.children?.map(mapNode),
  });

  return (bar?.children ?? []).map(mapNode);
}

export function faviconFor(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}
