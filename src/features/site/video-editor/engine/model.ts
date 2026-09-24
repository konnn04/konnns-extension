/**
 * The timeline model: N typed tracks, each holding freely-positioned items.
 *
 * This replaces the earlier split of "one packed video SEQUENCE plus a couple
 * of audio overlay lanes". That shape could not express what the editor now
 * needs — a caption is not a property of the clip underneath it, an image is
 * not a video, and an effect box has its own lifetime — and every one of
 * those would have become another special case bolted onto `VideoClip`.
 *
 * Two rules give the model its shape:
 *
 *  1. **A track has a kind, and only accepts items of that kind.** The kind
 *     is decided by the first item dropped on it and never changes after.
 *     This is what keeps "which of these things can overlap, and in what
 *     order do they draw" answerable at all: one video track resolves to at
 *     most one picture at a time, audio tracks sum, text and effects always
 *     sit on top.
 *  2. **Every item stores its own `start`.** Nothing is derived from the
 *     item before it any more, so a gap is just a gap and moving one item
 *     never shuffles another. Ripple editing becomes an operation the user
 *     asks for rather than the only thing the data can express.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CropRect = Rect;

/** Colour correction — docs/test-001.md §4.2. Offsets around 0 = unchanged. */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  /** negative = cooler/bluer, positive = warmer/oranger */
  temperature: number;
}

export const NEUTRAL_COLOR: ColorAdjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 };

export type TrackKind = "video" | "audio" | "text" | "effect";

/** What every item has, whatever its kind. */
interface ItemBase {
  id: string;
  /** seconds along the project timeline — stored, never derived */
  start: number;
  duration: number;
}

/** Everything that draws into the frame shares this placement/effect block. */
interface VisualBase extends ItemBase {
  /** percent; 100 = fit the output frame */
  scale?: number;
  /** offset within the output frame, in output pixels */
  position?: { x: number; y: number };
  rotate?: 0 | 90 | 180 | 270;
  /** percent; 100 = fully opaque */
  opacity?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface VideoItem extends VisualBase {
  kind: "video";
  sourceId: string;
  /** where the visible window starts inside the source */
  offset: number;
  /** false = drop this item's own sound from the mix */
  keepOwnAudio: boolean;
  volumeDb?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  crop?: CropRect;
  cropEnabled?: boolean;
  color?: ColorAdjust;
  colorEnabled?: boolean;
}

/**
 * A still. It shares the video lane because they answer the same question —
 * "what picture is on screen at this instant" — and a slideshow cut between
 * a photo and a clip should need no thought about which lane to use.
 */
export interface ImageItem extends VisualBase {
  kind: "image";
  sourceId: string;
  crop?: CropRect;
  cropEnabled?: boolean;
  color?: ColorAdjust;
  colorEnabled?: boolean;
}

export interface AudioItem extends ItemBase {
  kind: "audio";
  sourceId: string;
  offset: number;
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
  /** for sources carrying several audio tracks; undefined = the primary one */
  sourceAudioTrackIndex?: number;
}

export interface TextItem extends VisualBase {
  kind: "text";
  /** in OUTPUT pixels — text is authored against the finished frame, not against any one source */
  rect: Rect;
  text: string;
  color: string;
  /** the plate behind the words; "transparent" for none */
  background: string;
  /** in output pixels */
  fontSize: number;
  align: "left" | "center" | "right";
  /**
   * Outline around the glyphs, in output pixels. 0 = none.
   *
   * This is what makes a caption readable over footage at all: white text on
   * a bright frame disappears, and a background plate hides the picture. An
   * outline solves it without covering anything.
   */
  strokeWidth?: number;
  strokeColor?: string;
}

/**
 * A cover-up: blur, or a solid box. Both exist for the same job — hiding
 * something that must not be readable in a screen recording — and a box is
 * the stronger of the two, since blur can sometimes be reversed enough to
 * read short text back.
 */
export interface EffectItem extends ItemBase {
  kind: "effect";
  effect: "blur" | "box";
  /** in OUTPUT pixels, same as text */
  rect: Rect;
  /** `blur`: gaussian radius in output pixels */
  strength?: number;
  /** `box`: fill colour */
  color?: string;
  opacity?: number;
}

export type TrackItem = VideoItem | ImageItem | AudioItem | TextItem | EffectItem;
export type VisualItem = VideoItem | ImageItem | TextItem | EffectItem;
/**
 * The visual kinds that carry placement and fade. An effect is deliberately
 * NOT one of them: it is a rectangle stamped straight onto the finished
 * frame, so scaling or fading it would only weaken the thing it exists to
 * hide.
 */
export type PlacedItem = VideoItem | ImageItem | TextItem;

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  name: string;
  items: TrackItem[];
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  /** audio and video tracks only */
  volumeDb: number;
}

/** Which item kinds a track of each kind will take (rule 1 above). */
export const TRACK_ACCEPTS: Record<TrackKind, TrackItem["kind"][]> = {
  // a still and a clip answer the same question, so they share a lane
  video: ["video", "image"],
  audio: ["audio"],
  text: ["text"],
  effect: ["effect"],
};

export function trackKindFor(itemKind: TrackItem["kind"]): TrackKind {
  if (itemKind === "video" || itemKind === "image") return "video";
  if (itemKind === "audio") return "audio";
  if (itemKind === "text") return "text";
  return "effect";
}

export function trackAccepts(track: TimelineTrack, itemKind: TrackItem["kind"]): boolean {
  return TRACK_ACCEPTS[track.kind].includes(itemKind);
}

export function isVisual(item: TrackItem): item is VisualItem {
  return item.kind !== "audio";
}

