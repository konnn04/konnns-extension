import { useEffect, useRef } from "react";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
} from "@/core/settings-engine/settingsStore";

/**
 * Custom cursor + trailing effects (docs item 16 + tweak). Shapes are drawn as
 * vectors on a canvas (not emoji) so they look crisp and match the theme:
 * hearts / stars / flowers. Spawn rate + density are kept low and subtle.
 * Auto-off in low-power / reduced-motion.
 */

type Shape = "hearts" | "stars" | "flowers";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 32;
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * k);
  ctx.bezierCurveTo(x, y + 2 * k, x - 8 * k, y - 6 * k, x - 8 * k, y + 1 * k);
  ctx.bezierCurveTo(x - 8 * k, y + 8 * k, x, y + 12 * k, x, y + 16 * k);
  ctx.bezierCurveTo(x, y + 12 * k, x + 8 * k, y + 8 * k, x + 8 * k, y + 1 * k);
  ctx.bezierCurveTo(x + 8 * k, y - 6 * k, x, y + 2 * k, x, y + 6 * k);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  p: Particle,
) {
  const a = Math.max(0, p.life);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  if (shape === "hearts") {
    ctx.fillStyle = `rgba(244,63,94,${a})`;
    heartPath(ctx, 0, -p.size / 2, p.size);
    ctx.fill();
  } else if (shape === "stars") {
    ctx.fillStyle = `rgba(250,204,21,${a})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(255,240,180,${a})`;
    starPath(ctx, 0, 0, p.size / 2);
    ctx.fill();
  } else {
    // flower: 5 petals + center
    const r = p.size / 2;
    ctx.fillStyle = `rgba(244,114,182,${a})`;
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * r * 0.55, Math.sin(ang) * r * 0.55, r * 0.5, r * 0.26, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(250,204,21,${a})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function CursorEffects() {
  const core = useFeatureValues(CORE_FEATURE_ID);
  const effect = (core.cursorEffect as string) ?? "none";
  const lowPower =
    core.lowPower === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const isShape = effect === "hearts" || effect === "stars" || effect === "flowers";
    if (!isShape || lowPower) return;
    const shape = effect as Shape;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let particles: Particle[] = [];
    let raf = 0;
    let lastSpawn = 0;
    let lastX = 0;
    let lastY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      // lower frequency (min gap) + lower density (require some movement)
      const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (now - lastSpawn < 110 || moved < 22) return;
      lastSpawn = now;
      lastX = e.clientX;
      lastY = e.clientY;
      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 0.7,
        life: 1,
        size: 16 + Math.random() * 8,
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.03,
      });
      if (particles.length > 24) particles.shift();
    };
    window.addEventListener("mousemove", onMove);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.014;
        drawShape(ctx, shape, p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [effect, lowPower]);

  const showCanvas =
    (effect === "hearts" || effect === "stars" || effect === "flowers") && !lowPower;
  if (!showCanvas) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" }}
    />
  );
}
