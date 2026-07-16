import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, ListTodo, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { Button, IconButton, TextInput } from "@/shared/ui";
import { useTaskStore } from "./store";
import "./tasks.css";

export const TASKS_FEATURE_ID = "tool-tasks";

function ToolTasks() {
  const { t } = useTranslation();
  const { items, loaded, load, add, toggle, edit, remove, reorder } = useTaskStore();
  const [text, setText] = useState("");
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return (
    <div className="tasks">
      <form
        className="tasks__add"
        onSubmit={(e) => {
          e.preventDefault();
          void add(text);
          setText("");
        }}
      >
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("tasks.placeholder")}
        />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          <Plus size={16} />
        </Button>
      </form>

      <div className="tasks__list">
        {items.length === 0 && <div className="tasks__empty">{t("tasks.empty")}</div>}
        {items.map((item) => (
          <div
            key={item.id}
            className={`task-row ${dragOver === item.id ? "task-row--dragover" : ""}`}
            draggable
            onDragStart={() => (dragId.current = item.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(item.id);
            }}
            onDragLeave={() => setDragOver((d) => (d === item.id ? null : d))}
            onDrop={() => {
              if (dragId.current) void reorder(dragId.current, item.id);
              dragId.current = null;
              setDragOver(null);
            }}
          >
            <GripVertical size={15} className="task-row__grip" />
            <button
              className={`task-check ${item.done ? "task-check--done" : ""}`}
              aria-pressed={item.done}
              aria-label="toggle"
              onClick={() => void toggle(item.id)}
            >
              {item.done && <Check size={13} />}
            </button>
            <input
              className={`task-row__text ${item.done ? "task-row__text--done" : ""}`}
              value={item.text}
              onChange={(e) => void edit(item.id, e.target.value)}
            />
            <IconButton
              label={t("common.delete")}
              className="task-row__del"
              onClick={() => void remove(item.id)}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}

registerFeature({
  id: TASKS_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-tasks",
  icon: ListTodo,
  defaultEnabled: true,
  component: ToolTasks,
  order: 2,
});

export default ToolTasks;
