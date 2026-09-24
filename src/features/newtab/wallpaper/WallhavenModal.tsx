import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Compass,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button, Modal, Select, Skeleton, TextInput } from "@/shared/ui";
import {
  categoryToCode,
  CURATED_TOPICS,
  searchWallhaven,
  type WallhavenCategory,
  type WallhavenResolution,
  type WallhavenSorting,
  type Wallpaper,
} from "./wallhaven";
import "./wallhaven.css";

interface WallhavenModalProps {
  open: boolean;
  onClose: () => void;
  onSelectWallpaper: (wp: Wallpaper) => Promise<void>;
}

const CURATED_TAGS = [
  { id: "all", labelKey: "wallpaper.topicAllShort", icon: "🎲" },
  { id: "space", labelKey: "wallpaper.topicSpace", icon: "🌌" },
  { id: "forest", labelKey: "wallpaper.topicForest", icon: "🌲" },
  { id: "city", labelKey: "wallpaper.topicCity", icon: "🏙️" },
  { id: "landscape", labelKey: "wallpaper.topicLandscape", icon: "🏞️" },
] as const;

export function WallhavenModal({
  open,
  onClose,
  onSelectWallpaper,
}: WallhavenModalProps) {
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [category, setCategory] = useState<WallhavenCategory>("all");
  const [atleast, setAtleast] = useState<WallhavenResolution>("2560x1440");
  const [sorting, setSorting] = useState<WallhavenSorting>("random");
  const [page, setPage] = useState(1);

  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const doSearch = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      let q = query.trim();
      if (!q) {
        if (activeTopic === "all") {
          q = CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
        } else {
          q = activeTopic;
        }
      }
      const res = await searchWallhaven({
        q,
        categories: categoryToCode(category),
        sorting,
        atleast,
        ratios: "landscape",
        page: pageNum,
      });
      setWallpapers(res.data);
      setTotalItems(res.meta.total);
      setTotalPages(res.meta.last_page);
      setPage(res.meta.current_page);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("wallpaper.wallhavenFetchError"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void doSearch(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, atleast, sorting, activeTopic]);

  const handleApply = async (wp: Wallpaper) => {
    setApplyingId(wp.id);
    try {
      await onSelectWallpaper(wp);
      setAppliedId(wp.id);
      setTimeout(() => {
        setAppliedId(null);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to apply wallpaper:", err);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDownload = (wp: Wallpaper) => {
    const a = document.createElement("a");
    a.href = wp.path;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = `wallhaven-${wp.id}.jpg`;
    a.click();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("wallpaper.wallhavenTitle")}
      width="min(94vw, 1120px)"
    >
      <div className="wh-modal">
        {/* Search Bar */}
        <div className="wh-search-bar">
          <div className="wh-search-input-wrap">
            <Search size={16} />
            <TextInput
              placeholder={t("wallpaper.wallhavenSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void doSearch(1);
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="wh-search-clear"
                onClick={() => {
                  setQuery("");
                  void doSearch(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Button variant="primary" onClick={() => void doSearch(1)}>
            <Search size={15} />
            <span>{t("common.search")}</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setSorting("random");
              void doSearch(1);
            }}
            title={t("wallpaper.random")}
          >
            <Sparkles size={15} />
            <span>{t("wallpaper.random")}</span>
          </Button>
        </div>

        {/* Curated Topic Chips (Space, Forest, City, Landscape) */}
        <div className="wh-tags-row">
          <span className="wh-tags-label">{t("wallpaper.wallhavenTopics")}:</span>
          {CURATED_TAGS.map((item) => {
            const active = activeTopic === item.id && !query;
            return (
              <button
                key={item.id}
                type="button"
                className={`wh-tag-chip ${active ? "wh-tag-chip--active" : ""}`}
                onClick={() => {
                  setActiveTopic(item.id);
                  setQuery("");
                }}
              >
                <span style={{ marginRight: 5 }}>{item.icon}</span>
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Filter Controls Bar */}
        <div className="wh-filters-bar">
          {/* Orientation (Landscape Only) */}
          <div className="wh-filter-group">
            <span className="wh-cat-pill wh-cat-pill--active" style={{ cursor: "default" }}>
              🖥️ {t("wallpaper.landscapeOnly")}
            </span>
          </div>

          {/* Min Resolution */}
          <div className="wh-filter-group">
            <span className="wh-filter-label">{t("wallpaper.wallhavenMinRes")}:</span>
            <Select
              value={atleast}
              onChange={(v) => setAtleast(v as WallhavenResolution)}
              options={[
                { value: "2560x1440", label: "2K QHD (2560x1440+)" },
                { value: "3840x2160", label: "4K UHD (3840x2160+)" },
              ]}
            />
          </div>

          {/* Category */}
          <div className="wh-filter-group">
            <span className="wh-filter-label">{t("wallpaper.wallhavenCategory")}:</span>
            <div className="wh-category-pills">
              {(
                [
                  { id: "all", label: t("common.all") },
                  { id: "general", label: t("wallpaper.catGeneral") },
                  { id: "anime", label: t("wallpaper.catAnime") },
                  { id: "people", label: t("wallpaper.catPeople") },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`wh-cat-pill ${category === c.id ? "wh-cat-pill--active" : ""}`}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sorting */}
          <div className="wh-filter-group">
            <span className="wh-filter-label">{t("wallpaper.wallhavenSort")}:</span>
            <Select
              value={sorting}
              onChange={(v) => setSorting(v as WallhavenSorting)}
              options={[
                { value: "random", label: t("wallpaper.sortRandom") },
                { value: "toplist", label: t("wallpaper.sortToplist") },
                { value: "favorites", label: t("wallpaper.sortFavorites") },
                { value: "views", label: t("wallpaper.sortViews") },
                { value: "date_added", label: t("wallpaper.sortDateAdded") },
                { value: "relevance", label: t("wallpaper.sortRelevance") },
              ]}
            />
          </div>
        </div>

        {/* Gallery Scroll Container */}
        <div className="wh-grid-scroll">
          {loading ? (
            <div className="wh-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  height={150}
                  radius="var(--radius-md)"
                />
              ))}
            </div>
          ) : error ? (
            <div className="wh-error-state">
              <p>{error}</p>
              <Button variant="primary" onClick={() => void doSearch(page)}>
                <RefreshCw size={14} />
                <span>{t("common.retry")}</span>
              </Button>
            </div>
          ) : wallpapers.length === 0 ? (
            <div className="wh-empty-state">
              <Compass size={40} />
              <p className="wh-empty-title">{t("wallpaper.wallhavenNoResults")}</p>
              <p>{t("wallpaper.wallhavenTryAnother")}</p>
            </div>
          ) : (
            <div className="wh-grid">
              {wallpapers.map((wp) => {
                const is4K = wp.dimension_x >= 3840 || wp.dimension_y >= 2160;
                const is2K = !is4K && (wp.dimension_x >= 2560 || wp.dimension_y >= 1440);
                const isApplying = applyingId === wp.id;
                const isApplied = appliedId === wp.id;

                return (
                  <div key={wp.id} className="wh-card">
                    <img
                      src={wp.thumbs.large}
                      alt={wp.id}
                      className="wh-card__img"
                      loading="lazy"
                    />

                    {/* Top Badges */}
                    <div className="wh-card__badges">
                      {is4K && <span className="wh-badge wh-badge--4k">4K</span>}
                      {is2K && <span className="wh-badge wh-badge--2k">2K</span>}
                      <span className="wh-badge">{wp.resolution}</span>
                    </div>

                    {/* Bottom Stats */}
                    <div className="wh-card__stats">
                      <span className="wh-stat-item" title={`${wp.views} views`}>
                        <Eye size={12} />
                        {wp.views >= 1000 ? `${(wp.views / 1000).toFixed(1)}k` : wp.views}
                      </span>
                      <span className="wh-stat-item" title={`${wp.favorites} favorites`}>
                        <Heart size={12} />
                        {wp.favorites}
                      </span>
                    </div>

                    {/* Hover Actions Overlay */}
                    <div className="wh-card__overlay">
                      <div className="wh-card__actions">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={isApplying}
                          onClick={() => void handleApply(wp)}
                        >
                          {isApplying ? (
                            <Loader2 size={13} className="ui-reload--spin" />
                          ) : isApplied ? (
                            <Check size={13} />
                          ) : (
                            <Compass size={13} />
                          )}
                          <span>
                            {isApplied
                              ? t("wallpaper.wallhavenApplied")
                              : t("wallpaper.wallhavenSetAs")}
                          </span>
                        </Button>

                        <Button
                          size="sm"
                          variant="subtle"
                          title={t("wallpaper.wallhavenDownloadOrig")}
                          onClick={() => handleDownload(wp)}
                        >
                          <Download size={13} />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          title={t("wallpaper.wallhavenOpenWeb")}
                          onClick={() => window.open(wp.url, "_blank", "noreferrer")}
                        >
                          <ExternalLink size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="wh-footer">
          <span>
            {totalItems > 0
              ? t("wallpaper.wallhavenItemsCount", {
                  total: totalItems.toLocaleString(),
                  page,
                  pages: totalPages,
                })
              : ""}
          </span>

          <div className="wh-pagination">
            <Button
              size="sm"
              variant="subtle"
              disabled={page <= 1 || loading}
              onClick={() => void doSearch(page - 1)}
            >
              {t("common.prev")}
            </Button>
            <span className="wh-page-indicator">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="subtle"
              disabled={page >= totalPages || loading}
              onClick={() => void doSearch(page + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
