import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Folder } from "lucide-react";
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

function FolderButton({ item }: { item: BookmarkItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="bookmark-folder" ref={ref}>
      <button className="bookmark-item" onClick={() => setOpen((o) => !o)} title={item.title}>
        <span className="bookmark-item__letter">
          <Folder size={15} />
        </span>
        <span className="bookmark-item__label">{item.title}</span>
      </button>
      {open && (
        <div className="bookmark-folder__menu">
          {(item.children ?? [])
            .filter((c) => c.url)
            .map((c) => (
              <a key={c.id} className="bookmark-folder__entry" href={c.url}>
                <img src={faviconFor(c.url!)} alt="" loading="lazy" />
                <span>{c.title || c.url}</span>
              </a>
            ))}
        </div>
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
  const barRef = useRef<HTMLDivElement>(null);

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

  // macOS-dock proximity magnification (CSS transform only — light on GPU)
  const onMouseMove = (e: React.MouseEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const nodes = bar.querySelectorAll<HTMLElement>(".bookmark-item");
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

  // hover-hide is pure CSS (:hover) so it never gets stuck showing (no JS state)
  const barClass = [
    "bookmark-bar",
    orientation === "vertical" && "bookmark-bar--vertical",
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
      <FolderButton key={key} item={item} />
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

  // Radial layout: items fan across the upper semicircle (docs/phase-5 §2),
  // which fits the bottom quick-access zone without running off-screen.
  if (orientation === "radial" && seenNote && items.length > 0) {
    const n = items.length;
    const radius = Math.min(150, 70 + n * 8);
    return (
      <div
        ref={barRef}
        className={`bookmark-radial ${showMode === "hover" ? "bookmark-bar--hover-mode" : ""}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ width: radius * 2, height: radius }}
      >
        {items.map((item, i) => {
          const angle = n === 1 ? 0 : -90 + (i / (n - 1)) * 180;
          return (
            <div
              className="bookmark-radial__slot"
              key={item.id}
              style={{
                transform: `translate(-50%, 50%) rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)`,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={barRef} className={barClass} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      {noteBlock}
      {seenNote && items.length === 0 && (
        <span className="bookmark-note">{t("bookmarks.empty")}</span>
      )}
      {seenNote && items.map((item) => renderItem(item, item.id))}
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
