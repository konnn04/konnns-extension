import type { AppState } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

/**
 * Shared shapes — docs/roadmap/03-whiteboard.md §1. Excalidraw owns the
 * drawing state entirely (elements/appState/files); this tool only packages
 * that into "a board" and manages a list of them.
 */

export type BoardElement = OrderedExcalidrawElement;

export interface BoardSummary {
  id: string;
  name: string;
  /** small PNG data URL for the board-picker grid */
  thumbnail: string;
  updatedAt: number;
  elementCount: number;
}

export interface BoardRecord extends BoardSummary {
  elements: readonly BoardElement[];
  appState: Partial<AppState>;
  /** Excalidraw fileIds this board's elements reference — for the orphan-file sweep */
  fileIds: string[];
}

/**
 * A board always starts as white paper with a black pen.
 *
 * Excalidraw's own defaults are a near-white canvas and a dark-blue-ish
 * stroke (`#1e1e1e` varies by theme), which reads oddly when the board is
 * exported or printed — and in dark mode the stroke it picks is lighter
 * still. Pinning both here means every new board looks the same regardless
 * of which theme it happened to be created under.
 */
export const DEFAULT_BOARD_APP_STATE = {
  viewBackgroundColor: "#ffffff",
  currentItemStrokeColor: "#000000",
} as const;

export function newBoard(name: string): BoardRecord {
  return {
    id: crypto.randomUUID(),
    name,
    thumbnail: "",
    updatedAt: Date.now(),
    elementCount: 0,
    elements: [],
    appState: { ...DEFAULT_BOARD_APP_STATE },
    fileIds: [],
  };
}

/**
 * Only layout/style preferences are worth persisting — NOT pointer position,
 * selection, or anything that would be meaningless (or stale/wrong) the next
 * time this board is opened, echoing the roadmap's "không lưu con trỏ/toạ độ
 * chuột nhất thời".
 */
const PERSISTED_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemStrokeStyle",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "gridSize",
  "gridStep",
  "zoom",
  "scrollX",
  "scrollY",
] as const satisfies ReadonlyArray<keyof AppState>;

export function pickPersistedAppState(appState: AppState): Partial<AppState> {
  const out: Partial<AppState> = {};
  for (const key of PERSISTED_APP_STATE_KEYS) {
    (out as Record<string, unknown>)[key] = appState[key];
  }
  return out;
}

/** Excalidraw fileIds actually referenced by this element set — image elements only, deleted (tombstoned) elements excluded. */
export function fileIdsOf(elements: readonly BoardElement[]): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    if (el.isDeleted) continue;
    const fileId = (el as unknown as { fileId?: string | null }).fileId;
    if (fileId) ids.add(fileId);
  }
  return [...ids];
}
