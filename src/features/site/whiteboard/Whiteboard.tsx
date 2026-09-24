import { useCallback, useEffect, useState } from "react";
import type { BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { navigate, useHashRoute } from "@/core/router/useHashRoute";
import { BoardGrid } from "./BoardGrid";
import { BoardToolbar } from "./BoardToolbar";
import { BoardCanvas } from "./BoardCanvas";
import { getBoard, loadBoardFiles, saveBoardMeta } from "./engine/store";
import { db } from "@/core/storage/db";
import type { BoardRecord } from "./engine/types";
import "./whiteboard.css";

/** Route dispatcher — "/whiteboard" (grid) vs "/whiteboard/:id" (one board), docs/roadmap/03-whiteboard.md §2. */
export default function Whiteboard() {
  const { segments, navigate } = useHashRoute();
  const boardId = segments[1];

  if (!boardId) return <BoardGrid onOpen={(id) => navigate(`/whiteboard/${id}`)} />;
  return <BoardView key={boardId} boardId={boardId} onBack={() => navigate("/whiteboard")} />;
}

function BoardView({ boardId, onBack }: { boardId: string; onBack: () => void }) {
  const [loaded, setLoaded] = useState<{ board: BoardRecord; files: BinaryFiles } | null>(null);
  const [missing, setMissing] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const board = await getBoard(boardId);
      if (!live) return;
      if (!board) {
        setMissing(true);
        return;
      }
      const files = await loadBoardFiles(boardId);
      if (!live) return;
      setLoaded({ board, files });
    })();
    return () => {
      live = false;
    };
  }, [boardId]);

  // `loaded.board` (not separate state) is the one source of truth for the
  // name — BoardCanvas reads it through the same `board` prop for its own
  // autosave, so a rename can never be raced back to the old value by the
  // next content-change save firing with a stale name.
  const rename = useCallback((next: string) => {
    setLoaded((prev) => {
      if (!prev) return prev;
      const board = { ...prev.board, name: next, updatedAt: Date.now() };
      void saveBoardMeta(board);
      return { ...prev, board };
    });
  }, []);

  if (missing) return <BoardGrid onOpen={(id) => navigate(`/whiteboard/${id}`)} />;
  if (!loaded) return null;

  return (
    <div className="wb">
      <BoardToolbar boardId={boardId} name={loaded.board.name} onRename={rename} onBack={onBack} api={api} />
      <div className="wb__canvas">
        <BoardCanvas
          board={loaded.board}
          files={loaded.files}
          onApiReady={setApi}
          onSaved={(thumbnail, elementCount) => {
            setLoaded((prev) =>
              prev ? { ...prev, board: { ...prev.board, thumbnail, elementCount } } : prev,
            );
            void db.boards.update(boardId, { thumbnail, elementCount });
          }}
        />
      </div>
    </div>
  );
}
