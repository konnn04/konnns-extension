import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Layout, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { siteUrl } from "@/core/messaging";
import { db } from "@/core/storage/db";
import { deleteBoard, duplicateBoard, getBoard, listBoards, loadBoardFiles, saveBoardMeta } from "./engine/store";
import { newBoard, type BoardSummary } from "./engine/types";
import { generateThumbnail } from "./engine/thumbnail";

export function BoardGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await listBoards();
    setBoards(list);

    // Backfill thumbnails for any boards missing thumbnails
    const missing = list.filter((b) => !b.thumbnail && b.elementCount > 0);
    if (missing.length > 0) {
      for (const b of missing) {
        try {
          const full = await getBoard(b.id);
          if (full && full.elements.length > 0) {
            const files = await loadBoardFiles(b.id);
            const thumb = await generateThumbnail(full.elements, full.appState, files);
            if (thumb) {
              await db.boards.update(b.id, { thumbnail: thumb });
              setBoards((prev) => prev.map((item) => (item.id === b.id ? { ...item, thumbnail: thumb } : item)));
            }
          }
        } catch {
          // a board whose thumbnail cannot be regenerated still opens fine
        }
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const board = newBoard(t("whiteboard.untitled"));
    await saveBoardMeta(board);
    onOpen(board.id);
  };

  const duplicate = async (id: string, name: string) => {
    const copy = await duplicateBoard(id, `${name} ${t("whiteboard.copySuffix")}`);
    if (copy) await refresh();
  };

  const remove = async (id: string) => {
    await deleteBoard(id);
    setConfirmDelete(null);
    await refresh();
  };

  if (boards.length === 0) {
    return (
      <div className="wb__empty-screen">
        <div className="wb__empty-icon">
          <Layout size={44} />
        </div>
        <h1 className="wb__empty-title">{t("whiteboard.emptyHeroTitle")}</h1>
        <p className="wb__empty-desc">{t("whiteboard.emptyHeroDesc")}</p>
        <div className="wb__empty-actions">
          <Button variant="primary" onClick={() => void create()}>
            <Plus size={16} />
            {t("whiteboard.newBoard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="wb__grid-screen">
      <div className="wb__grid-head">
        <h1>{t("whiteboard.title")}</h1>
        <Button variant="primary" onClick={() => void create()}>
          <Plus size={15} />
          {t("whiteboard.newBoard")}
        </Button>
      </div>

      <div className="wb__grid">
          {boards.map((b) => (
            <div key={b.id} className="wb__card">
              <button className="wb__card-thumb" onClick={() => onOpen(b.id)}>
                {b.thumbnail ? (
                  <img src={b.thumbnail} alt="" />
                ) : (
                  <div className="wb__card-empty-thumb">
                    <Layout size={28} className="wb__card-empty-icon" />
                    <span className="wb__card-empty">{t("whiteboard.emptyBoard")}</span>
                  </div>
                )}
              </button>
              <div className="wb__card-meta">
                <span className="wb__card-name" title={b.name}>
                  {b.name || t("whiteboard.untitled")}
                </span>
                <span className="wb__card-date">{new Date(b.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="wb__card-actions">
                <IconButton
                  label={t("whiteboard.openInNewTab")}
                  title={t("whiteboard.openInNewTab")}
                  onClick={() => window.open(siteUrl(`/whiteboard/${b.id}?zen=1`), "_blank")}
                >
                  <ExternalLink size={13} />
                </IconButton>
                <IconButton label={t("whiteboard.duplicate")} onClick={() => void duplicate(b.id, b.name)}>
                  <Copy size={13} />
                </IconButton>
                {confirmDelete === b.id ? (
                  <Button size="sm" variant="danger" onClick={() => void remove(b.id)}>
                    {t("common.confirm")}
                  </Button>
                ) : (
                  <IconButton label={t("common.delete")} onClick={() => setConfirmDelete(b.id)}>
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
