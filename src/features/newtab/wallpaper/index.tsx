import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { registerFeature } from "@/core/feature-registry";
import { CORE_FEATURE_ID, useFeatureValues } from "@/core/settings-engine/settingsStore";
import { getWallpaperUrl, useWallpaperStore } from "./store";
import { WallpaperManager } from "./WallpaperManager";
import { wallpaperSettingsSchema } from "./settings.schema";
import "./wallpaper.css";

export const WALLPAPER_FEATURE_ID = "wallpaper";

interface Layer {
  key: string;
  url: string;
  type: "image" | "video";
  visible: boolean;
}

/**
 * Background zone renderer. Placeholder = theme gradient shown instantly;
 * the real wallpaper crossfades in once decoded — no white flash, no layout jump
 * (docs/phase-1-mvp/03 §2).
 */
function WallpaperLayer() {
  const values = useFeatureValues(WALLPAPER_FEATURE_ID);
  const coreValues = useFeatureValues(CORE_FEATURE_ID);
  const [layers, setLayers] = useState<Layer[]>([]);
  const urlsRef = useRef<Set<string>>(new Set());
  const touch = useWallpaperStore((s) => s.touch);

  // Slideshow: cycle through the chosen wallpapers on a timer
  const slideshow = values.mode === "slideshow";
  const slideItems = Array.isArray(values.slideItems) ? (values.slideItems as string[]) : [];
  const slideKey = slideItems.join(",");
  const slideInterval =
    typeof values.slideInterval === "number" ? values.slideInterval : 30;
  const slideOrder = (values.slideOrder as string) ?? "sequential";
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    if (!slideshow) return;
    setSlideIdx(0);
    const ids = slideKey ? slideKey.split(",") : [];
    if (ids.length <= 1) return; // nothing to cycle through
    const id = window.setInterval(() => {
      setSlideIdx((i) => {
        if (slideOrder === "random") {
          let n = i;
          while (n === i) n = Math.floor(Math.random() * ids.length);
          return n;
        }
        return (i + 1) % ids.length;
      });
    }, Math.max(5, slideInterval) * 1000);
    return () => window.clearInterval(id);
  }, [slideshow, slideKey, slideInterval, slideOrder]);

  // Random-on-open: pick a random wallpaper from the library each new tab
  const rawRandomMode = values.randomMode;
  const randomModeKind: "off" | "images" | "videos" | "all" =
    rawRandomMode === true
      ? "all"
      : rawRandomMode === false
        ? "off"
        : ((rawRandomMode as "off" | "images" | "videos" | "all") ?? "off");
  const randomMode = randomModeKind !== "off" && !slideshow;
  const items = useWallpaperStore((s) => s.items);
  const itemsLoaded = useWallpaperStore((s) => s.loaded);
  const loadItems = useWallpaperStore((s) => s.load);
  const [randomId, setRandomId] = useState<string | null>(null);
  useEffect(() => {
    if (randomMode && !itemsLoaded) void loadItems();
  }, [randomMode, itemsLoaded, loadItems]);
  useEffect(() => {
    if (randomMode && itemsLoaded && items.length > 0) {
      const pool =
        randomModeKind === "all"
          ? items
          : items.filter((i) => (randomModeKind === "images" ? i.type === "image" : i.type === "video"));
      if (pool.length > 0) setRandomId(pool[Math.floor(Math.random() * pool.length)].id);
    }
    // pick once when random mode turns on / library first loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [randomMode, randomModeKind, itemsLoaded]);

  const slideActiveId =
    slideshow && slideItems.length > 0
      ? slideItems[Math.min(slideIdx, slideItems.length - 1)]
      : null;
  const activeId =
    slideActiveId ??
    (randomMode && randomId ? randomId : ((values.activeId as string) ?? ""));
  const lowPower =
    coreValues.lowPower === true ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const parallaxOn = coreValues.parallax === true && !lowPower;
  const layerRef = useRef<HTMLDivElement>(null);

  // parallax: shift the wallpaper slightly opposite the pointer (docs request, optional)
  useEffect(() => {
    if (!parallaxOn) {
      layerRef.current?.style.removeProperty("--parallax-x");
      layerRef.current?.style.removeProperty("--parallax-y");
      return;
    }
    const onMove = (e: MouseEvent) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;
      const max = 14;
      layerRef.current?.style.setProperty("--parallax-x", `${(-cx * max).toFixed(1)}px`);
      layerRef.current?.style.setProperty("--parallax-y", `${(-cy * max).toFixed(1)}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [parallaxOn]);

  const videoSound = values.videoSound === true;
  const videoVolume = typeof values.videoVolume === "number" ? values.videoVolume : 50;
  const pauseWhenHidden = values.pauseWhenHidden !== false;
  const videoEls = useRef<Set<HTMLVideoElement>>(new Set());

  // apply audio settings to a video element (muted needs to be a property, not attr)
  const applyAudio = useCallback(
    (el: HTMLVideoElement) => {
      el.muted = !videoSound;
      el.volume = Math.min(1, Math.max(0, videoVolume / 100));
    },
    [videoSound, videoVolume],
  );

  const registerVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        videoEls.current.add(el);
        applyAudio(el);
      }
    },
    [applyAudio],
  );

  // periodically prune detached video elements from the tracking set
  useEffect(() => {
    const set = videoEls.current;
    const id = window.setInterval(() => {
      set.forEach((el) => {
        if (!el.isConnected) set.delete(el);
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // re-apply audio when the sliders/toggles change
  useEffect(() => {
    videoEls.current.forEach(applyAudio);
  }, [applyAudio]);

  // pause video while the tab is hidden; resume when it becomes visible again
  // (docs: video only plays on the active NewTab — saves CPU/battery/sound)
  useEffect(() => {
    if (!pauseWhenHidden) return;
    const sync = () => {
      videoEls.current.forEach((el) => {
        if (document.hidden) el.pause();
        else void el.play().catch(() => {});
      });
    };
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, [pauseWhenHidden, layers]);

  useEffect(() => {
    let cancelled = false;

    if (!activeId) {
      setLayers((prev) => prev.map((l) => ({ ...l, visible: false })));
      return;
    }

    void (async () => {
      const res = await getWallpaperUrl(activeId);
      if (!res || cancelled) return;

      // low-power mode: never play video wallpapers, keep gradient instead
      if (res.type === "video" && lowPower) {
        URL.revokeObjectURL(res.url);
        setLayers((prev) => prev.map((l) => ({ ...l, visible: false })));
        return;
      }

      if (res.type === "image") {
        // decode before showing so the crossfade lands on a complete image
        const img = new Image();
        img.src = res.url;
        try {
          await img.decode();
        } catch {
          /* still show — decode() may reject for exotic formats */
        }
        if (cancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
      }

      urlsRef.current.add(res.url);
      void touch(activeId);
      const key = `${activeId}-${Date.now()}`;
      setLayers((prev) => [...prev.filter((l) => l.visible), { key, url: res.url, type: res.type, visible: false }]);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (cancelled) return;
          setLayers((prev) =>
            prev.map((l) => (l.key === key ? { ...l, visible: true } : { ...l, visible: false })),
          );
        }),
      );
      // drop fully faded-out layers after the transition
      window.setTimeout(() => {
        if (cancelled) return;
        setLayers((prev) => {
          for (const l of prev) {
            if (!l.visible && l.key !== key) {
              URL.revokeObjectURL(l.url);
              urlsRef.current.delete(l.url);
            }
          }
          return prev.filter((l) => l.visible || l.key === key);
        });
      }, 700);

      // Immediately pause old video layers so they don't keep playing audio
      // while crossfading out (race condition fix for slideshow / quick switch).
      requestAnimationFrame(() => {
        if (cancelled) return;
        const container = layerRef.current;
        if (!container) return;
        container
          .querySelectorAll<HTMLVideoElement>("video[data-visible='false']")
          .forEach((v) => {
            v.pause();
          });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId, lowPower, touch]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return (
    <div
      ref={layerRef}
      className={`wallpaper-layer ${parallaxOn ? "wallpaper-layer--parallax" : ""}`}
      aria-hidden
    >
      {layers.map((l) =>
        l.type === "video" ? (
          <video
            key={l.key}
            ref={registerVideo}
            className={`wallpaper-layer__media ${l.visible ? "wallpaper-layer__media--visible" : ""}`}
            src={l.url}
            autoPlay
            loop
            playsInline
            data-visible={l.visible}
          />
        ) : (
          <img
            key={l.key}
            className={`wallpaper-layer__media ${l.visible ? "wallpaper-layer__media--visible" : ""}`}
            src={l.url}
            alt=""
          />
        ),
      )}
    </div>
  );
}

registerFeature({
  id: WALLPAPER_FEATURE_ID,
  zone: "background",
  nameKey: "features.wallpaper",
  icon: ImageIcon,
  defaultEnabled: true,
  settingsSchema: wallpaperSettingsSchema,
  component: WallpaperLayer,
  settingsExtra: WallpaperManager,
  order: 0,
});

export default WallpaperLayer;
