import { newTrack, type TimelineTrack, type TrackItem, type VideoProject } from "./model";

/**
 * Brings a project saved under the old shape into the track model.
 *
 * The old shape was `clips` (a packed video sequence, positions derived from
 * the clips before it) plus `audioTracks` (free-positioned overlay lanes).
 * Everything it could express survives the move; the parts that were pinned
 * to a clip — its blur regions, its text/box overlays — become items on
 * their own tracks, which is what the user asked for and what the old shape
 * could not represent.
 *
 * Run on every load rather than once: a project may have been written by an
 * older build at any time, and a read that silently returns an empty
 * timeline is much worse than one that takes a moment to convert.
 */

/** The fields this reader knows how to pick up; everything else on a stored row is ignored. */
interface LegacyProject {
  tracks?: TimelineTrack[];
  clips?: LegacyClip[];
  audioTracks?: LegacyAudioTrack[];
  videoTrack?: { name?: string; muted?: boolean; hidden?: boolean; locked?: boolean };
}

interface LegacyClip {
  id: string;
  sourceId: string;
  offset: number;
  duration: number;
  rotate?: 0 | 90 | 180 | 270;
  keepOwnAudio?: boolean;
  gapBefore?: number;
  volumeDb?: number;
  position?: { x: number; y: number };
  scale?: number;
  opacity?: number;
  crop?: { left: number; top: number; width: number; height: number };
  cropEnabled?: boolean;
  color?: { brightness: number; contrast: number; saturation: number; temperature: number };
  colorEnabled?: boolean;
  fadeInVideo?: number;
  fadeOutVideo?: number;
  fadeInAudio?: number;
  fadeOutAudio?: number;
  blurRegions?: LegacyBlurRegion[];
  blurEnabled?: boolean;
  overlays?: LegacyOverlay[];
  overlaysEnabled?: boolean;
}

interface LegacyBlurRegion {
  id: string;
  rect: { left: number; top: number; width: number; height: number };
  strength: number;
  startTime?: number;
  endTime?: number;
}

interface LegacyOverlay {
  id: string;
  kind: "text" | "box";
  rect: { left: number; top: number; width: number; height: number };
  text?: string;
  color: string;
  background?: string;
  fontSize?: number;
  opacity?: number;
  startTime?: number;
  endTime?: number;
}

interface LegacyAudioTrack {
  id: string;
  name: string;
  muted?: boolean;
  volumeDb?: number;
  locked?: boolean;
  clips?: LegacyAudioClip[];
}

interface LegacyAudioClip {
  id: string;
  sourceId: string;
  start: number;
  offset: number;
  duration: number;
  gainDb?: number;
  fadeIn?: number;
  fadeOut?: number;
  sourceAudioTrackIndex?: number;
}

export function needsMigration(row: LegacyProject): boolean {
  return !Array.isArray(row.tracks);
}

