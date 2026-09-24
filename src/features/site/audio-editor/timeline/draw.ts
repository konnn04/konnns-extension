import { clipEffectPeaks } from "../engine/effectPeaks";
import { peaksForWindow } from "../engine/peaks";
import {
  clipEnd,
  clipEnvelopeAt,
  clipIsPlain,
  clipRate,
  type Clip,
  type Project,
} from "../engine/project";
import { formatTime } from "../engine/types";
import type { Selection } from "../store";
import {
  CLIP_HEADER_HEIGHT,
  HEADER_WIDTH,
  RULER_HEIGHT,
  rulerStep,
  trackLayout,
  xAtTime,
  type Viewport,
} from "./viewport";

/**
 * Canvas painting — docs/site/01-audio-editor.md §2.
 *
 * Split into two passes on purpose. `drawTimeline` paints the expensive
 * things (waveforms, clip bodies, the ruler) and only runs when the project,
 * zoom or scroll changes. `drawOverlay` paints the playhead and the selection
 * on a second canvas, every frame. Painting them together would redraw every
 * waveform sixty times a second while the playhead moves — the exact mistake
 * the first version of the minimap made.
 */

/** Canvas needs a literal font stack: it cannot resolve CSS variables. */
const MONO_FONT = '10px "Cascadia Code", "JetBrains Mono", Consolas, monospace';

export interface Palette {
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  border: string;
  surface: string;
  surfaceElevated: string;
  bg: string;
}

/**
 * Canvas silently ignores a fillStyle it cannot parse and keeps the previous
 * colour, so one unsupported theme value would paint the whole timeline in
 * whatever came before — black on black. Probe each value once and fall back
 * rather than discover it as an empty canvas.
 */
function canvasSafe(color: string, fallback: string): string {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return fallback;
  probe.fillStyle = "#000000";
  probe.fillStyle = color;
  // an ignored assignment leaves the sentinel behind
  return probe.fillStyle === "#000000" && color.toLowerCase() !== "#000000" ? fallback : color;
}

export function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    canvasSafe(s.getPropertyValue(name).trim(), fallback);
  return {
    text: v("--text", "#e8f1f8"),
    textMuted: v("--text-muted", "rgba(232,241,248,.62)"),
    accent: v("--accent", "#38bdf8"),
    accentContrast: v("--accent-contrast", "#06222e"),
    border: v("--border", "rgba(232,241,248,.14)"),
    surface: v("--surface", "rgba(15,30,45,.72)"),
    surfaceElevated: v("--surface-elevated", "rgba(22,42,60,.92)"),
    bg: v("--bg", "#0b1622"),
  };
}

export interface DrawState {
  project: Project;
  view: Viewport;
  palette: Palette;
  selection: Selection | null;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  width: number;
  height: number;
}

/* ------------------------------------------------------------ base layer */

export function drawTimeline(ctx: CanvasRenderingContext2D, state: DrawState): void {
  const { palette, width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  drawTracks(ctx, state);
  drawRuler(ctx, state);
  drawTrackHeaders(ctx, state);
}

function drawRuler(ctx: CanvasRenderingContext2D, state: DrawState): void {
  const { view, palette, width } = state;
  ctx.fillStyle = palette.surfaceElevated;
  ctx.fillRect(0, 0, width, RULER_HEIGHT);
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(0, RULER_HEIGHT + 0.5);
  ctx.lineTo(width, RULER_HEIGHT + 0.5);
  ctx.stroke();

  const step = rulerStep(view.pxPerSec);
  const first = Math.floor(view.scrollLeft / step) * step;
  const last = view.scrollLeft + (width - HEADER_WIDTH) / view.pxPerSec;

  ctx.font = MONO_FONT;
  ctx.textBaseline = "middle";
  for (let t = first; t <= last; t += step) {
    const x = xAtTime(view, t);
    if (x < HEADER_WIDTH - 1) continue;
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, RULER_HEIGHT - 6);
    ctx.lineTo(Math.round(x) + 0.5, RULER_HEIGHT);
    ctx.stroke();
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(formatTime(t), Math.round(x) + 4, RULER_HEIGHT / 2);
  }
}

