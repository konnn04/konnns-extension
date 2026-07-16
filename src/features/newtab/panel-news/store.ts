import { create } from "zustand";
import { isOnline, swr } from "@/core/net";
import { fetchFeeds, type NewsArticle } from "./rss";

export interface Feed {
  url: string;
  source: string;
}

interface NewsState {
  status: "idle" | "loading" | "success" | "error";
  articles: NewsArticle[];
  offline: boolean;
  fetch: (feeds: Feed[], cacheKey: string, force?: boolean) => Promise<void>;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  status: "idle",
  articles: [],
  offline: !isOnline(),

  fetch: async (feeds, cacheKey, force) => {
    if (feeds.length === 0) {
      set({ status: "idle", articles: [] });
      return;
    }
    if (get().status !== "success") set({ status: "loading" });

    await swr<NewsArticle[]>({
      namespace: "news",
      key: cacheKey,
      ttlMs: 15 * 60 * 1000,
      force,
      fetcher: async () => {
        const articles = await fetchFeeds(feeds);
        if (articles.length === 0) throw new Error("no articles");
        return articles;
      },
      onData: (articles, fromCache) =>
        set({ status: "success", articles, offline: fromCache && !isOnline() }),
      onError: (_err, hadCache) => {
        if (hadCache || get().articles.length) {
          set({ offline: !isOnline() });
          return;
        }
        set({ status: "error" });
      },
    });
  },
}));
