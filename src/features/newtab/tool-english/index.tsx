import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  ChevronDown,
  GraduationCap,
  Loader2,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { Button } from "@/shared/ui";
import {
  getWordDetail,
  learningDayKey,
  pickDaily,
  quizChoices,
  type WordDetail,
} from "./api";
import type { VocabWord } from "./words";
import { englishSettingsSchema } from "./settings.schema";
import { EnglishDailyAutoOpen } from "./AutoOpen";
import { ENGLISH_FEATURE_ID } from "./constants";
import "./english.css";

const detailCache = new Map<string, WordDetail>();

/** Pronounce English text with the browser's built-in speech synthesis (offline). */
function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    synth.speak(u);
  } catch {
    /* speech synthesis unsupported */
  }
}

function WordRow({ item, online }: { item: VocabWord; online: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WordDetail | null>(detailCache.get(item.word) ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || detail || busy) return;
    setBusy(true);
    setFailed(false);
    getWordDetail(item.word)
      .then((d) => {
        detailCache.set(item.word, d);
        setDetail(d);
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }, [open, detail, busy, item.word]);

  return (
    <div className={`eng-word ${open ? "eng-word--open" : ""}`}>
      <div className="eng-word__head">
        <button className="eng-word__toggle" onClick={() => setOpen((o) => !o)}>
          <span className="eng-word__term">{item.word}</span>
          {detail?.phonetic && <span className="eng-word__phon">{detail.phonetic}</span>}
          <ChevronDown size={16} className="eng-word__chev" />
        </button>
        <button
          className="eng-word__speak"
          title={t("english.listen")}
          aria-label={t("english.listen")}
          onClick={() => speak(item.word)}
        >
          <Volume2 size={16} />
        </button>
      </div>
      {open && (
        <div className="eng-word__body">
          <p className="eng-word__meaning">{item.meaning}</p>
          {busy && (
            <span className="eng-word__loading">
              <Loader2 size={14} className="eng-spin" /> {t("english.loading")}
            </span>
          )}
          {detail && detail.definitions.length > 1 && (
            <ul className="eng-word__defs">
              {detail.definitions.slice(1).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {detail && detail.examples.length > 0 && (
            <div className="eng-word__examples">
              <span className="eng-word__label">{t("english.examples")}</span>
              {detail.examples.map((ex, i) => (
                <p key={i} className="eng-word__ex">
                  “{ex}”
                  <button
                    className="eng-word__ex-speak"
                    title={t("english.listen")}
                    aria-label={t("english.listen")}
                    onClick={() => speak(ex)}
                  >
                    <Volume2 size={13} />
                  </button>
                </p>
              ))}
            </div>
          )}
          {!busy && detail && detail.examples.length === 0 && (
            <p className="eng-word__ex eng-word__ex--muted">{t("english.noExamples")}</p>
          )}
          {failed && (
            <p className="eng-word__ex eng-word__ex--muted">
              {online ? t("english.failed") : t("english.offline")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function buildQuestions(words: VocabWord[]) {
  return words.map((w) => ({ word: w, choices: quizChoices(w) }));
}

function Quiz({ words, onBack }: { words: VocabWord[]; onBack: () => void }) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState(() => buildQuestions(words));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  // rebuild (and reset) when the day's word set changes
  useEffect(() => {
    setQuestions(buildQuestions(words));
    setI(0);
    setPicked(null);
    setScore(0);
  }, [words]);

  const done = i >= questions.length;
  const q = questions[i];

  const pick = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    if (choice === q.word.meaning) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setI((n) => n + 1);
  };
  const restart = () => {
    setQuestions(buildQuestions(words));
    setScore(0);
    setI(0);
    setPicked(null);
  };

  if (done) {
    return (
      <div className="eng-quiz eng-quiz--done">
        <GraduationCap size={40} className="eng-quiz__trophy" />
        <p className="eng-quiz__result">
          {t("english.quizDone", { score, total: questions.length })}
        </p>
        <div className="eng-quiz__actions">
          <Button variant="primary" onClick={restart}>
            {t("english.restartQuiz")}
          </Button>
          <Button variant="ghost" onClick={onBack}>
            {t("english.backToWords")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="eng-quiz">
      <div className="eng-quiz__top">
        <button className="eng-quiz__back" onClick={onBack}>
          {t("english.backToWords")}
        </button>
        <span className="eng-quiz__progress">
          {i + 1}/{questions.length} · {t("english.score")} {score}
        </span>
      </div>
      <p className="eng-quiz__prompt">{t("english.practiceTitle")}</p>
      <div className="eng-quiz__word">
        {q.word.word}
        <button
          className="eng-quiz__speak"
          title={t("english.listen")}
          aria-label={t("english.listen")}
          onClick={() => speak(q.word.word)}
        >
          <Volume2 size={18} />
        </button>
      </div>
      <div className="eng-quiz__choices">
        {q.choices.map((c) => {
          const isCorrect = c === q.word.meaning;
          const state = picked
            ? isCorrect
              ? "correct"
              : c === picked
                ? "wrong"
                : ""
            : "";
          return (
            <button
              key={c}
              className={`eng-quiz__choice ${state ? `eng-quiz__choice--${state}` : ""}`}
              onClick={() => pick(c)}
              disabled={!!picked}
            >
              {c}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="eng-quiz__feedback">
          <span className={picked === q.word.meaning ? "eng-ok" : "eng-bad"}>
            {picked === q.word.meaning ? t("english.correct") : t("english.wrong")}
          </span>
          <Button size="sm" variant="primary" onClick={next}>
            {t("english.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ToolEnglish() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const values = useFeatureValues(ENGLISH_FEATURE_ID);
  const wordsPerDay = Math.min(10, Math.max(5, (values.wordsPerDay as number) ?? 6));
  const resetHour = (values.resetHour as number) ?? 3;
  const dayKey = learningDayKey(resetHour);

  const [salt, setSalt] = useState(0);
  const [view, setView] = useState<"list" | "quiz">("list");
  const words = useMemo(
    () => pickDaily(dayKey, wordsPerDay, salt),
    [dayKey, wordsPerDay, salt],
  );

  if (view === "quiz") {
    return <Quiz words={words} onBack={() => setView("list")} />;
  }

  return (
    <div className="eng">
      <div className="eng__head">
        <span className="eng__title">
          <BookOpenText size={16} /> {t("english.todayWords")}
        </span>
        <button
          className="eng__refresh"
          title={t("english.refresh")}
          onClick={() => setSalt((s) => s + 1)}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="eng__list">
        {words.map((w) => (
          <WordRow key={w.word} item={w} online={online} />
        ))}
      </div>

      <Button variant="primary" className="eng__practice" onClick={() => setView("quiz")}>
        <GraduationCap size={17} /> {t("english.practice")}
      </Button>
    </div>
  );
}

registerFeature({
  id: ENGLISH_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-english",
  icon: GraduationCap,
  defaultEnabled: false,
  settingsSchema: englishSettingsSchema,
  component: ToolEnglish,
  order: 8,
});

export { EnglishDailyAutoOpen, ENGLISH_FEATURE_ID };
export default ToolEnglish;
