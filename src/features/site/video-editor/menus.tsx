import { AudioLines, ChevronDown, ChevronUp, Copy, Eraser, Lock, LockOpen, Scissors, Trash2, Volume2, VolumeX } from "lucide-react";
import type { MenuAction } from "./ContextMenu";
import type { TimelineTrack, TrackItem } from "./engine/model";

type Translate = (key: string) => string;

/**
 * The right-click menus, as data.
 *
 * Builders rather than components: a menu is a list of labelled actions, and
 * writing it as JSX buried in the editor made two long blocks that had to be
 * read past to find anything else. Here each entry is one line, and what the
 * editor supplies is only the behaviour.
 */

export function buildItemMenu({
  item,
  playheadTime,
  t,
  onSplit,
  onDuplicate,
  onExtractAudio,
  onDelete,
  onRippleDelete,
}: {
  item: TrackItem;
  playheadTime: number;
  t: Translate;
  onSplit: (time: number) => void;
  onDuplicate: () => void;
  onExtractAudio: (itemId: string, sourceId: string) => void;
  onDelete: () => void;
  onRippleDelete: () => void;
}): MenuAction[] {
  // splitting only means something while the playhead is actually inside it
  const canSplit = playheadTime > item.start && playheadTime < item.start + item.duration;

  return [
    {
      id: "split",
      label: t("videoEditor.splitHere"),
      icon: <Scissors size={13} />,
      hint: "S",
      disabled: !canSplit,
      run: () => onSplit(playheadTime),
    },
    {
      id: "duplicate",
      label: t("videoEditor.duplicate"),
      icon: <Copy size={13} />,
      hint: "Ctrl+D",
      run: onDuplicate,
    },
    ...(item.kind === "video"
      ? [
          {
            id: "extract",
            label: t("videoEditor.extractAudio"),
            icon: <AudioLines size={13} />,
            separatorBefore: true,
            run: () => onExtractAudio(item.id, item.sourceId),
          },
        ]
      : []),
    {
      id: "delete",
      label: t("videoEditor.deleteClip"),
      icon: <Trash2 size={13} />,
      hint: "Del",
      danger: true,
      separatorBefore: true,
      run: onDelete,
    },
    {
      id: "ripple",
      label: t("videoEditor.rippleDelete"),
      icon: <Trash2 size={13} />,
      danger: true,
      run: onRippleDelete,
    },
  ];
}

export function buildTrackMenu({
  track,
  index,
  trackCount,
  t,
  onMove,
  onToggleLocked,
  onToggleMuted,
  onClear,
  onDelete,
}: {
  track: TimelineTrack;
  index: number;
  trackCount: number;
  t: Translate;
  onMove: (direction: -1 | 1) => void;
  onToggleLocked: () => void;
  onToggleMuted: () => void;
  onClear: () => void;
  onDelete: () => void;
}): MenuAction[] {
  const carriesSound = track.kind === "audio" || track.kind === "video";

  return [
    {
      id: "up",
      label: t("videoEditor.moveTrackUp"),
      icon: <ChevronUp size={13} />,
      disabled: index === 0,
      run: () => onMove(-1),
    },
    {
      id: "down",
      label: t("videoEditor.moveTrackDown"),
      icon: <ChevronDown size={13} />,
      disabled: index === trackCount - 1,
      run: () => onMove(1),
    },
    {
      id: "lock",
      label: track.locked ? t("videoEditor.unlockTrack") : t("videoEditor.lockTrack"),
      icon: track.locked ? <Lock size={13} /> : <LockOpen size={13} />,
      separatorBefore: true,
      run: onToggleLocked,
    },
    ...(carriesSound
      ? [
          {
            id: "mute",
            label: track.muted ? t("videoEditor.unmuteTrack") : t("videoEditor.muteTrack"),
            icon: track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />,
            run: onToggleMuted,
          },
        ]
      : []),
    {
      id: "clear",
      label: t("videoEditor.clearTrack"),
      icon: <Eraser size={13} />,
      disabled: track.items.length === 0,
      separatorBefore: true,
      run: onClear,
    },
    {
      id: "delete",
      label: t("videoEditor.deleteTrack"),
      icon: <Trash2 size={13} />,
      danger: true,
      run: onDelete,
    },
  ];
}
