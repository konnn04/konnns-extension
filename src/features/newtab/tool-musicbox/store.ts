import { create } from "zustand";
import { db, type MusicTrackRow } from "@/core/storage/db";

export const MAX_TRACK_BYTES = 50 * 1024 * 1024; // 50MB per track

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  album?: string;
  hasThumbnail: boolean;
  fileName: string;
  size: number;
  duration: number;
  createdAt: number;
}

export interface NewTrackInput {
  file: File;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: File;
}

function toMeta(row: MusicTrackRow): TrackMeta {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    hasThumbnail: !!row.thumbnail,
    fileName: row.fileName,
    size: row.size,
    duration: row.duration,
    createdAt: row.createdAt,
  };
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    audio.addEventListener("loadedmetadata", () => done(audio.duration || 0));
    audio.addEventListener("error", () => done(0));
  });
}

interface MusicLibraryState {
  loaded: boolean;
  tracks: TrackMeta[];
  load: () => Promise<void>;
  addTrack: (input: NewTrackInput) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

export const useMusicLibrary = create<MusicLibraryState>((set, get) => ({
  loaded: false,
  tracks: [],

  load: async () => {
    const rows = await db.musicTracks.orderBy("createdAt").reverse().toArray();
    set({ tracks: rows.map(toMeta), loaded: true });
  },

  addTrack: async (input) => {
    if (input.file.size > MAX_TRACK_BYTES) throw new Error("track-too-large");
    const duration = await readAudioDuration(input.file);
    const row: MusicTrackRow = {
      id: crypto.randomUUID(),
      blob: input.file,
      title: input.title.trim() || input.file.name,
      artist: input.artist.trim() || "—",
      album: input.album?.trim() || undefined,
      thumbnail: input.thumbnail,
      fileName: input.file.name,
      size: input.file.size,
      duration,
      createdAt: Date.now(),
    };
    await db.musicTracks.add(row);
    set({ tracks: [toMeta(row), ...get().tracks] });
    return row.id;
  },

  remove: async (id) => {
    await db.musicTracks.delete(id);
    set({ tracks: get().tracks.filter((t) => t.id !== id) });
  },
}));

export async function getTrackAudioUrl(id: string): Promise<string | null> {
  const row = await db.musicTracks.get(id);
  if (!row) return null;
  return URL.createObjectURL(row.blob);
}

export async function getTrackThumbUrl(id: string): Promise<string | null> {
  const row = await db.musicTracks.get(id);
  if (!row?.thumbnail) return null;
  return URL.createObjectURL(row.thumbnail);
}

// ---------------------------------------------------------------------------
// Playback engine — a single shared <audio> element so the corner status
// widget and the full player window (mounted/unmounted independently) always
// reflect the same state. `usePlayback` is the reactive store; `MusicEngine`
// (in engine.tsx) is the one component that owns the <audio> element.

interface PlaybackState {
  currentId: string | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number; // 0-100, persisted via settings
  loop: boolean;
  shuffle: boolean;
  playOrder: string[];
  setCurrentId: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setLoop: (loop: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setPlayOrder: (order: string[]) => void;
}

export const usePlayback = create<PlaybackState>((set) => ({
  currentId: null,
  playing: false,
  position: 0,
  duration: 0,
  volume: 60,
  loop: false,
  shuffle: false,
  playOrder: [],
  setCurrentId: (currentId) => set({ currentId }),
  setPlaying: (playing) => set({ playing }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setLoop: (loop) => set({ loop }),
  setShuffle: (shuffle) => set({ shuffle }),
  setPlayOrder: (playOrder) => set({ playOrder }),
}));

function shuffleArray(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Picks the next/previous track id given the current order + shuffle state. */
export function stepTrack(
  tracks: TrackMeta[],
  currentId: string | null,
  shuffle: boolean,
  direction: 1 | -1,
): string | null {
  if (tracks.length === 0) return null;
  const ids = shuffle ? shuffleArray(tracks.map((t) => t.id)) : tracks.map((t) => t.id);
  const idx = currentId ? ids.indexOf(currentId) : -1;
  if (idx === -1) return ids[0] ?? null;
  const next = (idx + direction + ids.length) % ids.length;
  return ids[next] ?? null;
}

export function randomTrackId(tracks: TrackMeta[]): string | null {
  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)].id;
}
