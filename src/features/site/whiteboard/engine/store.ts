import { db, type BoardFileRow } from "@/core/storage/db";
import type { BinaryFileData, BinaryFiles, DataURL } from "@excalidraw/excalidraw/types";
import type { BoardElement, BoardRecord, BoardSummary } from "./types";
import { fileIdsOf } from "./types";

/**
 * Dexie access layer — docs/roadmap/03-whiteboard.md §1. `boards` (small
 * elements/appState tree) and `boardFiles` (pasted-image blobs, can be a few
 * MB each) are split the same way Audio Editor splits `audioProjects` /
 * `audioSources`: the board-picker grid reads every board's summary at once
 * and must not drag every board's images along for that.
 */

export async function listBoards(): Promise<BoardSummary[]> {
  const rows = await db.boards.orderBy("updatedAt").reverse().toArray();
  return rows.map(({ elements: _elements, appState: _appState, fileIds: _fileIds, ...summary }) => summary);
}

export async function getBoard(id: string): Promise<BoardRecord | undefined> {
  const row = await db.boards.get(id);
  return row as BoardRecord | undefined;
}

export async function saveBoardMeta(board: BoardRecord): Promise<void> {
  await db.boards.put(board);
}

export async function deleteBoard(id: string): Promise<void> {
  await db.boards.delete(id);
  const fileKeys = await db.boardFiles.where("boardId").equals(id).primaryKeys();
  if (fileKeys.length > 0) await db.boardFiles.bulkDelete(fileKeys);
}

/** Copies elements/appState AND the referenced files under fresh ids, so the two boards never collide on a shared `boardFiles` primary key. */
export async function duplicateBoard(id: string, newName: string): Promise<BoardRecord | null> {
  const src = await getBoard(id);
  if (!src) return null;

  const srcFiles = await db.boardFiles.where("boardId").equals(id).toArray();
  const newId = crypto.randomUUID();
  const remap = new Map<string, string>();
  const newFileRows: BoardFileRow[] = srcFiles.map((f) => {
    const freshId = crypto.randomUUID();
    remap.set(f.id, freshId);
    return { ...f, id: freshId, boardId: newId };
  });

  const elements: BoardElement[] = src.elements.map((el) => {
    const fileId = (el as unknown as { fileId?: string | null }).fileId;
    if (fileId && remap.has(fileId)) return { ...el, fileId: remap.get(fileId) } as BoardElement;
    return el;
  });

  const copy: BoardRecord = {
    ...src,
    id: newId,
    name: newName,
    elements,
    fileIds: newFileRows.map((f) => f.id),
    updatedAt: Date.now(),
  };
  await db.boards.put(copy);
  if (newFileRows.length > 0) await db.boardFiles.bulkPut(newFileRows);
  return copy;
}

export async function loadBoardFiles(boardId: string): Promise<BinaryFiles> {
  const rows = await db.boardFiles.where("boardId").equals(boardId).toArray();
  const files: BinaryFiles = {};
  for (const r of rows) {
    files[r.id] = {
      id: r.id as BinaryFileData["id"],
      dataURL: r.dataURL as DataURL,
      mimeType: r.mimeType as BinaryFileData["mimeType"],
      created: r.createdAt,
      lastRetrieved: Date.now(),
    };
  }
  return files;
}

/**
 * Persist a board's tree plus whichever of its files are new, then sweep any
 * `boardFiles` rows this board no longer references — docs/roadmap/03 §5,
 * "dữ liệu ảnh dán vào phình nhanh nếu không dọn": deleting an image from the
 * canvas does not delete its file from Excalidraw's own `files` map, so this
 * is the only place that actually reclaims that space.
 */
export async function saveBoard(
  meta: BoardRecord,
  files: BinaryFiles,
): Promise<void> {
  const liveIds = new Set(fileIdsOf(meta.elements));

  const existingIds = new Set(await db.boardFiles.where("boardId").equals(meta.id).primaryKeys() as string[]);
  const newRows: BoardFileRow[] = [];
  for (const id of liveIds) {
    if (existingIds.has(id)) continue; // files are immutable once stored — never re-write
    const f = files[id];
    if (!f) continue; // referenced but not (yet) in Excalidraw's in-memory files map — nothing to store yet
    newRows.push({ id, boardId: meta.id, dataURL: f.dataURL, mimeType: f.mimeType, createdAt: f.created });
  }

  const staleIds = [...existingIds].filter((id) => !liveIds.has(id));

  await db.transaction("rw", db.boards, db.boardFiles, async () => {
    await db.boards.put({ ...meta, fileIds: [...liveIds] });
    if (newRows.length > 0) await db.boardFiles.bulkPut(newRows);
    if (staleIds.length > 0) await db.boardFiles.bulkDelete(staleIds);
  });
}

export async function totalBoardBytes(): Promise<number> {
  const rows = await db.boardFiles.toArray();
  let total = 0;
  for (const r of rows) total += r.dataURL.length;
  return total;
}