function drawTracks(ctx: CanvasRenderingContext2D, state: DrawState): void {
  const { project, palette, width } = state;
  for (const row of trackLayout(project)) {
    ctx.fillStyle = palette.surface;
    ctx.fillRect(HEADER_WIDTH, row.top, width - HEADER_WIDTH, row.height);
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(HEADER_WIDTH, row.top + row.height + 0.5);
    ctx.lineTo(width, row.top + row.height + 0.5);
    ctx.stroke();

    for (const clip of row.track.clips) {
      drawClip(ctx, state, clip, row.top, row.height);
    }
  }
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  state: DrawState,
  clip: Clip,
  top: number,
  height: number,
): void {
  const { project, view, palette, width } = state;
  const x0 = xAtTime(view, clip.start);
  const x1 = xAtTime(view, clipEnd(clip));
  if (x1 < HEADER_WIDTH || x0 > width) return; // off-screen

  // Clamp to the visible strip so a very long clip does not make the canvas
  // do arithmetic on coordinates hundreds of thousands of pixels wide.
  const left = Math.max(x0, HEADER_WIDTH);
  const right = Math.min(x1, width);
  const w = Math.max(right - left, 1);
  const selected = state.selectedClipIds.includes(clip.id);

  ctx.save();
  ctx.beginPath();
  ctx.rect(HEADER_WIDTH, top, width - HEADER_WIDTH, height);
  ctx.clip();

  // body
  ctx.fillStyle = palette.surfaceElevated;
  ctx.fillRect(left, top, w, height);

  // title bar — the grab handle for moving the clip
  ctx.fillStyle = selected ? palette.accent : palette.border;
  ctx.fillRect(left, top, w, CLIP_HEADER_HEIGHT);
  ctx.fillStyle = selected ? palette.accentContrast : palette.textMuted;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.beginPath();
  ctx.rect(left + 4, top, Math.max(w - 8, 0), CLIP_HEADER_HEIGHT);
  ctx.clip();
  ctx.fillText(clip.name, left + 5, top + CLIP_HEADER_HEIGHT / 2);
  ctx.restore();

  drawWaveform(ctx, state, clip, left, right, top + CLIP_HEADER_HEIGHT, height - CLIP_HEADER_HEIGHT);
  drawFades(ctx, state, clip, x0, x1, top + CLIP_HEADER_HEIGHT, height - CLIP_HEADER_HEIGHT);

  ctx.strokeStyle = selected ? palette.accent : palette.border;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(left + 0.5, top + 0.5, w - 1, height - 1);
  ctx.restore();
  void project;
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  state: DrawState,
  clip: Clip,
  left: number,
  right: number,
  top: number,
  height: number,
): void {
  const source = state.project.sources.get(clip.sourceId);
  if (!source || height <= 2) return;

  // Only the visible slice of the clip is measured, so scrolling a long clip
  // costs the same as a short one.
  const view = state.view;
  const rate = clipRate(clip);
  const fromTime =
    clip.offset + Math.max(0, (left - xAtTime(view, clip.start)) / view.pxPerSec) * rate;
  const toTime =
    clip.offset + Math.max(0, (right - xAtTime(view, clip.start)) / view.pxPerSec) * rate;
  const buckets = Math.max(1, Math.round(right - left));
  // Processed peaks when the clip's filters have already been rendered for
  // this window; the raw ones until they are. A Bass shelf cannot be derived
  // arithmetically, so this is the only way the picture can follow it.
  const channels =
    clipEffectPeaks(source, clip, fromTime, toTime, buckets) ??
    peaksForWindow(source, fromTime, toTime, buckets);
  if (channels.length === 0) return;

  // Draw through the clip's own gain and fades, so the picture matches what
  // playback and export produce. `clipIsPlain` skips the per-pixel maths for
  // the common untouched clip.
  const plain = clipIsPlain(clip);
  const clipX = xAtTime(view, clip.start);

  const laneHeight = height / channels.length;
  ctx.fillStyle = state.palette.accent;
  channels.forEach((peaks, index) => {
    const mid = top + laneHeight * index + laneHeight / 2;
    const scale = (laneHeight / 2) * 0.9;
    for (let i = 0; i < peaks.length; i++) {
      const env = plain ? 1 : clipEnvelopeAt(clip, (left + i - clipX) / view.pxPerSec);
      const v = Math.abs(peaks[i]) * env * scale;
      ctx.fillRect(left + i, mid - v, 1, Math.max(v * 2, 1));
    }
  });
}

