import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Calendar,
  Contact,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  Type,
  Wifi,
} from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { siteUrl } from "@/core/messaging";
import { STYLE_PRESETS } from "../engine/presets";
import { buildQrPayload } from "../engine/encoder";
import type { SavedQrConfig } from "../engine/storage";
import type { DataType, QrConfig } from "../types";
import { QrThumbnail } from "./QrThumbnail";

interface QrLandingProps {
  savedList: SavedQrConfig[];
  onCreateNew: (presetConfig?: Partial<QrConfig>) => void;
  onOpenSaved: (item: SavedQrConfig) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
}

const TYPE_ICONS: Record<DataType, typeof Globe> = {
  url: Globe,
  text: Type,
  wifi: Wifi,
  vcard: Contact,
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  event: Calendar,
  geo: MapPin,
  crypto: Sparkles,
};

export function QrLanding({
  savedList,
  onCreateNew,
  onOpenSaved,
  onDelete,
  onRename,
  onDuplicate,
}: QrLandingProps) {
  const { t } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleStartRename = (e: React.MouseEvent, item: SavedQrConfig) => {
    e.stopPropagation();
    setRenamingId(item.id);
    setRenamingName(item.name);
  };

  const handleFinishRename = (id: string) => {
    const next = renamingName.trim();
    if (next) onRename(id, next);
    setRenamingId(null);
  };

  const presetsSection = (
    <div className="qrg-landing__section qrg-landing__section--presets">
      <div className="qrg-landing__section-head">
        <div>
          <h2 className="qrg-landing__section-title">
            <Sparkles size={18} className="qrg-sparkle-icon" />
            <span>{t("qr.landing.presetsHeading", "Mẫu thiết kế có sẵn")}</span>
          </h2>
          <p className="qrg-landing__section-desc">
            {t(
              "qr.landing.presetsDesc",
              "Chọn một mẫu yêu thích để bắt đầu tạo mã QR với phong cách ấn tượng.",
            )}
          </p>
        </div>
      </div>

      <div className="qrg-template-grid">
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="qrg-template-card"
            onClick={() => onCreateNew(p.config)}
          >
            <div className="qrg-template-card__preview">
              <QrThumbnail config={p.config} size={84} />
            </div>
            <div className="qrg-template-card__info">
              <span className="qrg-template-card__name">{t(p.nameKey)}</span>
              <span className="qrg-template-card__cta">
                <span>{t("qr.landing.useTemplate", "Dùng mẫu này")}</span>
                <ArrowRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // 1. Empty State: Image 1 Pattern
  if (savedList.length === 0) {
    return (
      <div className="qrg-landing">
        <div className="qrg__empty-screen">
          <div className="qrg__empty-icon">
            <QrCode size={44} />
          </div>
          <h1 className="qrg__empty-title">
            {t("qr.landing.emptyTitle", "Chưa có mã QR nào được tạo")}
          </h1>
          <p className="qrg__empty-desc">
            {t(
              "qr.landing.emptyDesc",
              "Bắt đầu bằng cách tạo một mã QR mới từ đầu hoặc chọn nhanh một mẫu thiết kế có sẵn bên dưới.",
            )}
          </p>
          <div className="qrg__empty-actions">
            <Button
              variant="primary"
              onClick={() => onCreateNew()}
            >
              <Plus size={16} />
              <span>{t("qr.actions.createNew", "Tạo mã QR mới")}</span>
            </Button>
          </div>
        </div>

        {presetsSection}
      </div>
    );
  }

  // 2. Grid State: Image 2 Pattern
  return (
    <div className="qrg-landing">
      {/* Top Header */}
      <div className="qrg__grid-head">
        <h1>{t("qr.header.title", "Trình tạo mã QR Đa năng")}</h1>
        <div className="qrg__grid-head-actions">
          <Button
            variant="primary"
            onClick={() => onCreateNew()}
          >
            <Plus size={15} />
            <span>{t("qr.actions.createNew", "Tạo mã QR mới")}</span>
          </Button>
        </div>
      </div>

      {/* Grid of Saved Projects */}
      <div className="qrg__grid">
        {savedList.map((item) => {
          const Icon = TYPE_ICONS[item.config.type] || Globe;
          const typeLabel = t(`qr.types.${item.config.type}`, item.config.type);
          const payload = buildQrPayload(item.config);

          return (
            <div
              key={item.id}
              className="qrg__card"
            >
              <button
                type="button"
                className="qrg__card-thumb"
                onClick={() => onOpenSaved(item)}
                title={item.name}
              >
                <QrThumbnail
                  config={item.config}
                  size={110}
                  data={payload}
                />
              </button>

              <div className="qrg__card-meta">
                {renamingId === item.id ? (
                  <input
                    className="qrg__card-rename-input"
                    type="text"
                    value={renamingName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinishRename(item.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleFinishRename(item.id)}
                  />
                ) : (
                  <span
                    className="qrg__card-name"
                    title={item.name}
                    onClick={() => onOpenSaved(item)}
                  >
                    {item.name}
                  </span>
                )}
                <div className="qrg__card-submeta">
                  <span className="qrg__card-type-pill">
                    <Icon size={11} />
                    <span>{typeLabel}</span>
                  </span>
                  <span className="qrg__card-date">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="qrg__card-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  label={t("whiteboard.openInNewTab", "Mở tab mới")}
                  title={t("whiteboard.openInNewTab", "Mở tab mới")}
                  onClick={() => window.open(siteUrl(`/qr-generator/${item.id}`), "_blank")}
                >
                  <ExternalLink size={13} />
                </IconButton>
                {onDuplicate && (
                  <IconButton
                    label={t("whiteboard.duplicate", "Nhân bản")}
                    title={t("whiteboard.duplicate", "Nhân bản")}
                    onClick={() => onDuplicate(item.id)}
                  >
                    <Copy size={13} />
                  </IconButton>
                )}
                <IconButton
                  label={t("common.rename", "Đổi tên")}
                  title={t("common.rename", "Đổi tên")}
                  onClick={(e) => handleStartRename(e, item)}
                >
                  <Pencil size={13} />
                </IconButton>
                {confirmDeleteId === item.id ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onDelete(item.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    {t("common.confirm", "Xóa")}
                  </Button>
                ) : (
                  <IconButton
                    label={t("common.delete", "Xóa")}
                    title={t("common.delete", "Xóa")}
                    onClick={() => setConfirmDeleteId(item.id)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {presetsSection}
    </div>
  );
}