/** Anything that is a window into a stored file. */
export function hasSource(item: TrackItem): item is VideoItem | ImageItem | AudioItem {
  return item.kind === "video" || item.kind === "image" || item.kind === "audio";
}

/* ------------------------------------------------------------------ media */

export type MediaKind = "video" | "audio" | "image";

/** One imported file, listed in the media bin and referenced by id from items. */
export interface MediaSource {
  id: string;
  fileName: string;
  mediaKind: MediaKind;
  /** 0 for a still */
  duration: number;
  width: number;
  height: number;
  /** true when the file carries at least one audio track — decides whether audio controls are shown at all */
  hasAudio?: boolean;
}

/** How long a still runs when first dropped on the timeline. */
export const DEFAULT_IMAGE_DURATION = 5;

/* ---------------------------------------------------------------- project */

/**
 * Output frame presets. Picking one BEFORE editing is the point: an editor
 * that starts as an undefined black rectangle gives you nothing to position
 * or scale against.
 */
export interface FramePreset {
  id: string;
  label: string;
  ratio: number;
  width: number;
  height: number;
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: "16:9", label: "16:9", ratio: 16 / 9, width: 1920, height: 1080 },
  { id: "9:16", label: "9:16", ratio: 9 / 16, width: 1080, height: 1920 },
  { id: "1:1", label: "1:1", ratio: 1, width: 1080, height: 1080 },
  { id: "4:3", label: "4:3", ratio: 4 / 3, width: 1440, height: 1080 },
  { id: "4:5", label: "4:5", ratio: 4 / 5, width: 1080, height: 1350 },
  { id: "21:9", label: "21:9", ratio: 21 / 9, width: 2560, height: 1080 },
];

export interface VideoProjectSummary {
  id: string;
  name: string;
  thumbnail: string;
  updatedAt: number;
}

export interface VideoProject extends VideoProjectSummary {
  tracks: TimelineTrack[];
  outputWidth: number;
  outputHeight: number;
  /** true once the user has picked a frame size, so the prompt is not shown again */
  frameChosen?: boolean;
}

export function newProject(name: string): VideoProject {
  const preset = FRAME_PRESETS[0];
  return {
    id: crypto.randomUUID(),
    name,
    thumbnail: "",
    updatedAt: Date.now(),
    tracks: [],
    outputWidth: preset.width,
    outputHeight: preset.height,
  };
}

export function newTrack(kind: TrackKind, name: string): TimelineTrack {
  return { id: crypto.randomUUID(), kind, name, items: [], muted: false, hidden: false, locked: false, volumeDb: 0 };
}

/* ------------------------------------------------------- resolved defaults */

export interface ResolvedVisual {
  scale: number;
  position: { x: number; y: number };
  rotate: 0 | 90 | 180 | 270;
  opacity: number;
  fadeIn: number;
  fadeOut: number;
  crop: CropRect | null;
  color: ColorAdjust | null;
}

/**
 * One place that decides what "unset" means, rather than scattering `?? 0`
 * through the render and export paths — and the reason every optional field
 * above can be added later without breaking a saved project.
 */
export function resolveVisual(item: PlacedItem): ResolvedVisual {
  const withCrop = item.kind === "video" || item.kind === "image" ? item : null;
  return {
    scale: item.scale ?? 100,
    position: item.position ?? { x: 0, y: 0 },
    rotate: item.rotate ?? 0,
    opacity: item.opacity ?? 100,
    fadeIn: item.fadeIn ?? 0,
    fadeOut: item.fadeOut ?? 0,
    crop: withCrop?.crop && withCrop.cropEnabled !== false ? withCrop.crop : null,
    color: withCrop?.color && withCrop.colorEnabled !== false ? withCrop.color : null,
  };
}

/**
 * Where a new track of each kind belongs, top of the list first.
 *
 * The list reads top-to-bottom the way the timeline shows it, and the track
 * at the TOP draws on top (see `layersAt`). So captions sit above cover
 * boxes, both sit above the picture, and audio — which draws nothing — sits
 * at the bottom out of the way.
 */
const KIND_ORDER: Record<TrackKind, number> = { text: 0, effect: 1, video: 2, audio: 3 };

export function sortTracksByKind(tracks: TimelineTrack[]): TimelineTrack[] {
  return [...tracks].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/**
 * Put a new track where its kind belongs WITHOUT re-sorting the rest.
 *
 * Re-sorting would be simpler, but tracks can be reordered by hand now, and
 * an import that quietly undid that arrangement would be worse than a new
 * track landing one row from where you expected.
 */
export function insertTrack(tracks: TimelineTrack[], track: TimelineTrack): TimelineTrack[] {
  const sameKind = tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === track.kind);
  if (sameKind.length > 0) {
    const after = sameKind[sameKind.length - 1].i + 1;
    return [...tracks.slice(0, after), track, ...tracks.slice(after)];
  }

  const at = tracks.findIndex((t) => KIND_ORDER[t.kind] > KIND_ORDER[track.kind]);
  return at === -1 ? [...tracks, track] : [...tracks.slice(0, at), track, ...tracks.slice(at)];
}

/** Move one track up or down the stack, which is also what changes what draws over what. */
export function moveTrack(tracks: TimelineTrack[], trackId: string, direction: -1 | 1): TimelineTrack[] {
  const from = tracks.findIndex((t) => t.id === trackId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= tracks.length) return tracks;

  const next = [...tracks];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function removeTrack(tracks: TimelineTrack[], trackId: string): TimelineTrack[] {
  return tracks.filter((t) => t.id !== trackId);
}
