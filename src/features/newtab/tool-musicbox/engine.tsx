import { useEffect, useRef } from "react";
import { CORE_FEATURE_ID, useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import {
  getTrackAudioUrl,
  randomTrackId,
  stepTrack,
  useMusicLibrary,
  usePlayback,
} from "./store";

export const MUSICBOX_FEATURE_ID = "tool-musicbox";

/** Simple frequency-bar analyser wired to the shared <audio> element (lazy,
 * created once — a MediaElementSourceNode can only be attached one time per
 * element). Exposed so both the corner widget and the player can sample it. */
class Visualizer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;

  attach(audio: HTMLAudioElement) {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      const source = this.ctx.createMediaElementSource(audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      source.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch {
      /* AudioContext unavailable — visualizer stays inert */
    }
  }

  read(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyser || !this.data) return null;
    this.analyser.getByteFrequencyData(this.data);
    return this.data;
  }

  resume() {
    void this.ctx?.resume();
  }
}

export const visualizer = new Visualizer();

/** Owns the single shared <audio> element. Mount exactly once (App.tsx) —
 * both the corner widget and the full player window read/drive playback
 * purely through the `usePlayback` store, never touching audio directly. */
export function MusicEngine() {
  const values = useFeatureValues(MUSICBOX_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const core = useFeatureValues(CORE_FEATURE_ID);
  const lowPower = core.lowPower === true;

  const tracks = useMusicLibrary((s) => s.tracks);
  const libraryLoaded = useMusicLibrary((s) => s.loaded);
  const loadLibrary = useMusicLibrary((s) => s.load);

  const currentId = usePlayback((s) => s.currentId);
  const playing = usePlayback((s) => s.playing);
  const volume = usePlayback((s) => s.volume);
  const loop = usePlayback((s) => s.loop);
  const shuffle = usePlayback((s) => s.shuffle);
  const setCurrentId = usePlayback((s) => s.setCurrentId);
  const setPlaying = usePlayback((s) => s.setPlaying);
  const setPosition = usePlayback((s) => s.setPosition);
  const setDuration = usePlayback((s) => s.setDuration);
  const setVolume = usePlayback((s) => s.setVolume);
  const setLoop = usePlayback((s) => s.setLoop);
  const setShuffle = usePlayback((s) => s.setShuffle);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const autoStartRef = useRef(false);

  // one persistent <audio> element for the lifetime of the tab
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onTime = () => setPosition(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (usePlayback.getState().loop) {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      }
      const lib = useMusicLibrary.getState().tracks;
      const pb = usePlayback.getState();
      const next = stepTrack(lib, pb.currentId, pb.shuffle, 1);
      if (next) usePlayback.getState().setCurrentId(next);
      else setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hydrate persisted volume/loop/shuffle once
  useEffect(() => {
    if (hydratedRef.current || !libraryLoaded) return;
    hydratedRef.current = true;
    if (typeof values.volume === "number") setVolume(values.volume);
    if (typeof values.loop === "boolean") setLoop(values.loop);
    if (typeof values.shuffle === "boolean") setShuffle(values.shuffle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryLoaded]);

  useEffect(() => {
    if (!libraryLoaded) void loadLibrary();
  }, [libraryLoaded, loadLibrary]);

  // auto-play / random-on-open — once, after the library is ready
  useEffect(() => {
    if (autoStartRef.current || !libraryLoaded || tracks.length === 0) return;
    autoStartRef.current = true;
    const randomOnOpen = values.randomOnOpen === true;
    const autoPlay = values.autoPlayOnOpen === true;
    if (!randomOnOpen && !autoPlay) return;
    const id = randomOnOpen ? randomTrackId(tracks) : tracks[0].id;
    if (!id) return;
    setCurrentId(id);
    if (autoPlay) {
      const start = () => {
        setPlaying(true);
        window.removeEventListener("click", start);
      };
      // autoplay policy: browsers require a user gesture first
      window.addEventListener("click", start);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryLoaded, tracks]);

  // track change → load new source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentId) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    let cancelled = false;
    void getTrackAudioUrl(currentId).then((url) => {
      if (cancelled || !url) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      audio.src = url;
      if (!lowPower) visualizer.attach(audio);
      if (playing) void audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    visualizer.resume();
    if (playing) void audio.play().catch(() => {});
    else audio.pause();
  }, [playing]);

  // volume + loop + persistence
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
    if (hydratedRef.current) setValue(MUSICBOX_FEATURE_ID, "volume", volume);
  }, [volume, setValue]);
  useEffect(() => {
    if (hydratedRef.current) setValue(MUSICBOX_FEATURE_ID, "loop", loop);
  }, [loop, setValue]);
  useEffect(() => {
    if (hydratedRef.current) setValue(MUSICBOX_FEATURE_ID, "shuffle", shuffle);
  }, [shuffle, setValue]);

  // "only play while on this newtab page" — pause on hide, don't auto-resume
  useEffect(() => {
    if (values.onlyPlayInNewTab !== true) return;
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onVisibility);
    };
  }, [values.onlyPlayInNewTab, setPlaying]);

  return null;
}
