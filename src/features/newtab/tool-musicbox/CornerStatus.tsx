import { useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { MUSICBOX_FEATURE_ID, visualizer } from "./engine";
import { useMusicLibrary, usePlayback } from "./store";
import "./musicbox.css";

/** Waveform-style bars sampled from the shared analyser (see engine.tsx). */
function VisualizerBars({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf: number;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const data = visualizer.read();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!data) return;
      const bars = 12;
      const step = Math.floor(data.length / bars);
      const barW = canvas.width / bars;
      ctx.fillStyle = "currentColor";
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const h = Math.max(2, v * canvas.height);
        ctx.fillRect(i * barW + 1, canvas.height - h, barW - 2, h);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <canvas ref={ref} className="mb-corner__viz" width={48} height={18} />;
}

/** Top-right "status bar" pill — title, artist, play/pause. Always mounted;
 * renders nothing until a track has been selected. */
export function MusicCornerStatus() {
  const values = useFeatureValues(MUSICBOX_FEATURE_ID);
  const show = values.showCornerStatus !== false;
  const showViz = values.showVisualizer === true;

  const currentId = usePlayback((s) => s.currentId);
  const playing = usePlayback((s) => s.playing);
  const setPlaying = usePlayback((s) => s.setPlaying);
  const tracks = useMusicLibrary((s) => s.tracks);
  const track = tracks.find((t) => t.id === currentId);

  if (!show || !track) return null;

  return (
    <div className="mb-corner">
      <button
        type="button"
        className="mb-corner__play"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <span className="mb-corner__meta">
        <span className="mb-corner__title">{track.title}</span>
        <span className="mb-corner__artist">{track.artist}</span>
      </span>
      {showViz && <VisualizerBars active={playing} />}
    </div>
  );
}
