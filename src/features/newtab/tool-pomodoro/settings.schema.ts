import { defineSchema } from "@/core/settings-engine/schema";

export const pomodoroSettingsSchema = defineSchema({
  workMin: { type: "number", label: "pomodoro.workMin", default: 25, min: 1, max: 120 },
  shortMin: { type: "number", label: "pomodoro.shortMin", default: 5, min: 1, max: 60 },
  longMin: { type: "number", label: "pomodoro.longMin", default: 15, min: 1, max: 60 },
  sessionsBeforeLong: {
    type: "number",
    label: "pomodoro.sessionsBeforeLong",
    default: 4,
    min: 1,
    max: 12,
  },
});