export function migrateProject(
  row: LegacyProject & Omit<VideoProject, "tracks">,
  names: { video: string; audio: string; text: string; effect: string },
): VideoProject {
  if (Array.isArray(row.tracks)) return row as VideoProject;

  const clips = row.clips ?? [];
  const tracks: TimelineTrack[] = [];

  const videoTrack = newTrack("video", row.videoTrack?.name || names.video);
  videoTrack.muted = row.videoTrack?.muted === true;
  videoTrack.hidden = row.videoTrack?.hidden === true;
  videoTrack.locked = row.videoTrack?.locked === true;

  const effectItems: TrackItem[] = [];
  const textItems: TrackItem[] = [];

  // the old model derived each clip's position from the ones before it, so
  // the running cursor here IS the conversion
  let cursor = 0;
  const outW = row.outputWidth || 1920;
  const outH = row.outputHeight || 1080;

  for (const clip of clips) {
    cursor += clip.gapBefore ?? 0;
    const start = cursor;

    videoTrack.items.push({
      kind: "video",
      id: clip.id,
      sourceId: clip.sourceId,
      start,
      offset: clip.offset,
      duration: clip.duration,
      rotate: clip.rotate ?? 0,
      keepOwnAudio: clip.keepOwnAudio !== false,
      volumeDb: clip.volumeDb,
      scale: clip.scale,
      position: clip.position,
      opacity: clip.opacity,
      fadeIn: clip.fadeInVideo,
      fadeOut: clip.fadeOutVideo,
      audioFadeIn: clip.fadeInAudio,
      audioFadeOut: clip.fadeOutAudio,
      crop: clip.crop,
      cropEnabled: clip.cropEnabled,
      color: clip.color,
      colorEnabled: clip.colorEnabled,
    });

    /*
     * Blur regions and overlays were stored in SOURCE pixels and were only
     * meaningful relative to their clip. As items they are output-space and
     * stand alone, so both the rect and the time window have to be lifted
     * into project space here. The source size is not recorded in the
     * project, so the clip's own crop — or failing that the output frame —
     * is the best scale reference available; a rect may land slightly off on
     * a clip that was scaled, which is still far better than dropping it.
     */
    const refW = clip.crop?.width || outW;
    const refH = clip.crop?.height || outH;
    const toOutput = (rect: { left: number; top: number; width: number; height: number }) => ({
      left: Math.round((rect.left / refW) * outW),
      top: Math.round((rect.top / refH) * outH),
      width: Math.round((rect.width / refW) * outW),
      height: Math.round((rect.height / refH) * outH),
    });
    const windowOf = (r: { startTime?: number; endTime?: number }) => {
      const from = start + (r.startTime ?? 0);
      const to = start + (r.endTime ?? clip.duration);
      return { start: from, duration: Math.max(0.1, to - from) };
    };

    if (clip.blurEnabled !== false) {
      for (const region of clip.blurRegions ?? []) {
        const span = windowOf(region);
        effectItems.push({
          kind: "effect",
          effect: "blur",
          id: region.id,
          start: span.start,
          duration: span.duration,
          rect: toOutput(region.rect),
          strength: Math.max(1, Math.round((region.strength / refW) * outW)),
        });
      }
    }

    if (clip.overlaysEnabled !== false) {
      for (const overlay of clip.overlays ?? []) {
        const span = windowOf(overlay);
        const rect = toOutput(overlay.rect);
        if (overlay.kind === "box") {
          effectItems.push({
            kind: "effect",
            effect: "box",
            id: overlay.id,
            start: span.start,
            duration: span.duration,
            rect,
            color: overlay.color,
            opacity: overlay.opacity,
          });
        } else {
          textItems.push({
            kind: "text",
            id: overlay.id,
            start: span.start,
            duration: span.duration,
            rect,
            text: overlay.text ?? "",
            color: overlay.color,
            background: overlay.background ?? "transparent",
            fontSize: Math.max(8, Math.round(((overlay.fontSize ?? 48) / refW) * outW)),
            align: "center",
            opacity: overlay.opacity,
          });
        }
      }
    }

    cursor = start + clip.duration;
  }

  if (videoTrack.items.length > 0) tracks.push(videoTrack);
  if (effectItems.length > 0) tracks.push({ ...newTrack("effect", names.effect), items: effectItems });
  if (textItems.length > 0) tracks.push({ ...newTrack("text", names.text), items: textItems });

  for (const legacy of row.audioTracks ?? []) {
    const items: TrackItem[] = (legacy.clips ?? []).map((clip) => ({
      kind: "audio",
      id: clip.id,
      sourceId: clip.sourceId,
      start: clip.start,
      offset: clip.offset,
      duration: clip.duration,
      gainDb: clip.gainDb ?? 0,
      fadeIn: clip.fadeIn ?? 0,
      fadeOut: clip.fadeOut ?? 0,
      sourceAudioTrackIndex: clip.sourceAudioTrackIndex,
    }));
    if (items.length === 0) continue;
    tracks.push({
      id: legacy.id,
      kind: "audio",
      name: legacy.name || names.audio,
      items,
      muted: legacy.muted === true,
      hidden: false,
      locked: legacy.locked === true,
      volumeDb: legacy.volumeDb ?? 0,
    });
  }

  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail,
    updatedAt: row.updatedAt,
    outputWidth: outW,
    outputHeight: outH,
    // an existing project already has a frame size in practice, so it should
    // not be interrupted by the new "pick a size" prompt
    frameChosen: true,
    tracks,
  };
}
