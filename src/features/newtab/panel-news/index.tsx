import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { Button, ReloadButton, Skeleton } from "@/shared/ui";
import { useNewsStore } from "./store";
import {
  CURATED_FEEDS,
  TOPICS,
  hasHostPermission,
  requestHostPermission,
  translateText,
  type NewsArticle,
} from "./rss";
import { NewsSettings, NEWS_FEATURE_ID } from "./NewsSettings";
import "./news.css";

function timeAgo(ts: number, lang: string): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "vi" ? "vi" : "en", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

function NewsArticleRow({
  article,
  translateEndpoint,
  lang,
}: {
  article: NewsArticle;
  translateEndpoint: string;
  lang: string;
}) {
  const { t } = useTranslation();
  const [translated, setTranslated] = useState<{ title: string; summary: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const doTranslate = async () => {
    setBusy(true);
    const target = lang === "vi" ? "vi" : "en";
    const [title, summary] = await Promise.all([
      translateText(translateEndpoint, article.title, target),
      translateText(translateEndpoint, article.summary, target),
    ]);
    if (title || summary) {
      setTranslated({ title: title ?? article.title, summary: summary ?? article.summary });
    }
    setBusy(false);
  };

  const shown = translated ?? { title: article.title, summary: article.summary };

  return (
    <a className="news-item" href={article.link} target="_blank" rel="noreferrer noopener">
      {article.image && (
        <img
          className="news-item__thumb"
          src={article.image}
          alt=""
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="news-item__body">
        <div className="news-item__title">{shown.title}</div>
        {shown.summary && <div className="news-item__summary">{shown.summary}</div>}
        <div className="news-item__meta">
          <span>
            <span className="news-item__source">{article.source}</span> ·{" "}
            {timeAgo(article.publishedAt, lang)}
          </span>
          {translateEndpoint && !translated && (
            <button
              type="button"
              className="news-item__translate"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void doTranslate();
              }}
            >
              {busy ? "…" : t("news.translate")}
            </button>
          )}
        </div>
      </div>
    </a>
  );
}

function PanelNews() {
  const { t, i18n } = useTranslation();
  const values = useFeatureValues(NEWS_FEATURE_ID);
  const online = useOnlineStatus();
  const { status, articles, offline, fetch } = useNewsStore();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [reloading, setReloading] = useState(false);

  const mode = (values.mode as string) ?? "topics";
  const topics = (values.topics as string[]) ?? ["tech"];
  const feedIds = (values.feeds as string[]) ?? ["techcrunch", "vne-news"];
  const translateEndpoint = ((values.translateEndpoint as string) ?? "").trim();

  // resolve the selected mode → concrete feed list + a cache key
  const { feeds, cacheKey } =
    mode === "rss"
      ? {
          feeds: CURATED_FEEDS.filter((f) => feedIds.includes(f.id)).map((f) => ({
            url: f.url,
            source: f.source,
          })),
          cacheKey: "rss:" + [...feedIds].sort().join(","),
        }
      : {
          feeds: TOPICS.filter((tp) => topics.includes(tp.id)).flatMap((tp) => tp.feeds),
          cacheKey: "topics:" + [...topics].sort().join(","),
        };

  useEffect(() => {
    void hasHostPermission().then(setGranted);
  }, []);

  useEffect(() => {
    if (granted) void fetch(feeds, cacheKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granted, online, cacheKey]);

  const noneSelected = feeds.length === 0;

  const forceReload = async () => {
    setReloading(true);
    await fetch(feeds, cacheKey, true);
    setReloading(false);
  };

  if (granted === false) {
    return (
      <div className="news__perm">
        <p className="ui-field__desc">{t("news.permissionNeeded")}</p>
        <Button
          variant="primary"
          onClick={async () => {
            if (await requestHostPermission()) setGranted(true);
          }}
        >
          {t("bookmarks.grant")}
        </Button>
      </div>
    );
  }

  if (noneSelected) {
    return <p className="ui-field__desc">{t("news.noTopics")}</p>;
  }

  if (status === "loading" || status === "idle" || granted === null) {
    return (
      <div className="news__list">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="news-item">
            <Skeleton width="90%" height={14} />
            <div style={{ height: 8 }} />
            <Skeleton width="100%" height={26} />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return <p className="ui-field__desc">{t("news.error")}</p>;
  }

  return (
    <div>
      <div className="news__head">
        <span className="news__offline">{offline ? t("weather.offline") : ""}</span>
        <ReloadButton busy={reloading} label={t("common.retry")} onClick={() => void forceReload()} />
      </div>
      <div className="news__list">
        {articles.map((a) => (
          <NewsArticleRow
            key={a.id}
            article={a}
            translateEndpoint={translateEndpoint}
            lang={i18n.language}
          />
        ))}
      </div>
    </div>
  );
}

registerFeature({
  id: NEWS_FEATURE_ID,
  zone: "left-sidebar",
  nameKey: "features.panel-news",
  icon: Newspaper,
  defaultEnabled: false,
  requiresNetwork: true,
  settingsExtra: NewsSettings,
  component: PanelNews,
  order: 2,
});

export default PanelNews;
