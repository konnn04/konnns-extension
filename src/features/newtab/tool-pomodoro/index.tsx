import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Pause, Play, RotateCcw, SkipForward, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { requestNotificationPermission, hasNotificationPermission } from "@/core/notification-engine";
import { playSound } from "@/core/sound";
import { Button } from "@/shared/ui";
import {
  applyConfig,
  getState,
  pause,
  phaseDurationMs,
  reset,
  skip,
  start,
  type Phase,
  type PomodoroConfig,
  type PomodoroState,
} from "./state";
import { pomodoroSettingsSchema } from "./settings.schema";
import "./pomodoro.css";

export const POMODORO_FEATURE_ID = "tool-pomodoro";

const PHASE_EMOJI: Record<Phase, string> = { work: "🧠", short: "☕", long: "🌴" };

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function DurationStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pomo-stepper">
      <span className="pomo-stepper__label">{label}</span>
      <div className="pomo-stepper__ctrl">
        <button onClick={() => onChange(Math.max(1, value - 1))}>−</button>
        <span>{value}</span>
        <button onClick={() => onChange(Math.min(120, value + 1))}>+</button>
      </div>
    </div>
  );
}

function ToolPomodoro() {
  const { t } = useTranslation();
  const values = useFeatureValues(POMODORO_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const [state, setLocalState] = useState<PomodoroState | null>(null);
  const [now, setNow] = useState(Date.now());
  const configRef = useRef<PomodoroConfig>();

  const config: PomodoroConfig = {
    workMin: (values.workMin as number) ?? 25,
    shortMin: (values.shortMin as number) ?? 5,
    longMin: (values.longMin as number) ?? 15,
    sessionsBeforeLong: (values.sessionsBeforeLong as number) ?? 4,
  };

  const lastPhase = useRef<Phase>();
  const sync = useCallback(async () => {
    const s = await getState();
    if (lastPhase.current && lastPhase.current !== s.phase) playSound("pomodoro");
    lastPhase.current = s.phase;
    setLocalState(s);
  }, []);

  useEffect(() => {
    void sync();
    // reflect background alarm advances / other tabs (guarded — extension-only API)
    const onChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === "local" && changes["pomodoro:state"]) void sync();
    };
    browser.storage?.onChanged?.addListener(onChange);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      browser.storage?.onChanged?.removeListener(onChange);
      window.clearInterval(tick);
    };
  }, [sync]);

  // push settings changes into the shared timer state
  useEffect(() => {
    const key = JSON.stringify(config);
    if (configRef.current && JSON.stringify(configRef.current) === key) return;
    configRef.current = config;
    void applyConfig(config).then(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.workMin, config.shortMin, config.longMin, config.sessionsBeforeLong]);

  if (!state) return null;

  const remaining = state.running && state.endsAt ? state.endsAt - now : state.remainingMs;
  const total = phaseDurationMs(state.phase, state.config);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));

  const R = 82;
  const C = 2 * Math.PI * R;

  const onStart = async () => {
    if (!(await hasNotificationPermission())) await requestNotificationPermission();
    await start(config);
    await sync();
  };

  return (
    <div className="pomo">
      <span className="pomo__phase">
        {PHASE_EMOJI[state.phase]} {t(`pomodoro.${state.phase}`)}
      </span>

      <div className="pomo__ring">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle className="pomo__ring-bg" cx="90" cy="90" r={R} />
          <circle
            className="pomo__ring-fg"
            cx="90"
            cy="90"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
        <div className="pomo__center">
          <span className="pomo__emoji">{PHASE_EMOJI[state.phase]}</span>
          <span className="pomo__time">{fmt(remaining)}</span>
        </div>
      </div>

      <div className="pomo__controls">
        <Button variant="ghost" onClick={() => void reset(config).then(sync)} aria-label={t("pomodoro.reset")}>
          <RotateCcw size={18} />
        </Button>
        <Button
          variant="primary"
          className="pomo__main-btn"
          onClick={() => (state.running ? void pause().then(sync) : void onStart())}
        >
          {state.running ? <Pause size={18} /> : <Play size={18} />}
          {state.running ? t("pomodoro.pause") : t("pomodoro.start")}
        </Button>
        <Button variant="ghost" onClick={() => void skip().then(sync)} aria-label={t("pomodoro.skip")}>
          <SkipForward size={18} />
        </Button>
      </div>

      <span className="pomo__sessions">
        {t("pomodoro.session")}: {state.completedWork}
      </span>

      {/* inline duration editing — no need to open Settings (docs item 20) */}
      <div className="pomo__durations">
        <DurationStepper
          label={t("pomodoro.work")}
          value={config.workMin}
          onChange={(v) => setValue(POMODORO_FEATURE_ID, "workMin", v)}
        />
        <DurationStepper
          label={t("pomodoro.short")}
          value={config.shortMin}
          onChange={(v) => setValue(POMODORO_FEATURE_ID, "shortMin", v)}
        />
        <DurationStepper
          label={t("pomodoro.long")}
          value={config.longMin}
          onChange={(v) => setValue(POMODORO_FEATURE_ID, "longMin", v)}
        />
      </div>
    </div>
  );
}

registerFeature({
  id: POMODORO_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-pomodoro",
  icon: Timer,
  defaultEnabled: true,
  notifiable: true,
  settingsSchema: pomodoroSettingsSchema,
  component: ToolPomodoro,
  order: 1,
});

export default ToolPomodoro;
