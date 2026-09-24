import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { formatTimecode, ticksFor, tickIntervalFor, timeAtX } from "./engine/ruler";

/**
 * Ruler + playhead — docs/test-001.md §1.1, the piece the previous timeline
 * was missing entirely (it only had `0:06 / 0:19` as text in a corner).
 *
 * Three ways to move, all landing in the same `onSeek`:
 *  - click anywhere on the ruler
 *  - drag the playhead head (scrubbing — preview follows live)
 *  - click on a track (wired up by the parent, which passes the same handler)
 *
 * The readout rides ALONG the playhead while scrubbing rather than sitting
 * in a fixed corner, so the number is under the cursor doing the work.
 */
export function TimelineScrubber({
  duration,
  pxPerSecond,
  playheadTime,
  tracksHeight,
  width,
  playing,
  smoothTimeRef,
  onSeek,
  onScrubStateChange,
}: {
  duration: number;
  pxPerSecond: number;
  playheadTime: number;
  /** how far down the playhead line should reach, i.e. the height of the track stack */
  tracksHeight: number;
  /** the scroller's full content width, so the ruler stays clickable past the last clip */
  width: number;
  playing?: boolean;
  /**
   * The true playhead position, written every animation frame by the player.
   * While playing, the marker and its timecode are moved straight on the DOM
   * from this — React state only ticks at 10Hz, and driving the whole editor
   * through a re-render per frame to get a smooth playhead would be a poor
   * trade. When paused, `playheadTime` is the source of truth as usual.
   */
  smoothTimeRef?: MutableRefObject<number>;
  onSeek: (time: number) => void;
  onScrubStateChange?: (scrubbing: boolean) => void;
}) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!playing || !smoothTimeRef) return;
    let raf = 0;
    let lastTenth = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const time = smoothTimeRef.current;
      if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSecond}px`;

      // the number only has tenths, so rewriting it 60 times a second would
      // be 54 wasted layout passes
      const tenth = Math.floor(time * 10);
      if (tenth !== lastTenth && readoutRef.current) {
        lastTenth = tenth;
        readoutRef.current.textContent = formatTimecode(time, true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, smoothTimeRef, pxPerSecond]);

  /*
   * When paused, put the marker back under React's control explicitly.
   * React only rewrites `style.left` when the value it renders CHANGES, so
   * after the loop above has moved the element imperatively, a re-render
   * computing the same left as before would leave it stranded wherever the
   * last animation frame put it.
   */
  useEffect(() => {
    if (playing) return;
    if (playheadRef.current) playheadRef.current.style.left = `${playheadTime * pxPerSecond}px`;
    if (readoutRef.current) readoutRef.current.textContent = formatTimecode(playheadTime, true);
  }, [playing, playheadTime, pxPerSecond]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return;
      onSeek(timeAtX(clientX - rect.left, pxPerSecond, duration));
    },
    [duration, pxPerSecond, onSeek],
  );

  const beginScrub = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      scrubbingRef.current = true;
      onScrubStateChange?.(true);
      seekFromEvent(e.clientX);

      const onMove = (ev: MouseEvent) => scrubbingRef.current && seekFromEvent(ev.clientX);
      const onUp = () => {
        scrubbingRef.current = false;
        onScrubStateChange?.(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekFromEvent, onScrubStateChange],
  );

  const interval = tickIntervalFor(pxPerSecond);
  const ticks = ticksFor(duration, pxPerSecond);

  return (
    <div className="vied__ruler-wrap">
      <div className="vied__ruler" ref={rulerRef} style={{ width }} onMouseDown={beginScrub}>
        {ticks.map((t) => (
          <span key={t} className="vied__tick" style={{ left: t * pxPerSecond }}>
            <span className="vied__tick-label">{formatTimecode(t, interval < 1)}</span>
          </span>
        ))}
      </div>

      <div
        ref={playheadRef}
        className="vied__playhead"
        style={{ left: playheadTime * pxPerSecond, height: tracksHeight + 22 }}
      >
        <span className="vied__playhead-head" onMouseDown={beginScrub} />
        <span ref={readoutRef} className="vied__playhead-time">
          {formatTimecode(playheadTime, true)}
        </span>
      </div>
    </div>
  );
}
