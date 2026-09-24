import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardPaste,
  Copy,
  Crop,
  Headphones,
  Music,
  Scissors,
  Trash2,
  VolumeX,
} from "lucide-react";
import * as P from "./engine/project";
import { separateVocalInstrument } from "./engine/dsp";
import { report } from "./engine/activity";
import { formatTime } from "./engine/types";
import { effectiveRange, useAudioEditor } from "./store";
import type { Hit } from "./timeline/hitTest";

export interface MenuState {
  x: number;
  y: number;
  time: number;
  hit: Hit;
}

/**
 * Right-click menu — docs/site/01-audio-editor.md §4.
 *
 * Its main job is to keep two operations visibly distinct, because users
 * routinely conflate them: "Delete and close gap" shortens the timeline,
 * "Silence" keeps its length. Naming both, side by side, beats one Delete
 * whose behaviour you have to remember.
 */
export function ContextMenu({ state, onClose }: { state: MenuState | null; onClose: () => void }) {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const selection = useAudioEditor((s) => s.selection);
  const playing = useAudioEditor((s) => s.playing);
  const commit = useAudioEditor((s) => s.commit);
  const playRange = useAudioEditor((s) => s.playRange);
  const selectedClipIds = useAudioEditor((s) => s.selectedClipIds);
  const removeSelectedClips = useAudioEditor((s) => s.removeSelectedClips);
  const clipboard = useAudioEditor((s) => s.clipboard);
  const copySelection = useAudioEditor((s) => s.copySelection);
  const cutSelection = useAudioEditor((s) => s.cutSelection);
  const pasteAtPlayhead = useAudioEditor((s) => s.pasteAtPlayhead);

  // effectiveRange allocates, so it must not be a zustand selector itself.
  const range = useMemo(
    () => effectiveRange({ project, selection, selectedClipIds }),
    [project, selection, selectedClipIds],
  );

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [state, onClose]);

  if (!state) return null;

  const { hit, time } = state;
  const clip = hit.clip;
  const trackIds = selection?.trackIds ?? (hit.track ? [hit.track.id] : []);
  const hasSelection = !!selection && selection.end > selection.start;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const handleSplitVocalBeat = async (targetClip: P.Clip) => {
    const source = project.sources.get(targetClip.sourceId);
    if (!source) return;

    await report("audio.splittingVocalBeat", async (progress) => {
      progress(0.1);
      const vocalBuffer = await separateVocalInstrument(source, "vocal");
      progress(0.6);
      const beatBuffer = await separateVocalInstrument(source, "karaoke");
      progress(0.9);

      let next = project;
      const beatRes = P.addClipToTrack(
        next,
        crypto.randomUUID(),
        beatBuffer,
        `${targetClip.name} (Beat)`,
        targetClip.start,
      );
      next = beatRes.project;
      const beatTrack = next.tracks[next.tracks.length - 1];
      if (beatTrack && beatTrack.clips[0]) {
        beatTrack.clips[0].offset = targetClip.offset;
        beatTrack.clips[0].duration = targetClip.duration;
        beatTrack.clips[0].fadeIn = targetClip.fadeIn;
        beatTrack.clips[0].fadeOut = targetClip.fadeOut;
      }

      const vocalRes = P.addClipToTrack(
        next,
        crypto.randomUUID(),
        vocalBuffer,
        `${targetClip.name} (Vocal)`,
        targetClip.start,
      );
      next = vocalRes.project;
      const vocalTrack = next.tracks[next.tracks.length - 1];
      if (vocalTrack && vocalTrack.clips[0]) {
        vocalTrack.clips[0].offset = targetClip.offset;
        vocalTrack.clips[0].duration = targetClip.duration;
        vocalTrack.clips[0].fadeIn = targetClip.fadeIn;
        vocalTrack.clips[0].fadeOut = targetClip.fadeOut;
      }

      commit(next, {
        key: "audio.cmd.splitVocalBeat",
        params: { name: targetClip.name },
      });
      progress(1);
    });
  };

  const rangeLabel = hasSelection
    ? `${formatTime(selection.start)}–${formatTime(selection.end)}`
    : "";

  return (
    <ul className="ae__ctxmenu" style={{ left: state.x, top: state.y }} onPointerDown={(e) => e.stopPropagation()}>
      {clip && (
        <li>
          <button
            type="button"
            disabled={playing}
            title={playing ? t("audio.pauseToApply") : undefined}
            onClick={act(() => void handleSplitVocalBeat(clip))}
          >
            <Music size={14} />
            {t("audio.splitVocalBeat")}
          </button>
        </li>
      )}

      {clip && hit.track && (
        <li>
          <button
            type="button"
            onClick={act(() =>
              commit(P.splitAt(project, hit.track!.id, time), {
                key: "audio.cmd.splitClip",
                params: { at: formatTime(time) },
              }),
            )}
          >
            <Scissors size={14} />
            {t("audio.splitHere")}
          </button>
        </li>
      )}

      {clip && (
        <li>
          <button
            type="button"
            disabled={playing}
            title={playing ? t("audio.pauseToApply") : undefined}
            onClick={act(() => {
              // right-clicking inside a multi-selection acts on all of it;
              // right-clicking elsewhere acts on the clip under the cursor
              if (selectedClipIds.includes(clip.id) && selectedClipIds.length > 1) {
                removeSelectedClips();
                return;
              }
              commit(P.removeClip(project, clip.id), {
                key: "audio.cmd.removeClip",
                params: { name: clip.name },
              });
            })}
          >
            <Trash2 size={14} />
            {selectedClipIds.includes(clip.id) && selectedClipIds.length > 1
              ? t("audio.removeClips", { count: selectedClipIds.length })
              : t("audio.removeClip")}
          </button>
        </li>
      )}

      {range && (
        <>
          <li className="ae__ctxmenu-sep" />
          <li>
            <button type="button" onClick={act(() => copySelection())}>
              <Copy size={14} />
              {t("audio.copy")}
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled={playing}
              title={playing ? t("audio.pauseToApply") : undefined}
              onClick={act(() => cutSelection())}
            >
              <Scissors size={14} />
              {t("audio.cut")}
            </button>
          </li>
        </>
      )}

      {clipboard && (
        <li>
          <button
            type="button"
            disabled={playing}
            title={playing ? t("audio.pauseToApply") : undefined}
            onClick={act(() => pasteAtPlayhead())}
          >
            <ClipboardPaste size={14} />
            {t("audio.paste")}
          </button>
        </li>
      )}

      {hasSelection && (
        <>
          <li className="ae__ctxmenu-sep" />
          <li>
            <button
              type="button"
              disabled={playing}
              title={playing ? t("audio.pauseToApply") : undefined}
              onClick={act(() =>
                commit(P.deleteRange(project, selection, trackIds, true), {
                  key: "audio.cmd.delete",
                  params: { range: rangeLabel },
                }),
              )}
            >
              <Trash2 size={14} />
              {t("audio.deleteCloseGap")}
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled={playing}
              title={playing ? t("audio.pauseToApply") : undefined}
              onClick={act(() =>
                commit(P.deleteRange(project, selection, trackIds, false), {
                  key: "audio.cmd.splitDelete",
                  params: { range: rangeLabel },
                }),
              )}
            >
              <VolumeX size={14} />
              {t("audio.splitDelete")}
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled={playing}
              title={playing ? t("audio.pauseToApply") : undefined}
              onClick={act(() => {
                // keeping the selection = deleting everything around it
                const duration = P.projectDuration(project);
                let next = P.deleteRange(project, { start: selection.end, end: duration }, trackIds, true);
                next = P.deleteRange(next, { start: 0, end: selection.start }, trackIds, true);
                commit(next, { key: "audio.cmd.trim", params: { range: rangeLabel } });
              })}
            >
              <Crop size={14} />
              {t("audio.keepSelection")}
            </button>
          </li>
          <li className="ae__ctxmenu-sep" />
          <li>
            <button type="button" onClick={act(() => playRange(selection.start, selection.end))}>
              <Headphones size={14} />
              {t("audio.playSelection")}
            </button>
          </li>
        </>
      )}
    </ul>
  );
}
