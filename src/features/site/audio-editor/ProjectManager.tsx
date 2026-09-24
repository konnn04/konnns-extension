import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioWaveform, FolderOpen, HardDrive, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  deleteAllProjects,
  deleteProject,
  formatBytes,
  listProjects,
  totalAudioBytes,
  type ProjectSummary,
} from "./engine/persist";
import { formatTime } from "./engine/types";
import { estimateStorage } from "@/core/storage/db";
import { navigate } from "@/core/router/useHashRoute";
import { Button, IconButton } from "@/shared/ui";
import { useAudioEditor } from "./store";

export function ProjectManager({
  onNewProject,
  onOpenFile,
  fileInput,
  activityBanner,
  error,
  onFile,
}: {
  onNewProject?: () => void;
  onOpenFile?: () => void;
  fileInput?: React.ReactNode;
  activityBanner?: React.ReactNode;
  error?: string | null;
  onFile?: (file: File | undefined) => void;
}) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [audioBytes, setAudioBytes] = useState(0);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openSaved = useAudioEditor((s) => s.openSaved);

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
    setAudioBytes(await totalAudioBytes());
    setQuota(await estimateStorage());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string) => {
    await deleteProject(id);
    setConfirmDeleteId(null);
    await refresh();
  };

  const removeAll = async () => {
    await deleteAllProjects();
    setConfirmAll(false);
    await refresh();
  };

  const nearQuota = quota !== null && quota.quota > 0 && quota.usage / quota.quota > 0.8;

  // Empty state: Image 1 pattern
  if (projects.length === 0) {
    return (
      <div
        className="ae ae--empty"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile?.(e.dataTransfer.files[0]);
        }}
      >
        <div className="ae__empty-icon-wrap">
          <AudioWaveform size={48} />
        </div>
        <h1>{t("audio.dropTitle")}</h1>
        <p>{t("audio.dropBody")}</p>
        <div className="ae__empty-actions">
          <Button variant="primary" onClick={onNewProject}>
            <Plus size={16} />
            {t("audio.newProject")}
          </Button>
          <Button variant="subtle" onClick={onOpenFile}>
            <FolderOpen size={16} />
            {t("audio.openFile")}
          </Button>
        </div>
        {fileInput}
        {activityBanner}
        {error && <p className="ae__error">{t(error)}</p>}
      </div>
    );
  }

  // Projects exist: Image 2 pattern
  return (
    <div
      className="ae__grid-screen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile?.(e.dataTransfer.files[0]);
      }}
    >
      <div className="ae__grid-head">
        <div className="ae__grid-head-left">
          <h1>{t("audio.title", "Trình chỉnh sửa âm thanh")}</h1>
          <span className="ae__projects-size">
            <HardDrive size={13} />
            {t("audio.storageUsed", { size: formatBytes(audioBytes) })}
          </span>
        </div>
        <div className="ae__grid-head-actions">
          <Button variant="primary" onClick={onNewProject}>
            <Plus size={15} />
            {t("audio.newProject")}
          </Button>
          <Button variant="subtle" onClick={onOpenFile}>
            <FolderOpen size={15} />
            {t("audio.openFile")}
          </Button>
        </div>
      </div>

      {nearQuota && (
        <p className="ae__projects-warn">
          <TriangleAlert size={14} />
          {t("audio.storageUsed", { size: formatBytes(quota!.usage) })} / {formatBytes(quota!.quota)}
        </p>
      )}

      {activityBanner}
      {error && <p className="ae__error">{t(error)}</p>}

      <div className="ae__grid">
        {projects.map((p) => (
          <div key={p.id} className="ae__card">
            <button
              type="button"
              className="ae__card-thumb"
              onClick={() => {
                void openSaved(p.id);
                navigate(`/audio/${p.id}`);
              }}
            >
              <div className="ae__card-thumb-inner">
                <AudioWaveform size={40} className="ae__card-wave-icon" />
              </div>
            </button>
            <div className="ae__card-meta">
              <span className="ae__card-name" title={p.name}>
                {p.name}
              </span>
              <span className="ae__card-date">
                {formatTime(p.duration)} · {t("audio.trackCount", { count: p.trackCount })} · {formatBytes(p.bytes)}
              </span>
            </div>
            <div className="ae__card-actions">
              <IconButton
                label={t("audio.openProject")}
                title={t("audio.openProject")}
                onClick={() => {
                  void openSaved(p.id);
                  navigate(`/audio/${p.id}`);
                }}
              >
                <FolderOpen size={13} />
              </IconButton>
              {confirmDeleteId === p.id ? (
                <Button size="sm" variant="danger" onClick={() => void remove(p.id)}>
                  {t("common.confirm")}
                </Button>
              ) : (
                <IconButton label={t("audio.deleteProject")} onClick={() => setConfirmDeleteId(p.id)}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ae__projects-foot">
        {confirmAll ? (
          <>
            <span className="ae__projects-confirm">
              {t("audio.confirmDeleteAll", {
                count: projects.length,
                size: formatBytes(audioBytes),
              })}
            </span>
            <Button variant="danger" onClick={() => void removeAll()}>
              {t("common.confirm")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <>
            <span className="ae__projects-note">{t("audio.storageNote")}</span>
            <Button variant="ghost" onClick={() => setConfirmAll(true)}>
              <Trash2 size={13} />
              {t("audio.deleteAllProjects")}
            </Button>
          </>
        )}
      </div>
      {fileInput}
    </div>
  );
}
