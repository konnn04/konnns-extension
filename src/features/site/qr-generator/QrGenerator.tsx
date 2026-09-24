import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, RotateCcw, Save, X } from "lucide-react";
import { ContentInputs } from "./components/ContentInputs";
import { DataTypeSelector } from "./components/DataTypeSelector";
import { DesignAccordion } from "./components/DesignAccordion";
import { PreviewPanel } from "./components/PreviewPanel";
import { QrLanding } from "./components/QrLanding";
import { useHashRoute } from "@/core/router/useHashRoute";
import { DEFAULT_QR_CONFIG } from "./engine/presets";
import {
  deleteConfig,
  duplicateConfig,
  listSavedConfigs,
  renameConfig,
  saveConfig,
  type SavedQrConfig,
} from "./engine/storage";
import type { DataType, QrConfig } from "./types";
import "./qr-generator.css";

export function QrGenerator() {
  const { t } = useTranslation();
  const { segments, navigate: nav } = useHashRoute();
  const routeQrId = segments[1];

  const [config, setConfig] = useState<QrConfig>(DEFAULT_QR_CONFIG);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  /* ---- Save / Load state ---- */
  const [savedList, setSavedList] = useState<SavedQrConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedRecently, setSavedRecently] = useState(false);

  const refreshList = useCallback(() => setSavedList(listSavedConfigs()), []);
  useEffect(() => refreshList(), [refreshList]);

  // Synchronize route with active project
  useEffect(() => {
    if (routeQrId) {
      if (routeQrId === "new") {
        setIsEditing(true);
        setActiveId(null);
      } else {
        const item = savedList.find((s) => s.id === routeQrId);
        if (item) {
          setConfig(item.config);
          setActiveId(item.id);
          setIsEditing(true);
        }
      }
    } else {
      setIsEditing(false);
    }
  }, [routeQrId, savedList]);

  const handleTypeChange = (type: DataType) => {
    setConfig((prev) => ({ ...prev, type }));
  };

  const handleConfigChange = (patch: Partial<QrConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleReset = () => {
    setConfig(DEFAULT_QR_CONFIG);
    setActiveId(null);
  };

  /* ---- Save actions ---- */
  const handleSave = () => {
    if (activeId) {
      // Quick-save to existing
      const existing = savedList.find((s) => s.id === activeId);
      saveConfig(existing?.name ?? "QR", config, activeId);
      refreshList();
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2000);
    } else {
      // Open dialog for new name
      setSaveName("");
      setSaveDialogOpen(true);
    }
  };

  const handleSaveConfirm = () => {
    const name = saveName.trim() || `QR ${new Date().toLocaleString()}`;
    const saved = saveConfig(name, config);
    setActiveId(saved.id);
    setSaveDialogOpen(false);
    refreshList();
    setSavedRecently(true);
    setTimeout(() => setSavedRecently(false), 2000);
  };

  const handleSaveAs = () => {
    setSaveName("");
    setSaveDialogOpen(true);
    setActiveId(null); // Force new save
  };

  const handleDelete = (id: string) => {
    deleteConfig(id);
    if (activeId === id) setActiveId(null);
    refreshList();
  };

  const handleRename = (id: string, name: string) => {
    renameConfig(id, name);
    refreshList();
  };

  const handleDuplicate = (id: string) => {
    duplicateConfig(id, t("whiteboard.copySuffix", "(bản sao)"));
    refreshList();
  };

  const activeSavedItem = savedList.find((s) => s.id === activeId);

  // If not currently editing, show landing view with project grid & presets
  if (!isEditing) {
    return (
      <div className="qrg-page">
        <QrLanding
          savedList={savedList}
          onCreateNew={(presetConfig) => {
            if (presetConfig) {
              setConfig({ ...DEFAULT_QR_CONFIG, ...presetConfig });
            } else {
              setConfig(DEFAULT_QR_CONFIG);
            }
            setActiveId(null);
            setIsEditing(true);
            nav("/qr-generator/new");
          }}
          onOpenSaved={(item) => {
            setConfig(item.config);
            setActiveId(item.id);
            setIsEditing(true);
            nav(`/qr-generator/${item.id}`);
          }}
          onDelete={handleDelete}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
        />
      </div>
    );
  }

  return (
    <div className="qrg-page">
      {/* Top Banner / Navigation */}
      <div className="qrg-header">
        <div className="qrg-header__info">
          <div className="qrg-header__nav">
            <button
              type="button"
              className="qrg-back-btn"
              onClick={() => {
                setIsEditing(false);
                nav("/qr-generator");
              }}
            >
              <ArrowLeft size={16} />
              <span>{t("qr.actions.backToList", "Danh sách QR")}</span>
            </button>
            {activeId ? (
              <span className="qrg-active-tag">
                <span className="qrg-active-tag__dot" />
                <span>{activeSavedItem?.name || t("qr.actions.savedQr", "Mã QR đã lưu")}</span>
              </span>
            ) : (
              <span className="qrg-active-tag qrg-active-tag--new">
                <span>{t("qr.actions.newQr", "Mã QR mới")}</span>
              </span>
            )}
          </div>
          <h1 className="qrg-header__title">{t("qr.header.title", "Trình tạo mã QR Đa năng")}</h1>
        </div>

        <div className="qrg-header__actions">
          <button
            type="button"
            className="qrg-action-btn qrg-action-btn--save"
            onClick={handleSave}
            title={activeId ? t("qr.actions.quickSave", "Lưu nhanh") : t("qr.actions.save", "Lưu cấu hình")}
          >
            {savedRecently ? <Check size={15} /> : <Save size={15} />}
            <span>{savedRecently ? t("qr.actions.savedDone", "Đã lưu ✓") : t("qr.actions.save", "Lưu")}</span>
          </button>

          {activeId && (
            <button
              type="button"
              className="qrg-action-btn"
              onClick={handleSaveAs}
              title={t("qr.actions.saveAs", "Lưu thành bản mới")}
            >
              <Save size={15} />
              <span>{t("qr.actions.saveAs", "Lưu mới")}</span>
            </button>
          )}

          <button
            type="button"
            className="qrg-reset-btn"
            onClick={handleReset}
            title={t("qr.actions.reset", "Đặt lại mặc định")}
          >
            <RotateCcw size={15} />
            <span>{t("qr.actions.reset", "Đặt lại")}</span>
          </button>
        </div>
      </div>

      {/* Save Dialog */}
      {saveDialogOpen && (
        <div className="qrg-save-dialog">
          <div className="qrg-save-dialog__inner">
            <h3>{t("qr.actions.saveName", "Đặt tên cho mã QR")}</h3>
            <input
              className="qrg-save-dialog__input"
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t("qr.actions.saveNamePlaceholder", "VD: QR WiFi nhà")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveConfirm();
                if (e.key === "Escape") setSaveDialogOpen(false);
              }}
            />
            <div className="qrg-save-dialog__buttons">
              <button
                type="button"
                className="qrg-action-btn qrg-action-btn--save"
                onClick={handleSaveConfirm}
              >
                <Save size={14} />
                <span>{t("qr.actions.confirm", "Lưu")}</span>
              </button>
              <button
                type="button"
                className="qrg-action-btn"
                onClick={() => setSaveDialogOpen(false)}
              >
                <X size={14} />
                <span>{t("qr.actions.cancel", "Hủy")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="qrg-layout">
        {/* Left Column: Form & Accordions */}
        <div className="qrg-left-col">
          {/* Data Type Selector */}
          <DataTypeSelector currentType={config.type} onChange={handleTypeChange} />

          {/* Content Input Card */}
          <div className="qrg-card qrg-input-card">
            <h2 className="qrg-card__title">{t("qr.sections.content", "Nhập thông tin")}</h2>
            <ContentInputs config={config} onChange={handleConfigChange} />
          </div>

          {/* Design & Customization Accordions */}
          <DesignAccordion config={config} onChange={handleConfigChange} />
        </div>

        {/* Right Column: Sticky Live Preview & Download */}
        <div className="qrg-right-col">
          <PreviewPanel config={config} />
        </div>
      </div>
    </div>
  );
}

export default QrGenerator;
