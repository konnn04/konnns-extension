import "./engine/assetPath"; // must run before the "@excalidraw/excalidraw" import below — see that file
import { useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useResolvedColorMode } from "@/core/theme-engine/useTheme";
import { saveBoard } from "./engine/store";
import { generateThumbnail } from "./engine/thumbnail";
import { DEFAULT_BOARD_APP_STATE, fileIdsOf, pickPersistedAppState, type BoardElement, type BoardRecord } from "./engine/types";

const SAVE_DEBOUNCE_MS = 1000;
const THUMBNAIL_DEBOUNCE_MS = 1500;

/**
 * Bare Excalidraw — docs/roadmap/03-whiteboard.md §2/§4. Every drawing
 * interaction (tool selection, drag, resize, undo/redo…) is Excalidraw's own;
 * this component's entire job is loading a board's saved elements/appState/
 * files in, and saving `onChange` back out, debounced.
 */
export function BoardCanvas({
  board,
  files,
  onApiReady,
  onSaved,
}: {
  board: BoardRecord;
  files: BinaryFiles;
  onApiReady: (api: ExcalidrawImperativeAPI) => void;
  onSaved: (thumbnail: string, elementCount: number) => void;
}) {
  const colorMode = useResolvedColorMode();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef(board); // id/name only change via remount (Whiteboard keys the canvas by board id)
  boardRef.current = board;
  const latest = useRef<{ elements: readonly BoardElement[]; appState: AppState; files: BinaryFiles } | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (thumbTimer.current) clearTimeout(thumbTimer.current);
      // flush whatever is pending so closing the tab right after a stroke never loses it
      if (latest.current) void persist(boardRef.current, latest.current);
    },
    [],
  );

  const persist = async (
    meta: BoardRecord,
    snapshot: { elements: readonly BoardElement[]; appState: AppState; files: BinaryFiles },
  ) => {
    const visible = snapshot.elements.filter((el) => !el.isDeleted);
    const record: BoardRecord = {
      ...meta,
      thumbnail: boardRef.current.thumbnail || meta.thumbnail || "",
      elements: snapshot.elements,
      appState: pickPersistedAppState(snapshot.appState),
      fileIds: fileIdsOf(snapshot.elements),
      elementCount: visible.length,
      updatedAt: Date.now(),
    };
    await saveBoard(record, snapshot.files);
  };

  useEffect(() => {
    if (!board.thumbnail && board.elements.some((el) => !el.isDeleted)) {
      void generateThumbnail(board.elements, board.appState, files).then((thumb) => {
        if (thumb) {
          boardRef.current.thumbnail = thumb;
          onSaved(thumb, board.elements.filter((el) => !el.isDeleted).length);
        }
      });
    }
  }, [board.elements, board.appState, board.thumbnail, files, onSaved]);

  return (
    <Excalidraw
      excalidrawAPI={onApiReady}
      theme={colorMode}
      initialData={{
        elements: board.elements,
        // defaults sit UNDER the saved state, so a board saved before these
        // existed also opens as white paper / black pen, while anything the
        // user actually chose still wins
        appState: { ...DEFAULT_BOARD_APP_STATE, ...board.appState, theme: colorMode },
        files,
        scrollToContent: true,
      }}
      onChange={(elements, appState, changedFiles) => {
        latest.current = { elements, appState, files: changedFiles };

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void persist(boardRef.current, latest.current!);
        }, SAVE_DEBOUNCE_MS);

        if (thumbTimer.current) clearTimeout(thumbTimer.current);
        thumbTimer.current = setTimeout(() => {
          const visible = elements.filter((el) => !el.isDeleted);
          void generateThumbnail(elements, appState, changedFiles).then((thumb) => {
            boardRef.current.thumbnail = thumb;
            onSaved(thumb, visible.length);
          });
        }, THUMBNAIL_DEBOUNCE_MS);
      }}
    />
  );
}
