import { useEffect, useRef } from "react";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
} from "@/core/settings-engine/settingsStore";

/**
 * Background effect layer (docs item 17) — a transparent canvas above the
 * wallpaper/video: a color tint plus sparkle (bokeh) or galaxy starfield.
 * Auto-off in low-power / reduced-motion.
 */

interface Dot {
  x: number;
  y: number;
  r: number;
  a: number;
  da: number;
  vx: number;
  vy: number;
}

export function BackgroundEffects() {
  const core = useFeatureValues(CORE_FEATURE_ID);
  const effect = (core.bgEffect as string) ?? "none";
  const tint = (core.bgEffectColor as string) ?? "";
  const lowPower =
    core.lowPower === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if ((effect !== "sparkle" && effect !== "galaxy") || lowPower) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let dots: Dot[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = effect === "galaxy" ? 140 : 60;
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: effect === "galaxy" ? Math.random() * 1.4 + 0.2 : Math.random() * 2.5 + 1,
        a: Math.random(),
        da: (Math.random() * 0.02 + 0.004) * (Math.random() < 0.5 ? 1 : -1),
        vx: (Math.random() - 0.5) * (effect === "galaxy" ? 0.06 : 0.12),
        vy: (Math.random() - 0.5) * (effect === "galaxy" ? 0.06 : 0.12),
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.a += d.da;
        if (d.a > 1 || d.a < 0.1) d.da *= -1;
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, d.a) * (effect === "galaxy" ? 0.9 : 0.7)})`;
        if (effect === "sparkle") {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(255,255,255,0.8)";
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [effect, lowPower]);

  const showCanvas = (effect === "sparkle" || effect === "galaxy") && !lowPower;
  const showTint = !!tint;
  if (!showCanvas && !showTint) return null;

  return (
    <>
      {showTint && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: tint,
            mixBlendMode: "soft-light",
            opacity: 0.55,
          }}
        />
      )}
      {showCanvas && (
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }}
        />
      )}
    </>
  );
}
