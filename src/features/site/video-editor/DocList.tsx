import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  ExternalLink,
  Film,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { siteUrl } from "@/core/messaging";
import {
  deleteProject,
  duplicateProject,
  getSourceBlob,
  listProjects,
  listSources,
  renameProject,
  saveProject,
} from "./engine/store";
import { newProject, type VideoProjectSummary } from "./engine/model";
import { db } from "@/core/storage/db";

export function DocList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<VideoProjectSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");

  const refresh = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);

    // Backfill thumbnails for any projects missing thumbnails that have visual sources
    const missing = list.filter((p) => !p.thumbnail);
    if (missing.length > 0) {
      for (const p of missing) {
        try {
          const sources = await listSources(p.id);
          const firstVisual = sources.find((s) => s.mediaKind === "image" || s.mediaKind === "video");
          if (firstVisual) {
            const blob = await getSourceBlob(firstVisual.id);
            if (blob) {
              const url = URL.createObjectURL(blob);
              if (firstVisual.mediaKind === "image") {
                const img = new Image();
                img.src = url;
                await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
                const canvas = document.createElement("canvas");
                const maxDim = 320;
                const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const thumb = canvas.toDataURL("image/jpeg", 0.7);
                  if (thumb) {
                    await db.videoProjects.update(p.id, { thumbnail: thumb });
                    setProjects((prev) => prev.map((item) => (item.id === p.id ? { ...item, thumbnail: thumb } : item)));
                  }
                }
              } else if (firstVisual.mediaKind === "video") {
                const video = document.createElement("video");
                video.preload = "auto";
                video.src = url;
                video.muted = true;
                await new Promise<void>((res, rej) => {
                  video.onloadeddata = () => {
                    video.currentTime = Math.min(1, (video.duration || 2) / 2);
                  };
                  video.onseeked = () => res();
                  video.onerror = rej;
                });
                const canvas = document.createElement("canvas");
                const maxDim = 320;
                const scale = Math.min(1, maxDim / Math.max(video.videoWidth || 320, video.videoHeight || 180));
                canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
                canvas.height = Math.max(1, Math.round((video.videoHeight || 180) * scale));
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const thumb = canvas.toDataURL("image/jpeg", 0.7);
                  if (thumb) {
                    await db.videoProjects.update(p.id, { thumbnail: thumb });
                    setProjects((prev) => prev.map((item) => (item.id === p.id ? { ...item, thumbnail: thumb } : item)));
                  }
                }
                video.src = "";
                video.remove();
              }
              URL.revokeObjectURL(url);
            }
          }
        } catch {
          // an unreadable source simply leaves the card without a thumbnail;
          // the project itself still opens
        }
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const project = newProject(t("videoEditor.untitled", "Chưa đặt tên"));
    await saveProject(project);
    onOpen(project.id);
  };

  const duplicate = async (id: string) => {
    const copy = await duplicateProject(id, t("whiteboard.copySuffix", "(bản sao)"));
    if (copy) await refresh();
  };

  const remove = async (id: string) => {
    await deleteProject(id);
    setConfirmDelete(null);
    await refresh();
  };

  const handleStartRename = (e: React.MouseEvent, p: VideoProjectSummary) => {
    e.stopPropagation();
    setRenamingId(p.id);
    setRenamingName(p.name || "");
  };

  const handleFinishRename = async (id: string) => {
    const next = renamingName.trim();
    if (next) {
      await renameProject(id, next);
      await refresh();
    }
    setRenamingId(null);
  };

  // 1. Empty State: Image 1 Pattern
  if (projects.length === 0) {
    return (
      <div className="vied__empty-screen">
        <div className="vied__empty-icon">
          <Film size={44} />
        </div>
        <h1 className="vied__empty-title">
          {t("videoEditor.emptyHeroTitle", "Chưa có dự án video nào")}
        </h1>
        <p className="vied__empty-desc">
          {t(
            "videoEditor.emptyHeroDesc",
            "Cắt ghép clip, chèn âm thanh nền, phụ đề, che mờ vùng nhạy cảm và xuất video chất lượng cao trực tiếp trên trình duyệt.",
          )}
        </p>
        <div className="vied__empty-actions">
          <Button variant="primary" onClick={() => void create()}>
            <Plus size={16} />
            {t("videoEditor.newDoc", "Tạo dự án mới")}
          </Button>
        </div>
      </div>
    );
  }

  // 2. Grid State: Image 2 Pattern
  return (
    <div className="vied__grid-screen">
      <div className="vied__grid-head">
        <h1>{t("videoEditor.title", "Trình chỉnh sửa video")}</h1>
        <div className="vied__grid-head-actions">
          <Button variant="primary" onClick={() => void create()}>
            <Plus size={15} />
            {t("videoEditor.newDoc", "Tạo dự án mới")}
          </Button>
        </div>
      </div>

      <div className="vied__grid">
        {projects.map((p) => (
          <div key={p.id} className="vied__card">
            <button className="vied__card-thumb" onClick={() => onOpen(p.id)}>
              {p.thumbnail ? (
                <img src={p.thumbnail} alt="" className="vied__card-img" />
              ) : (
                <div className="vied__card-empty-thumb">
                  <Video size={28} className="vied__card-empty-icon" />
                  <span className="vied__card-empty">
                    {t("videoEditor.emptyDoc", "Dự án trống")}
                  </span>
                </div>
              )}
            </button>

            <div className="vied__card-meta">
              {renamingId === p.id ? (
                <input
                  className="vied__card-rename-input"
                  type="text"
                  value={renamingName}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenamingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFinishRename(p.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => void handleFinishRename(p.id)}
                />
              ) : (
                <span
                  className="vied__card-name"
                  title={p.name || t("videoEditor.untitled", "Chưa đặt tên")}
                  onClick={() => onOpen(p.id)}
                >
                  {p.name || t("videoEditor.untitled", "Chưa đặt tên")}
                </span>
              )}
              <div className="vied__card-submeta">
                <span className="vied__card-pill">
                  <Film size={11} />
                  <span>Video</span>
                </span>
                <span className="vied__card-date">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="vied__card-actions" onClick={(e) => e.stopPropagation()}>
              <IconButton
                label={t("videoEditor.openInNewTab", "Mở tab mới")}
                title={t("videoEditor.openInNewTab", "Mở tab mới")}
                onClick={() => window.open(siteUrl(`/video-editor/${p.id}`), "_blank")}
              >
                <ExternalLink size={13} />
              </IconButton>
              <IconButton
                label={t("common.copy", "Nhân bản")}
                title={t("common.copy", "Nhân bản")}
                onClick={() => void duplicate(p.id)}
              >
                <Copy size={13} />
              </IconButton>
              <IconButton
                label={t("common.rename", "Đổi tên")}
                title={t("common.rename", "Đổi tên")}
                onClick={(e) => handleStartRename(e, p)}
              >
                <Pencil size={13} />
              </IconButton>
              {confirmDelete === p.id ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(p.id)}
                >
                  {t("common.confirm", "Xóa")}
                </Button>
              ) : (
                <IconButton
                  label={t("common.delete", "Xóa")}
                  title={t("common.delete", "Xóa")}
                  onClick={() => setConfirmDelete(p.id)}
                >
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
