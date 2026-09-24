import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Image,
  Layers,
  Lock,
  Minus,
  Paintbrush,
  ShieldAlert,
  Square,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import type { LayerEntry, LayerKind } from "./engine/types";

function LayerKindIcon({ kind }: { kind: LayerKind }) {
  switch (kind) {
    case "image":
      return <Image size={13} className="ied__layer-type-icon" />;
    case "text":
      return <Type size={13} className="ied__layer-type-icon" />;
    case "rect":
      return <Square size={13} className="ied__layer-type-icon" />;
    case "ellipse":
      return <Circle size={13} className="ied__layer-type-icon" />;
    case "line":
      return <Minus size={13} className="ied__layer-type-icon" />;
    case "blur":
      return <ShieldAlert size={13} className="ied__layer-type-icon" />;
    default:
      return <Paintbrush size={13} className="ied__layer-type-icon" />;
  }
}

interface ContextMenuState {
  x: number;
  y: number;
  layer: LayerEntry;
}

export function LayerPanel({
  layers,
  selectedLayerId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onRename,
  onReorder,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onAddText,
  onAddShape,
}: {
  layers: LayerEntry[];
  selectedLayerId?: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, toPanelIndex: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onAddText?: () => void;
  onAddShape?: (kind: "rect" | "ellipse") => void;
}) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const commitRename = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  };

  // Close context menu on outside click or scroll or escape
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, layer: LayerEntry) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(layer.id);

    // Calculate clamped menu coordinates
    const menuWidth = 190;
    const menuHeight = 280;
    const posX = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const posY = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      x: posX,
      y: posY,
      layer,
    });
  };

  return (
    <div className="ied__layer-manager">
      {/* Header bar */}
      <div className="ied__layer-manager-head">
        <div className="ied__layer-manager-title">
          <Layers size={13} />
          <span>{t("imageEditor.layers", "Lớp (Layers)")}</span>
        </div>
        <span className="ied__layer-count-badge">{layers.length}</span>
      </div>

      {/* Layer List */}
      <div className="ied__layers-scroll">
        {layers.length === 0 ? (
          <p className="ied__layers-empty">{t("imageEditor.noLayers", "Chưa có lớp nào")}</p>
        ) : (
          <ul className="ied__layers" role="list">
            {layers.map((layer, index) => {
              const isSelected = selectedLayerId === layer.id;
              return (
                <li
                  key={layer.id}
                  className={`ied__layer ${isSelected ? "ied__layer--selected" : ""} ${dragId === layer.id ? "ied__layer--dragging" : ""}`}
                  draggable={!layer.locked}
                  onClick={() => onSelect(layer.id)}
                  onContextMenu={(e) => handleContextMenu(e, layer)}
                  onDragStart={() => setDragId(layer.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== layer.id) onReorder(dragId, index);
                    setDragId(null);
                  }}
                >
                  {/* Eye toggle button */}
                  <button
                    type="button"
                    className="ied__layer-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisible(layer.id, !layer.visible);
                    }}
                    title={layer.visible ? t("imageEditor.hideLayer", "Ẩn lớp") : t("imageEditor.showLayer", "Hiện lớp")}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="ied__layer-icon-off" />}
                  </button>

                  {/* Layer kind icon */}
                  <span className="ied__layer-thumb">
                    <LayerKindIcon kind={layer.kind} />
                  </span>

                  {/* Name or inline editing input */}
                  {editingId === layer.id ? (
                    <input
                      className="ied__layer-name-input"
                      autoFocus
                      value={draft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <span
                      className="ied__layer-name"
                      title={layer.name}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(layer.id);
                        setDraft(layer.name);
                      }}
                    >
                      {layer.name}
                    </span>
                  )}

                  {/* Actions: Lock toggle */}
                  <button
                    type="button"
                    className={`ied__layer-icon-btn ${layer.locked ? "ied__layer-icon-btn--locked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLocked(layer.id, !layer.locked);
                    }}
                    title={layer.locked ? t("imageEditor.unlockLayer", "Mở khóa") : t("imageEditor.lockLayer", "Khóa")}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} className="ied__layer-icon-faint" />}
                  </button>

                  {/* Delete button (hover/active trash) */}
                  <button
                    type="button"
                    className="ied__layer-icon-btn ied__layer-icon-btn--delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(layer.id);
                    }}
                    title={t("imageEditor.deleteLayer", "Xóa lớp")}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer bar with quick layer actions like Photoshop */}
      <div className="ied__layer-manager-footer">
        {onAddText && (
          <button
            type="button"
            className="ied__layer-footer-btn"
            onClick={onAddText}
            title={t("imageEditor.addText", "Thêm chữ")}
          >
            <Type size={13} />
          </button>
        )}
        {onAddShape && (
          <button
            type="button"
            className="ied__layer-footer-btn"
            onClick={() => onAddShape("rect")}
            title={t("imageEditor.addRect", "Thêm hình chữ nhật")}
          >
            <Square size={13} />
          </button>
        )}
        {selectedLayerId && (
          <>
            <button
              type="button"
              className="ied__layer-footer-btn"
              onClick={() => onDuplicate(selectedLayerId)}
              title={t("imageEditor.duplicateLayer", "Nhân đôi lớp (Ctrl+D)")}
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              className="ied__layer-footer-btn ied__layer-footer-btn--danger"
              onClick={() => onDelete(selectedLayerId)}
              title={t("imageEditor.deleteLayer", "Xóa lớp (Delete)")}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="ied__context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="ied__context-menu-header">
            <span>{contextMenu.layer.name}</span>
          </div>

          <button
            type="button"
            className="ied__context-item ied__context-item--danger"
            onClick={() => {
              onDelete(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <Trash2 size={13} />
            <span>{t("imageEditor.deleteLayer", "Xóa lớp")}</span>
            <kbd>Del</kbd>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onDuplicate(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <Copy size={13} />
            <span>{t("imageEditor.duplicateLayer", "Nhân đôi lớp")}</span>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              setEditingId(contextMenu.layer.id);
              setDraft(contextMenu.layer.name);
              setContextMenu(null);
            }}
          >
            <Edit2 size={13} />
            <span>{t("imageEditor.renameLayer", "Đổi tên lớp")}</span>
          </button>

          <div className="ied__context-divider" />

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onToggleLocked(contextMenu.layer.id, !contextMenu.layer.locked);
              setContextMenu(null);
            }}
          >
            {contextMenu.layer.locked ? <Unlock size={13} /> : <Lock size={13} />}
            <span>{contextMenu.layer.locked ? t("imageEditor.unlockLayer", "Mở khóa") : t("imageEditor.lockLayer", "Khóa lớp")}</span>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onToggleVisible(contextMenu.layer.id, !contextMenu.layer.visible);
              setContextMenu(null);
            }}
          >
            {contextMenu.layer.visible ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{contextMenu.layer.visible ? t("imageEditor.hideLayer", "Ẩn lớp") : t("imageEditor.showLayer", "Hiện lớp")}</span>
          </button>

          <div className="ied__context-divider" />

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onBringForward(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <ArrowUp size={13} />
            <span>{t("imageEditor.bringForward", "Tiến 1 lớp")}</span>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onSendBackward(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <ArrowDown size={13} />
            <span>{t("imageEditor.sendBackward", "Lùi 1 lớp")}</span>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onBringToFront(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <ChevronsUp size={13} />
            <span>{t("imageEditor.bringToFront", "Lên trên cùng")}</span>
          </button>

          <button
            type="button"
            className="ied__context-item"
            onClick={() => {
              onSendToBack(contextMenu.layer.id);
              setContextMenu(null);
            }}
          >
            <ChevronsDown size={13} />
            <span>{t("imageEditor.sendToBack", "Xuống dưới cùng")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
