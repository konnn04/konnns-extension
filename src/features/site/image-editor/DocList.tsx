import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, FolderOpen, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { siteUrl } from "@/core/messaging";
import { db } from "@/core/storage/db";
import { deleteProject, duplicateProject, getProject, getProjectAssets, listProjects, saveProject } from "./engine/store";
import { newProject, type ImageProjectSummary } from "./engine/types";
import { FabricImage, StaticCanvas } from "fabric";
import { assignLayerId, PERSISTED_OBJECT_PROPS } from "./engine/canvasOps";
import { reattachAssets } from "./engine/assets";

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

export function DocList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ImageProjectSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);

    // Backfill thumbnails for any projects missing thumbnails
    const missing = list.filter((p) => !p.thumbnail);
    if (missing.length > 0) {
      for (const p of missing) {
        try {
          const full = await getProject(p.id);
          if (full && full.fabricJson?.objects && full.fabricJson.objects.length > 0) {
            const assets = await getProjectAssets(p.id);
            const canvasEl = document.createElement("canvas");
            const staticCanvas = new StaticCanvas(canvasEl, {
              width: full.canvasWidth || 800,
              height: full.canvasHeight || 600,
              enableRetinaScaling: false,
            });
            await staticCanvas.loadFromJSON(reattachAssets(full.fabricJson, assets));
            staticCanvas.requestRenderAll();
            const maxDim = 320;
            const curMax = Math.max(staticCanvas.width || 1, staticCanvas.height || 1);
            const multiplier = Math.min(1, maxDim / curMax);
            const thumb = staticCanvas.toDataURL({ format: "jpeg", quality: 0.7, multiplier });
            staticCanvas.dispose();
            if (thumb) {
              await db.imageProjects.update(p.id, { thumbnail: thumb });
              setProjects((prev) => prev.map((item) => (item.id === p.id ? { ...item, thumbnail: thumb } : item)));
            }
          }
        } catch {
          // an unreadable project simply keeps its old card image; the list
          // itself must still render
        }
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const project = newProject(t("imageEditor.untitled"), DEFAULT_WIDTH, DEFAULT_HEIGHT);
    await saveProject(project);
    onOpen(project.id);
  };

  const duplicate = async (id: string, name: string) => {
    const copy = await duplicateProject(id, `${name || t("imageEditor.untitled")} ${t("whiteboard.copySuffix", "(bản sao)")}`);
    if (copy) await refresh();
  };

  const remove = async (id: string) => {
    await deleteProject(id);
    setConfirmDelete(null);
    await refresh();
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async () => {
      const dataURL = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        const project = newProject(rawName, img.naturalWidth, img.naturalHeight);
        const fabricImg = await FabricImage.fromURL(dataURL);
        fabricImg.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: 1,
          scaleY: 1,
          strokeWidth: 0,
          width: img.naturalWidth,
          height: img.naturalHeight,
          assetId: crypto.randomUUID(),
        });
        assignLayerId(fabricImg);
        project.fabricJson.objects = [fabricImg.toObject(PERSISTED_OBJECT_PROPS as any) as any];
        project.fabricJson.width = img.naturalWidth;
        project.fabricJson.height = img.naturalHeight;

        // Generate thumbnail
        const thumbCanvas = document.createElement("canvas");
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        thumbCanvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        thumbCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = thumbCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
          project.thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.75);
        }

        await saveProject(project);
        onOpen(project.id);
      };
      img.src = dataURL;
    };
    reader.readAsDataURL(file);
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={handleFilePick}
    />
  );

  if (projects.length === 0) {
    return (
      <div className="ied__empty-screen">
        <div className="ied__empty-icon">
          <ImagePlus size={44} />
        </div>
        <h1 className="ied__empty-title">{t("imageEditor.emptyHeroTitle")}</h1>
        <p className="ied__empty-desc">{t("imageEditor.emptyHeroDesc")}</p>
        <div className="ied__empty-actions">
          <Button variant="primary" onClick={() => void create()}>
            <Plus size={16} />
            {t("imageEditor.newDoc")}
          </Button>
          <Button variant="subtle" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={16} />
            {t("imageEditor.openImageFile")}
          </Button>
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <div className="ied__grid-screen">
      <div className="ied__grid-head">
        <h1>{t("imageEditor.title")}</h1>
        <div className="ied__grid-head-actions">
          <Button variant="primary" onClick={() => void create()}>
            <Plus size={15} />
            {t("imageEditor.newDoc")}
          </Button>
          <Button variant="subtle" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={15} />
            {t("imageEditor.openImageFile")}
          </Button>
        </div>
      </div>

      <div className="ied__grid">
        {projects.map((p) => (
          <div key={p.id} className="ied__card">
            <button className="ied__card-thumb" onClick={() => onOpen(p.id)}>
              {p.thumbnail ? (
                <img src={p.thumbnail} alt="" />
              ) : (
                <div className="ied__card-empty-thumb">
                  <ImagePlus size={28} className="ied__card-empty-icon" />
                  <span className="ied__card-empty">{t("imageEditor.emptyDoc")}</span>
                </div>
              )}
            </button>
            <div className="ied__card-meta">
              <span className="ied__card-name" title={p.name}>
                {p.name || t("imageEditor.untitled")}
              </span>
              <span className="ied__card-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="ied__card-actions">
              <IconButton
                label={t("imageEditor.openInNewTab")}
                title={t("imageEditor.openInNewTab")}
                onClick={() => window.open(siteUrl(`/image-editor/${p.id}`), "_blank")}
              >
                <ExternalLink size={13} />
              </IconButton>
              <IconButton label={t("imageEditor.duplicate")} onClick={() => void duplicate(p.id, p.name)}>
                <Copy size={13} />
              </IconButton>
              {confirmDelete === p.id ? (
                <Button size="sm" variant="danger" onClick={() => void remove(p.id)}>
                  {t("common.confirm")}
                </Button>
              ) : (
                <IconButton label={t("common.delete")} onClick={() => setConfirmDelete(p.id)}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </div>
      {fileInput}
    </div>
  );
}
