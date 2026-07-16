import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { Button, Skeleton } from "@/shared/ui";
import {
  faviconFor,
  getBookmarkBarItems,
  hasBookmarkPermission,
  requestBookmarkPermission,
  type BookmarkItem,
} from "./bookmarks-api";
import { bookmarkSettingsSchema } from "./settings.schema";
import "./bookmark-bar.css";

export const BOOKMARK_FEATURE_ID = "bookmark-bar";

function Favicon({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconFor(url);
  if (!src || failed) {
    return <span className="bookmark-item__letter">{(title || url)[0]?.toUpperCase() ?? "?"}</span>;
  }
  return (
    <img
      className="bookmark-item__icon"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function FolderButton({ item, dir = "up" }: { item: BookmarkItem; dir?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    if (dir === "down") {
      setMenuPos({
        position: "fixed",
        left: r.left + r.width / 2,
        top: r.bottom + 8,
        transform: "translateX(-50%)",
      });
    } else {
      setMenuPos({
        position: "fixed",
        left: r.left + r.width / 2,
        bottom: window.innerHeight - r.top + 8,
        transform: "translateX(-50%)",
      });
    }

    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest(".bookmark-folder__menu") && e.target !== btn) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Delay adding listeners so the same click that opened doesn't close
    const id = setTimeout(() => {
      window.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dir]);

  return (
    <div className="bookmark-folder">
      <button ref={btnRef} className="bookmark-item" onClick={() => setOpen((o) => !o)} title={item.title}>
        <span className="bookmark-item__letter">
          <Folder size={15} />
        </span>
        <span className="bookmark-item__label">{item.title}</span>
      </button>
      {open && createPortal(
        <div className="bookmark-folder__menu" style={menuPos}>
          {(item.children ?? [])
            .filter((c) => c.url)
            .map((c) => (
              <a key={c.id} className="bookmark-folder__entry" href={c.url}>
                <img src={faviconFor(c.url!)} alt="" loading="lazy" />
                <span>{c.title || c.url}</span>
              </a>
            ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function BookmarkBar() {
  const { t } = useTranslation();
  const values = useFeatureValues(BOOKMARK_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const [state, setState] = useState<"checking" | "no-permission" | "loading" | "ready">("checking");
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const orientation = (values.orientation as string) ?? "horizontal";
  const showMode = (values.showMode as string) ?? "always";
  const seenNote = values.seenFirstTimeNote === true;

  const load = useCallback(async () => {
    setState("loading");
    try {
      setItems(await getBookmarkBarItems());
      setState("ready");
    } catch {
      setState("no-permission");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (await hasBookmarkPermission()) void load();
      else setState("no-permission");
    })();
  }, [load]);

  // macOS-dock magnification
  const onMouseMove = (e: React.MouseEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const nodes = bar.querySelectorAll<HTMLElement>(".bookmark-item");

    // Radial: find the single closest item and magnify only that one
    if (orientation === "radial") {
      let best: { el: HTMLElement; dist: number } | null = null;
      nodes.forEach((node) => {
        const r = node.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (!best || dist < best.dist) best = { el: node, dist };
      });
      nodes.forEach((node) => {
        node.style.setProperty("--bm-scale", node === best?.el ? "1.4" : "1");
      });
      return;
    }

    // Horizontal / vertical: proximity-based scaling along the bar axis
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      const center = orientation === "vertical" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      const pos = orientation === "vertical" ? e.clientY : e.clientX;
      const dist = Math.abs(pos - center);
      const scale = Math.max(1, 1.35 - dist / 140);
      node.style.setProperty("--bm-scale", scale.toFixed(3));
    });
  };
  const onMouseLeave = () => {
    barRef.current
      ?.querySelectorAll<HTMLElement>(".bookmark-item")
      .forEach((n) => n.style.removeProperty("--bm-scale"));
  };

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [items, updateScrollState]);

  const scrollTrack = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const step = 200; // px per click
    el.scrollBy({ left: direction === "right" ? step : -step, behavior: "smooth" });
  };

  const isTop = orientation === "horizontal-top";
  const barClass = [
    "bookmark-bar",
    orientation === "vertical" && "bookmark-bar--vertical",
    isTop && "bookmark-bar--top",
    showMode === "hover" && "bookmark-bar--hover-mode",
  ]
    .filter(Boolean)
    .join(" ");

  const renderItem = (item: BookmarkItem, key?: string) =>
    item.url ? (
      <a key={key} className="bookmark-item" href={item.url} title={item.title}>
        <Favicon url={item.url} title={item.title} />
        <span className="bookmark-item__label">{item.title || item.url}</span>
      </a>
    ) : (
      <FolderButton key={key} item={item} dir={isTop ? "down" : "up"} />
    );

  if (state === "no-permission") {
    return (
      <div className="bookmark-bar">
        <div className="bookmark-note">
          <span>{t("bookmarks.permissionNeeded")}</span>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              if (await requestBookmarkPermission()) void load();
            }}
          >
            {t("bookmarks.grant")}
          </Button>
        </div>
      </div>
    );
  }

  if (state === "checking" || state === "loading") {
    // dot skeletons matching final size — no layout shift when data arrives
    return (
      <div className="bookmark-bar" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={52} height={48} radius="var(--radius-sm)" />
        ))}
      </div>
    );
  }

  const noteBlock = !seenNote ? (
    <div className="bookmark-note">
      <span>{t("bookmarks.firstTimeNote")}</span>
      <Button size="sm" onClick={() => setValue(BOOKMARK_FEATURE_ID, "seenFirstTimeNote", true)}>
        {t("bookmarks.gotIt")}
      </Button>
    </div>
  ) : null;

  if (orientation === "radial" && seenNote && items.length > 0) {
    const n = items.length;
    const ringCfg = [
      { capacity: 12, scale: 1.0 },
      { capacity: 8, scale: 0.5 },
      { capacity: 16, scale: 0.15 },
    ];
    const baseR = Math.min(130, 70 + n * 5);

    let rem = n;
    const activeRings: { count: number; rx: number; ry: number }[] = [];
    for (const r of ringCfg) {
      if (rem <= 0) break;
      const count = Math.min(rem, r.capacity);
      const radius = baseR * r.scale;
      activeRings.push({ count, rx: radius * 2, ry: radius * 0.6 });
      rem -= count;
    }
    if (rem > 0 && activeRings.length > 0) activeRings[activeRings.length - 1].count += rem;

    const outer = activeRings[0];
    const cW = (outer?.rx ?? 100) + 56;
    const cH = (outer?.ry ?? 50) + 56;
    const yBase = 16; 

    return (
      <div
        ref={barRef}
        className={`bookmark-radial ${showMode === "hover" ? "bookmark-bar--hover-mode" : ""}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ width: cW * 2, height: cH * 2 + 40 }}
      >
        {activeRings.map((ring, ri) => {
          const startIdx = activeRings.slice(0, ri).reduce((s, r) => s + r.count, 0);
          return items.slice(startIdx, startIdx + ring.count).map((item, i) => {
            const angle = ring.count === 1 ? 0 : -80 + (i / (ring.count - 1)) * 160;
            const rad = (angle * Math.PI) / 180;
            const x = Math.sin(rad) * ring.rx;
            const y = -Math.cos(rad) * ring.ry + yBase;
            return (
              <div
                className="bookmark-radial__slot"
                key={item.id}
                style={{
                  transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(180% + ${y.toFixed(1)}px))`,
                }}
              >
                {renderItem(item)}
              </div>
            );
          });
        })}
      </div>
    );
  }

  const hasItems = seenNote && items.length > 0;

  return (
    <div ref={barRef} className={barClass} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      {noteBlock}
      {seenNote && items.length === 0 && (
        <span className="bookmark-note">{t("bookmarks.empty")}</span>
      )}
      {hasItems && (
        <>
          <button
            className={`bookmark-bar__scroll-btn ${canScrollLeft ? "bookmark-bar__scroll-btn--visible" : ""}`}
            onClick={() => scrollTrack("left")}
            aria-label="Scroll bookmarks left"
            tabIndex={canScrollLeft ? 0 : -1}
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="bookmark-bar__track"
            ref={trackRef}
            onScroll={updateScrollState}
          >
            {items.map((item) => renderItem(item, item.id))}
          </div>
          <button
            className={`bookmark-bar__scroll-btn ${canScrollRight ? "bookmark-bar__scroll-btn--visible" : ""}`}
            onClick={() => scrollTrack("right")}
            aria-label="Scroll bookmarks right"
            tabIndex={canScrollRight ? 0 : -1}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}

registerFeature({
  id: BOOKMARK_FEATURE_ID,
  zone: "quick-access-bar",
  nameKey: "features.bookmark-bar",
  icon: Bookmark,
  defaultEnabled: true,
  settingsSchema: bookmarkSettingsSchema,
  component: BookmarkBar,
  order: 3,
});

export default BookmarkBar;
