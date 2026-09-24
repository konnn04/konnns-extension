import { useTranslation } from "react-i18next";
import { Circle, Crop, EyeOff, Minus, MousePointer2, Paintbrush, Square, Type } from "lucide-react";
import type { ToolId } from "./engine/types";

const TOOLS: Array<{ id: ToolId; icon: typeof MousePointer2; key: string }> = [
  { id: "select", icon: MousePointer2, key: "V" },
  { id: "rect", icon: Square, key: "R" },
  { id: "ellipse", icon: Circle, key: "O" },
  { id: "line", icon: Minus, key: "L" },
  { id: "text", icon: Type, key: "T" },
  { id: "brush", icon: Paintbrush, key: "B" },
  { id: "crop", icon: Crop, key: "C" },
  // "E" for eraser, the closest Photoshop key by meaning — this tool erases
  // content rather than annotating over it
  { id: "redact", icon: EyeOff, key: "E" },
];

/** Photoshop-familiar letter shortcuts, remapped to what this tool actually needs — docs/roadmap/07-image-editor.md §2. */
export function ToolPalette({ active, onChange }: { active: ToolId; onChange: (tool: ToolId) => void }) {
  const { t } = useTranslation();
  return (
    <div className="ied__palette">
      {TOOLS.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          type="button"
          className={`ied__tool ${active === id ? "ied__tool--active" : ""}`}
          title={`${t(`imageEditor.tool.${id}`)} (${key})`}
          onClick={() => onChange(id)}
        >
          <Icon size={17} />
          <span className="ied__tool-key">{key}</span>
        </button>
      ))}
    </div>
  );
}
