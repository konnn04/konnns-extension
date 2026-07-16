import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, Film, Link, Eraser, Shuffle, Check, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton, TextInput } from "@/shared/ui";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { estimateStorage } from "@/core/storage/db";
import { useWallpaperStore, type WallpaperMeta } from "./store";
import { getWallpaperUrl } from "./store";
import { MAX_VIDEO_BYTES } from "./image";

const FEATURE_ID = "wallpaper";

function Thumb({ item }: { item: WallpaperMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void getWallpaperUrl(item.id).then((res) => {
      if (res) {
        revoked = res.url;
        setUrl(res.url);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [item.id]);

  if (!url) return <div className="wp-item__gradient" style={{ background: "var(--surface)" }} />;
  return item.type === "video" ? (
    <video className="wp-item__thumb" src={url} muted />
  ) : (
    <img className="wp-item__thumb" src={url} alt={item.name} />
  );
}

/** Wallpaper library UI shown inside Settings (custom section under the schema form). */
export function WallpaperManager() {
  const { t } = useTranslation();
  const { items, loaded, load, addImageFile, addVideoFile, addFromUrl, remove, cleanup } =
    useWallpaperStore();
  const values = useFeatureValues(FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const activeId = (values.activeId as string) ?? "";
  const inSlideshow = values.mode === "slideshow";
  const slideItems = Array.isArray(values.slideItems) ? (values.slideItems as string[]) : [];
  const toggleSlide = (id: string) => {
    const next = slideItems.includes(id)
      ? slideItems.filter((x) => x !== id)
      : [...slideItems, id];
    setValue(FEATURE_ID, "slideItems", next);
  };

  const imgInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    void estimateStorage().then((est) => {
      if (est) setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB`);
    });
  }, [items.length]);

  const setActive = (id: string) => setValue(FEATURE_ID, "activeId", id);

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "image-too-large") setError(t("wallpaper.imageTooLarge"));
    else if (msg === "video-too-large") setError(t("wallpaper.videoTooLarge"));
    else setError(t("wallpaper.loadUrlError"));
  };

  return (
    <div className="wp-manager">
      <h3 className="ui-field__label" style={{ marginBottom: "var(--space-2)" }}>
        {t("wallpaper.library")}
      </h3>
      <p className="ui-field__desc" style={{ marginBottom: "var(--space-3)" }}>
        {t("wallpaper.storageNote")}
      </p>

      <div className="wp-manager__actions">
        <Button size="sm" onClick={() => imgInput.current?.click()}>
          <Upload size={15} /> {t("wallpaper.upload")}
        </Button>
        <Button size="sm" onClick={() => videoInput.current?.click()}>
          <Film size={15} /> {t("wallpaper.uploadVideo")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            setError(null);
            try {
              // Lorem Picsum — keyless public source (docs/bonus-public-api.md)
              setActive(await addFromUrl(`https://picsum.photos/1920/1080?random=${Date.now()}`));
            } catch (err) {
              onError(err);
            }
          }}
        >
          <Shuffle size={15} /> {t("wallpaper.random")}
        </Button>
        <input
          ref={imgInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setError(null);
            try {
              setActive(await addImageFile(f));
            } catch (err) {
              onError(err);
            }
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setError(null);
            if (f.size > MAX_VIDEO_BYTES) {
              setError(t("wallpaper.videoTooLarge"));
              return;
            }
            if (f.size > 20 * 1024 * 1024 && !window.confirm(t("wallpaper.videoWarn"))) return;
            try {
              setActive(await addVideoFile(f));
            } catch (err) {
              onError(err);
            }
          }}
        />
      </div>

      <div className="wp-manager__url">
        <TextInput
          placeholder={t("wallpaper.urlPlaceholder")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!url.trim()}
          onClick={async () => {
            setError(null);
            try {
              setActive(await addFromUrl(url.trim()));
              setUrl("");
            } catch (err) {
              onError(err);
            }
          }}
        >
          <Link size={15} /> {t("wallpaper.add")}
        </Button>
      </div>

      {error && <div className="ui-field__error" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}

      {inSlideshow && (
        <p className="ui-field__desc" style={{ marginBottom: "var(--space-2)" }}>
          {t("wallpaper.slidePick", { count: slideItems.length })}
        </p>
      )}

      <div className="wp-manager__grid">
        {/* theme gradient is always the first, deletable-never option */}
        <div
          className={`wp-item ${activeId === "" ? "wp-item--active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setActive("")}
          onKeyDown={(e) => e.key === "Enter" && setActive("")}
        >
          <div className="wp-item__gradient" style={{ background: "var(--theme-gradient)" }} />
          {activeId === "" && <span className="wp-item__badge">{t("wallpaper.active")}</span>}
        </div>

        {items.map((item) => (
          <div
            key={item.id}
            className={`wp-item ${activeId === item.id ? "wp-item--active" : ""}`}
            role="button"
            tabIndex={0}
            title={`${item.name} — ${(item.size / 1024 / 1024).toFixed(1)}MB`}
            onClick={() => setActive(item.id)}
            onKeyDown={(e) => e.key === "Enter" && setActive(item.id)}
          >
            <Thumb item={item} />
            {activeId === item.id && <span className="wp-item__badge">{t("wallpaper.active")}</span>}
            {inSlideshow && (
              <button
                className={`wp-item__slide ${slideItems.includes(item.id) ? "wp-item__slide--on" : ""}`}
                title={t("wallpaper.slideToggle")}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSlide(item.id);
                }}
              >
                {slideItems.includes(item.id) ? <Check size={14} /> : <Plus size={14} />}
              </button>
            )}
            <IconButton
              label={t("common.delete")}
              className="wp-item__delete"
              onClick={(e) => {
                e.stopPropagation();
                if (activeId === item.id) setActive("");
                void remove(item.id);
              }}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="ui-field__desc" style={{ marginTop: "var(--space-3)" }}>
          {t("wallpaper.empty")}
        </p>
      )}

      <div className="wp-manager__meta">
        <span>
          {t("settings.storageUsage")}: {usage ?? "…"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm(t("wallpaper.cleanupConfirm"))) void cleanup([activeId]);
          }}
        >
          <Eraser size={15} /> {t("wallpaper.cleanup")}
        </Button>
      </div>
    </div>
  );
}
