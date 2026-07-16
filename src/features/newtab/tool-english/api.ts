import { VOCAB, type VocabWord } from "./words";

/**
 * Daily word selection + example lookup for "English every day".
 * Selection is deterministic per learning-day (so the set is stable through the
 * day and changes when the day rolls over at the reset hour). Examples come from
 * the free Dictionary API (keyless, CORS-enabled) on demand.
 */

/** Key identifying the current learning day, rolling over at `resetHour`. */
export function learningDayKey(resetHour: number): string {
  const shifted = new Date(Date.now() - resetHour * 3_600_000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic daily pick of `count` words (salt reshuffles the same day). */
export function pickDaily(dayKey: string, count: number, salt = 0): VocabWord[] {
  const rand = mulberry32(hashSeed(dayKey) + salt * 2654435761);
  const idx = VOCAB.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(count, VOCAB.length)).map((i) => VOCAB[i]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a multiple-choice question: correct meaning + 3 random distractors. */
export function quizChoices(word: VocabWord): string[] {
  const others = shuffle(VOCAB.filter((w) => w.word !== word.word).map((w) => w.meaning));
  return shuffle([word.meaning, ...others.slice(0, 3)]);
}

export interface WordDetail {
  phonetic?: string;
  definitions: string[];
  examples: string[];
}

interface DictEntry {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: { definitions?: { definition?: string; example?: string }[] }[];
}

/** Fetch definitions + example sentences from the free Dictionary API. */
export async function getWordDetail(word: string): Promise<WordDetail> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  if (!res.ok) throw new Error("detail-failed");
  const data = (await res.json()) as DictEntry[];
  const entry = Array.isArray(data) ? data[0] : undefined;
  if (!entry) throw new Error("detail-failed");

  const definitions: string[] = [];
  const examples: string[] = [];
  for (const m of entry.meanings ?? []) {
    for (const d of m.definitions ?? []) {
      if (d.definition && definitions.length < 3) definitions.push(d.definition);
      if (d.example && examples.length < 3) examples.push(d.example);
    }
  }
  const phonetic = entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text;
  return { phonetic, definitions, examples };
}
