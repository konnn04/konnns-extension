import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Redo2, Trash2, Undo2 } from "lucide-react";
import { navigate, useHashRoute } from "@/core/router/useHashRoute";
import { IconButton } from "@/shared/ui";
import { DocList } from "./DocList";
import { EditorCanvas, type EditorCanvasHandle, type SelectedLayerProperties } from "./EditorCanvas";
import { ToolPalette } from "./ToolPalette";
import { LayerPanel } from "./LayerPanel";
import { LayerProperties } from "./LayerProperties";
import { ExportMenu } from "./ExportMenu";
import { PasteButton } from "./PasteButton";
import { CanvasSizeMenu } from "./CanvasSizeMenu";
import { PropertyBar } from "./PropertyBar";
import { getProject, getProjectAssets, saveProject } from "./engine/store";
import type { FabricCanvasJson, ImageProjectRecord, LayerEntry, ToolId } from "./engine/types";
import "./image-editor.css";

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function ImageEditor() {
  const { segments, navigate: nav } = useHashRoute();
  const projectId = segments[1];

  if (!projectId) return <DocList onOpen={(id) => nav(`/image-editor/${id}`)} />;
  return <EditorView key={projectId} projectId={projectId} onBack={() => nav("/image-editor")} />;
}

function EditorView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{ project: ImageProjectRecord; assets: Map<string, string> } | null>(null);
  const [missing, setMissing] = useState(false);
  const [tool, setTool] = useState<ToolId>("select");
  const [layers, setLayers] = useState<LayerEntry[]>([]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const [fillColor, setFillColor] = useState("transparent");
  const [strokeColor, setStrokeColor] = useState("#e5484d");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [autoExpand, setAutoExpand] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [selectionInfo, setSelectionInfo] = useState<SelectedLayerProperties>({
    hasSelection: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    angle: 0,
    opacity: 100,
  });

  const canvasRef = useRef<EditorCanvasHandle | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef<ImageProjectRecord | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const project = await getProject(projectId);
      if (!live) return;
      if (!project) {
        setMissing(true);
        return;
      }
      const assets = await getProjectAssets(projectId);
      if (!live) return;
      projectRef.current = project;
      setDimensions({ width: project.canvasWidth, height: project.canvasHeight });
      setLoaded({ project, assets });
    })();
    return () => {
      live = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [projectId]);

  useEffect(() => {
    if (!pasteError) return;
    const id = setTimeout(() => setPasteError(null), 4000);
    return () => clearTimeout(id);
  }, [pasteError]);

  // Global keyboard shortcut for layer duplication (Ctrl + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectionInfo.hasSelection && selectionInfo.layerId) {
          e.preventDefault();
          void canvasRef.current?.duplicateLayer(selectionInfo.layerId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionInfo]);

  const scheduleSave = useCallback((json: FabricCanvasJson, dims?: { width: number; height: number }, thumbnail?: string) => {
    const project = projectRef.current;
    if (!project) return;
    const nextProject = {
      ...project,
      fabricJson: json,
      ...(dims ? { canvasWidth: dims.width, canvasHeight: dims.height } : {}),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
    };
    projectRef.current = nextProject;
    if (dims) {
      setDimensions(dims);
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const current = projectRef.current;
      if (current) void saveProject(current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const rename = (name: string) => {
    const project = projectRef.current;
    if (!project) return;
    const next = { ...project, name, updatedAt: Date.now() };
    projectRef.current = next;
    void saveProject(next);
    setLoaded((prev) => (prev ? { ...prev, project: next } : prev));
  };

  const handleFillChange = (c: string) => {
    setFillColor(c);
    if (selectionInfo.hasSelection) {
      canvasRef.current?.updateActiveObjectStyle({ fill: c });
    }
  };

  const handleStrokeChange = (c: string) => {
    setStrokeColor(c);
    if (selectionInfo.hasSelection) {
      canvasRef.current?.updateActiveObjectStyle({ stroke: c });
    }
  };

  const handleStrokeWidthChange = (w: number) => {
    setStrokeWidth(w);
    if (selectionInfo.hasSelection) {
      canvasRef.current?.updateActiveObjectStyle({ strokeWidth: w });
    }
  };

  const handleSelectionChange = (info: SelectedLayerProperties) => {
    setSelectionInfo(info);
    if (info.hasSelection) {
      if (info.fill !== undefined) setFillColor(info.fill);
      if (info.stroke !== undefined) setStrokeColor(info.stroke);
      if (info.strokeWidth !== undefined) setStrokeWidth(info.strokeWidth);
    }
  };

  if (missing) return <DocList onOpen={(id) => navigate(`/image-editor/${id}`)} />;
  if (!loaded) return null;

  return (
    <div className="ied">
      <header className="ied__header">
        <IconButton label={t("common.back")} onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>

        {editingTitle === null ? (
          <button type="button" className="ied__title" onClick={() => setEditingTitle(loaded.project.name)}>
            <strong>{loaded.project.name || t("imageEditor.untitled")}</strong>
          </button>
        ) : (
          <input
            className="ied__title-input"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => {
              if (editingTitle.trim()) rename(editingTitle.trim());
              setEditingTitle(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitle(null);
            }}
          />
        )}

        <CanvasSizeMenu
          dimensions={dimensions}
          autoExpand={autoExpand}
          onDimensionsChange={(w, h) => {
            setDimensions({ width: w, height: h });
            canvasRef.current?.setCanvasSize(w, h);
          }}
          onAutoExpandChange={setAutoExpand}
          onFitContent={() => canvasRef.current?.fitToContent()}
        />

        <IconButton label={t("imageEditor.undo")} disabled={!history.canUndo} onClick={() => canvasRef.current?.undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label={t("imageEditor.redo")} disabled={!history.canRedo} onClick={() => canvasRef.current?.redo()}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton label={t("imageEditor.deleteSelected")} onClick={() => canvasRef.current?.deleteSelected()}>
          <Trash2 size={16} />
        </IconButton>

        <span className="ied__spacer" />
        <PasteButton canvasRef={canvasRef} onError={setPasteError} />
        <ExportMenu canvasRef={canvasRef} projectName={loaded.project.name} />
      </header>

      <PropertyBar
        activeTool={tool}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        hasSelection={selectionInfo.hasSelection}
        onFillChange={handleFillChange}
        onStrokeChange={handleStrokeChange}
        onStrokeWidthChange={handleStrokeWidthChange}
        onCropToSelected={() => canvasRef.current?.cropToSelected()}
      />

      {pasteError && <div className="ied__toast">{t(pasteError)}</div>}
      {(tool === "crop" || tool === "redact") && (
        <div className="ied__hint">{tool === "crop" ? t("imageEditor.cropHint") : t("imageEditor.redactHint")}</div>
      )}

      <div className="ied__body">
        <ToolPalette active={tool} onChange={setTool} />
        <EditorCanvas
          ref={canvasRef}
          project={loaded.project}
          assets={loaded.assets}
          activeTool={tool}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          autoExpandCanvas={autoExpand}
          onToolChange={setTool}
          onLayersChange={setLayers}
          onHistoryChange={(canUndo, canRedo) => setHistory({ canUndo, canRedo })}
          onSnapshot={scheduleSave}
          onPasteError={setPasteError}
          onSelectionChange={handleSelectionChange}
          onDimensionsChange={(dims) => setDimensions(dims)}
        />
        <aside className="ied__sidebar">
          {/* Top Half: Layer Properties */}
          <div className="ied__sidebar-section ied__sidebar-section--props">
            <LayerProperties
              selection={selectionInfo}
              canvasSize={dimensions}
              onUpdateTransform={(patch) => canvasRef.current?.updateActiveObjectTransform(patch)}
              onUpdateStyle={(patch) => canvasRef.current?.updateActiveObjectStyle(patch)}
              onUpdateText={(patch) => canvasRef.current?.updateActiveObjectText(patch)}
              onAlign={(align) => canvasRef.current?.alignActiveObject(align)}
              onFlip={(axis) => canvasRef.current?.flipActiveObject(axis)}
              onRotate={(delta) => canvasRef.current?.rotateActiveObject(delta)}
              onCropToSelected={() => canvasRef.current?.cropToSelected()}
              onSetCanvasSize={(w, h) => {
                setDimensions({ width: w, height: h });
                canvasRef.current?.setCanvasSize(w, h);
              }}
              onSetCanvasBg={(color) => canvasRef.current?.setCanvasBackgroundColor(color)}
              onFitContent={() => canvasRef.current?.fitToContent()}
            />
          </div>

          <div className="ied__sidebar-divider" />

          {/* Bottom Half: Layer Management */}
          <div className="ied__sidebar-section ied__sidebar-section--layers">
            <LayerPanel
              layers={layers}
              selectedLayerId={selectionInfo.hasSelection ? selectionInfo.layerId : undefined}
              onSelect={(id) => canvasRef.current?.selectLayer(id)}
              onToggleVisible={(id, v) => canvasRef.current?.setLayerVisible(id, v)}
              onToggleLocked={(id, v) => canvasRef.current?.setLayerLocked(id, v)}
              onRename={(id, name) => canvasRef.current?.setLayerName(id, name)}
              onReorder={(id, idx) => canvasRef.current?.moveLayer(id, idx)}
              onDelete={(id) => canvasRef.current?.deleteLayer(id)}
              onDuplicate={(id) => void canvasRef.current?.duplicateLayer(id)}
              onBringForward={(id) => canvasRef.current?.bringForward(id)}
              onSendBackward={(id) => canvasRef.current?.sendBackward(id)}
              onBringToFront={(id) => canvasRef.current?.bringToFront(id)}
              onSendToBack={(id) => canvasRef.current?.sendToBack(id)}
              onAddText={() => canvasRef.current?.addTextLayer()}
              onAddShape={(kind) => canvasRef.current?.addShapeLayer(kind)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