/** The two diagonal lines showing a clip's non-destructive edge fades. */
function drawFades(
  ctx: CanvasRenderingContext2D,
  state: DrawState,
  clip: Clip,
  x0: number,
  x1: number,
  top: number,
  height: number,
): void {
  if (clip.fadeIn <= 0 && clip.fadeOut <= 0) return;
  ctx.strokeStyle = state.palette.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (clip.fadeIn > 0) {
    ctx.moveTo(x0, top + height);
    ctx.lineTo(x0 + clip.fadeIn * state.view.pxPerSec, top);
  }
  if (clip.fadeOut > 0) {
    ctx.moveTo(x1 - clip.fadeOut * state.view.pxPerSec, top);
    ctx.lineTo(x1, top + height);
  }
  ctx.stroke();
}

function drawTrackHeaders(ctx: CanvasRenderingContext2D, state: DrawState): void {
  const { project, palette } = state;
  ctx.fillStyle = palette.surfaceElevated;
  ctx.fillRect(0, 0, HEADER_WIDTH, state.height);
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(HEADER_WIDTH + 0.5, 0);
  ctx.lineTo(HEADER_WIDTH + 0.5, state.height);
  ctx.stroke();

  // Only the column background and the row separators. Every label and
  // control in here is real DOM (TrackHeaders), because canvas text cannot
  // ellipsize: drawing the name here too painted it a second time and let a
  // long filename run straight out of the 160px column across the waveforms.
  for (const row of trackLayout(project)) {
    // a picked track gets an accent spine, so "which track am I editing?" is
    // answerable without reading the panel on the other side of the screen
    if (row.track.id === state.selectedTrackId) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(0, row.top, 3, row.height);
    }
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(0, row.top + row.height + 0.5);
    ctx.lineTo(HEADER_WIDTH, row.top + row.height + 0.5);
    ctx.stroke();
  }
}

/* --------------------------------------------------------- overlay layer */

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  state: DrawState & { playhead: number },
): void {
  const { view, palette, width, height, selection, playhead } = state;
  ctx.clearRect(0, 0, width, height);

  if (selection && selection.end > selection.start) {
    const x0 = Math.max(xAtTime(view, selection.start), HEADER_WIDTH);
    const x1 = Math.min(xAtTime(view, selection.end), width);
    if (x1 > x0) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = palette.accent;
      for (const row of trackLayout(state.project)) {
        if (!selection.trackIds.includes(row.track.id)) continue;
        ctx.fillRect(x0, row.top, x1 - x0, row.height);
      }
      ctx.restore();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1;
      for (const x of [x0, x1]) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, RULER_HEIGHT);
        ctx.lineTo(Math.round(x) + 0.5, height);
        ctx.stroke();
      }
    }
  }

  const px = xAtTime(view, playhead);
  if (px >= HEADER_WIDTH && px <= width) {
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(px) + 0.5, 0);
    ctx.lineTo(Math.round(px) + 0.5, height);
    ctx.stroke();
    // little flag at the top so the playhead is findable at a glance
    ctx.fillStyle = palette.text;
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 8);
    ctx.closePath();
    ctx.fill();
  }
}

