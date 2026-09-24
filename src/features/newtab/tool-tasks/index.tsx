import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  GripVertical,
  ListTodo,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import type { TaskType } from "@/core/storage/db";
import { Button, DatePicker, IconButton, Select, TextInput } from "@/shared/ui";
import { useTaskStore } from "./store";
import "./tasks.css";

export const TASKS_FEATURE_ID = "tool-tasks";

const TASK_TYPES: TaskType[] = ["once", "daily", "weekly", "monthly"];

const TYPE_ICON: Record<TaskType, LucideIcon> = {
  once: Flag,
  daily: Repeat,
  weekly: CalendarDays,
  monthly: CalendarRange,
};

function typeOptions(t: (key: string) => string) {
  return TASK_TYPES.map((v) => ({ value: v, label: t(`tasks.type.${v}`) }));
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function ToolTasks() {
  const { t } = useTranslation();
  const { items, loaded, load, add, toggle, edit, setDeadline, setTaskType, remove, reorder } =
    useTaskStore();
  const [text, setText] = useState("");
  const [addExpanded, setAddExpanded] = useState(false);
  const [newDeadline, setNewDeadline] = useState<number | undefined>(undefined);
  const [newType, setNewType] = useState<TaskType>("once");
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const now = Date.now();

  return (
    <div className="tasks">
      <form
        className="tasks__add"
        onSubmit={(e) => {
          e.preventDefault();
          void add(text, newType, newType === "once" ? newDeadline : undefined);
          setText("");
          setNewDeadline(undefined);
          setNewType("once");
          setAddExpanded(false);
        }}
      >
        <div className="tasks__add-row">
          <TextInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("tasks.placeholder")}
          />
          <IconButton
            label={t("tasks.moreOptions")}
            className={addExpanded ? "tasks__add-expand--on" : ""}
            onClick={() => setAddExpanded((v) => !v)}
          >
            {addExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            <Plus size={16} />
          </Button>
        </div>
        {addExpanded && (
          <div className="tasks__add-extra">
            <Select
              className="tasks__add-type"
              value={newType}
              onChange={(v) => {
                setNewType(v as TaskType);
                if (v !== "once") setNewDeadline(undefined);
              }}
              options={typeOptions(t)}
            />
            {newType === "once" && (
              <DatePicker
                className="tasks__add-date"
                value={newDeadline}
                onChange={setNewDeadline}
                placeholder={t("tasks.deadline")}
              />
            )}
          </div>
        )}
      </form>

      <div className="tasks__list">
        {items.length === 0 && <div className="tasks__empty">{t("tasks.empty")}</div>}
        {items.map((item) => {
          const overdue = !item.done && !!item.deadline && item.deadline < now;
          const editing = editingId === item.id;
          const TypeIcon = TYPE_ICON[item.taskType];
          return (
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
              <div className="task-row__main">
                <GripVertical size={15} className="task-row__grip" />
                <button
                  className={`task-check ${item.done ? "task-check--done" : ""}`}
                  aria-pressed={item.done}
                  aria-label="toggle"
                  onClick={() => void toggle(item.id)}
                >
                  {item.done && <Check size={13} />}
                </button>

                {editing ? (
                  <input
                    className={`task-row__text ${item.done ? "task-row__text--done" : ""}`}
                    value={item.text}
                    autoFocus
                    onChange={(e) => void edit(item.id, e.target.value)}
                  />
                ) : (
                  <span
                    className={`task-row__title ${item.done ? "task-row__title--done" : ""}`}
                  >
                    {item.text}
                  </span>
                )}

                {!editing && item.deadline && (
                  <span className={`task-row__badge ${overdue ? "task-row__badge--overdue" : ""}`}>
                    {fmtDate(item.deadline)}
                  </span>
                )}
                {!editing && (
                  <span className="task-row__type-icon" title={t(`tasks.type.${item.taskType}`)}>
                    <TypeIcon size={13} />
                  </span>
                )}

                <IconButton
                  label={editing ? t("common.done") : t("common.edit")}
                  className="task-row__edit"
                  onClick={() => setEditingId(editing ? null : item.id)}
                >
                  {editing ? <Check size={14} /> : <Pencil size={14} />}
                </IconButton>
                <IconButton
                  label={t("common.delete")}
                  className="task-row__del"
                  onClick={() => void remove(item.id)}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>

              {editing && (
                <div className="task-row__meta">
                  <Select
                    className="task-row__type"
                    value={item.taskType}
                    onChange={(v) => {
                      void setTaskType(item.id, v as TaskType);
                      if (v !== "once") void setDeadline(item.id, undefined);
                    }}
                    options={typeOptions(t)}
                  />
                  {item.taskType === "once" && (
                    <DatePicker
                      className={`task-row__deadline ${overdue ? "task-row__deadline--overdue" : ""}`}
                      value={item.deadline}
                      placeholder={t("tasks.deadline")}
                      onChange={(v) => void setDeadline(item.id, v)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
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
