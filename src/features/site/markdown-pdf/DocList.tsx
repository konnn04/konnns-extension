import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { siteUrl } from "@/core/messaging";
import { deleteDoc, duplicateDoc, listDocs, renameDoc } from "./engine/store";
import type { MarkdownDoc } from "./engine/types";

export function DocList({
  onOpen,
  onImport,
  onCreate,
}: {
  onOpen: (doc: MarkdownDoc) => void;
  onImport: (title: string, source: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<MarkdownDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setDocs(await listDocs());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importFile = (file: File | undefined) => {
    if (!file) return;
    void file.text().then((text) => onImport(file.name.replace(/\.md$/i, ""), text));
  };

  const remove = async (id: string) => {
    await deleteDoc(id);
    setConfirmDelete(null);
    await refresh();
  };

  const duplicate = async (id: string) => {
    const copy = await duplicateDoc(id, t("whiteboard.copySuffix", "(bản sao)"));
    if (copy) await refresh();
  };

  const handleStartRename = (e: React.MouseEvent, doc: MarkdownDoc) => {
    e.stopPropagation();
    setRenamingId(doc.id);
    setRenamingTitle(doc.title || "");
  };

  const handleFinishRename = async (id: string) => {
    const next = renamingTitle.trim();
    if (next) {
      await renameDoc(id, next);
      await refresh();
    }
    setRenamingId(null);
  };

  // 1. Empty State: Image 1 Pattern
  if (docs.length === 0) {
    return (
      <div
        className={`mdp__empty-screen ${dragOver ? "mdp__drop--over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          importFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="mdp__empty-icon">
          <FileText size={44} />
        </div>
        <h1 className="mdp__empty-title">{t("markdownPdf.emptyHeroTitle", "Chưa có tài liệu nào")}</h1>
        <p className="mdp__empty-desc">
          {t(
            "markdownPdf.emptyHeroDesc",
            "Soạn thảo tài liệu Markdown phong phú với chế độ xem trước trực tiếp và xuất thành PDF chất lượng cao có chia trang chuẩn xác.",
          )}
        </p>
        <div className="mdp__empty-actions">
          <Button variant="primary" onClick={onCreate}>
            <Plus size={16} />
            {t("markdownPdf.newDoc", "Tạo tài liệu mới")}
          </Button>
          <Button variant="subtle" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={16} />
            {t("markdownPdf.importFile", "Nhập file .md")}
          </Button>
        </div>
        <p className="mdp__empty-hint">{t("markdownPdf.dropHint", "Kéo thả file .md vào đây để nhập nhanh")}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown"
          hidden
          onChange={(e) => importFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  // 2. Grid State: Image 2 Pattern
  return (
    <div
      className={`mdp__grid-screen ${dragOver ? "mdp__drop--over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        importFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="mdp__grid-head">
        <h1>{t("markdownPdf.title", "Markdown → PDF")}</h1>
        <div className="mdp__grid-head-actions">
          <Button variant="primary" onClick={onCreate}>
            <Plus size={15} />
            {t("markdownPdf.newDoc", "Tạo tài liệu mới")}
          </Button>
          <Button variant="subtle" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={15} />
            {t("markdownPdf.importFile", "Nhập file .md")}
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".md,text/markdown"
        hidden
        onChange={(e) => importFile(e.target.files?.[0])}
      />

      <div className="mdp__grid">
        {docs.map((d) => (
          <div key={d.id} className="mdp__card">
            <button className="mdp__card-thumb" onClick={() => onOpen(d)}>
              {d.source.trim() ? (
                <div className="mdp__card-preview-text">
                  {d.source.slice(0, 240)}
                </div>
              ) : (
                <span className="mdp__card-empty">
                  {t("markdownPdf.emptyDoc", "Tài liệu trống")}
                </span>
              )}
            </button>

            <div className="mdp__card-meta">
              {renamingId === d.id ? (
                <input
                  className="mdp__card-rename-input"
                  type="text"
                  value={renamingTitle}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenamingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFinishRename(d.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => void handleFinishRename(d.id)}
                />
              ) : (
                <span
                  className="mdp__card-name"
                  title={d.title || t("markdownPdf.untitled", "Chưa đặt tên")}
                  onClick={() => onOpen(d)}
                >
                  {d.title || t("markdownPdf.untitled", "Chưa đặt tên")}
                </span>
              )}
              <div className="mdp__card-submeta">
                <span className="mdp__card-pill">
                  <FileText size={11} />
                  <span>
                    {d.source ? `${d.source.trim().split(/\s+/).filter(Boolean).length} từ` : "0 từ"}
                  </span>
                </span>
                <span className="mdp__card-date">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="mdp__card-actions" onClick={(e) => e.stopPropagation()}>
              <IconButton
                label={t("markdownPdf.openInNewTab", "Mở tab mới")}
                title={t("markdownPdf.openInNewTab", "Mở tab mới")}
                onClick={() => window.open(siteUrl(`/markdown-pdf/${d.id}`), "_blank")}
              >
                <ExternalLink size={13} />
              </IconButton>
              <IconButton
                label={t("common.copy", "Nhân bản")}
                title={t("common.copy", "Nhân bản")}
                onClick={() => void duplicate(d.id)}
              >
                <Copy size={13} />
              </IconButton>
              <IconButton
                label={t("common.rename", "Đổi tên")}
                title={t("common.rename", "Đổi tên")}
                onClick={(e) => handleStartRename(e, d)}
              >
                <Pencil size={13} />
              </IconButton>
              {confirmDelete === d.id ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(d.id)}
                >
                  {t("common.confirm", "Xóa")}
                </Button>
              ) : (
                <IconButton
                  label={t("common.delete", "Xóa")}
                  title={t("common.delete", "Xóa")}
                  onClick={() => setConfirmDelete(d.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mdp__drop-hint">{t("markdownPdf.dropHint", "Kéo thả file .md vào đây để nhập nhanh")}</p>
    </div>
  );
}
