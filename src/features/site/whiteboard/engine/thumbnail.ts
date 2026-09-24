import { exportToCanvas } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { BoardElement } from "./types";

/** Small PNG data URL for the board-picker grid card — docs/roadmap/03-whiteboard.md §3, "ThumbnailWorker". */
export async function generateThumbnail(
  elements: readonly BoardElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<string> {
  const visible = elements.filter((el) => !el.isDeleted);
  if (visible.length === 0) return "";
  const canvas = await exportToCanvas({
    elements: visible,
    appState,
    files,
    maxWidthOrHeight: 320,
  });
  return canvas.toDataURL("image/png");
}
