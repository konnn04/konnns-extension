export interface Wallpaper {
  id: string;
  url: string;
  short_url: string;
  path: string;
  resolution: string;
  category: string;
  favorites: number;
  views: number;
  dimension_x: number;
  dimension_y: number;
  file_size: number;
  created_at: string;
  colors: string[];
  thumbs: {
    large: string;
    original?: string;
  };
}

export interface WallhavenMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  query?: string | null;
  seed?: string | null;
}

export const CURATED_TOPICS = ["space", "forest", "city", "landscape"] as const;
export type CuratedTopic = (typeof CURATED_TOPICS)[number];

export type WallhavenCategory = "all" | "general" | "anime" | "people";
export type WallhavenResolution = "2560x1440" | "3840x2160";
export type WallhavenSorting =
  | "random"
  | "toplist"
  | "favorites"
  | "views"
  | "date_added"
  | "relevance";

export interface WallhavenSearchParams {
  q?: string;
  categories?: string; // "100" (General), "010" (Anime), "001" (People), "111" (All)
  purity?: string; // "100" (SFW)
  sorting?: WallhavenSorting;
  atleast?: WallhavenResolution; // "2560x1440" (2K+), "3840x2160" (4K+)
  ratios?: string; // "landscape" (only horizontal landscape)
  page?: number;
  seed?: string;
}

const BASE_URL = "https://wallhaven.cc/api/v1";

export function categoryToCode(cat: WallhavenCategory): string {
  switch (cat) {
    case "general":
      return "100";
    case "anime":
      return "010";
    case "people":
      return "001";
    case "all":
    default:
      return "111";
  }
}

export function codeToCategory(code: string): WallhavenCategory {
  if (code === "100") return "general";
  if (code === "010") return "anime";
  if (code === "001") return "people";
  return "all";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRawWallpaper(item: any): Wallpaper {
  return {
    id: String(item.id),
    url: String(item.url || `https://wallhaven.cc/w/${item.id}`),
    short_url: String(item.short_url || `https://whvn.cc/${item.id}`),
    path: String(item.path),
    resolution: String(item.resolution || `${item.dimension_x}x${item.dimension_y}`),
    category: String(item.category || "general"),
    favorites: Number(item.favorites || 0),
    views: Number(item.views || 0),
    dimension_x: Number(item.dimension_x || 0),
    dimension_y: Number(item.dimension_y || 0),
    file_size: Number(item.file_size || 0),
    created_at: String(item.created_at || ""),
    colors: Array.isArray(item.colors) ? item.colors : [],
    thumbs: {
      large: String(item.thumbs?.large || item.thumbs?.small || item.path),
      original: item.thumbs?.original ? String(item.thumbs.original) : undefined,
    },
  };
}

/**
 * Search wallpapers using the official Wallhaven API:
 * GET https://wallhaven.cc/api/v1/search
 */
export async function searchWallhaven(
  params: WallhavenSearchParams = {},
): Promise<{ data: Wallpaper[]; meta: WallhavenMeta }> {
  const url = new URL(`${BASE_URL}/search`);
  if (params.q?.trim()) {
    url.searchParams.set("q", params.q.trim());
  }
  url.searchParams.set("categories", params.categories || "111");
  url.searchParams.set("purity", params.purity || "100"); // Safe For Work by default
  // Only landscape widescreen wallpapers (user requirement)
  url.searchParams.set("ratios", params.ratios || "landscape");
  // Minimum 2K resolution (2560x1440+) (user requirement)
  url.searchParams.set("atleast", params.atleast || "2560x1440");
  if (params.sorting) {
    url.searchParams.set("sorting", params.sorting);
  }
  if (params.page && params.page > 1) {
    url.searchParams.set("page", String(params.page));
  }
  if (params.seed) {
    url.searchParams.set("seed", params.seed);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Wallhaven search error: HTTP ${res.status}`);
  }
  const json = await res.json();
  const rawList = Array.isArray(json.data) ? json.data : [];
  return {
    data: rawList.map(mapRawWallpaper),
    meta: json.meta || {
      current_page: 1,
      last_page: 1,
      per_page: 24,
      total: rawList.length,
    },
  };
}

/**
 * Get detailed wallpaper info:
 * GET https://wallhaven.cc/api/v1/w/{id}
 */
export async function getWallhavenDetail(id: string): Promise<Wallpaper> {
  const res = await fetch(`${BASE_URL}/w/${id}`);
  if (!res.ok) {
    throw new Error(`Wallhaven detail error: HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!json.data) {
    throw new Error("Invalid Wallhaven detail response");
  }
  return mapRawWallpaper(json.data);
}

/**
 * Fetch a random 2K+ landscape wallpaper from curated topics (space, forest, city, landscape).
 * Returns null if network fails.
 */
export async function fetchRandomWallhavenWallpaper(
  topicOrQuery?: string,
  category: WallhavenCategory = "all",
  atleast: WallhavenResolution = "2560x1440",
): Promise<Wallpaper | null> {
  try {
    let q = topicOrQuery?.trim();
    if (!q || q.toLowerCase() === "random" || q.toLowerCase() === "all") {
      // Pick randomly among the 4 curated topics: space, forest, city, landscape
      q = CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
    }

    const res = await searchWallhaven({
      q,
      categories: categoryToCode(category),
      sorting: "random",
      atleast,
      ratios: "landscape",
      purity: "100",
    });
    if (res.data.length > 0) {
      return res.data[0];
    }
  } catch (err) {
    console.warn("fetchRandomWallhavenWallpaper failed:", err);
  }
  return null;
}
