import { isOnline } from "@/core/net";

/** Daily inspirational quote (quotable.io, keyless). Cached one-per-day. */

export interface Quote {
  text: string;
  author: string;
}

const FALLBACKS: Quote[] = [
  { text: "Việc khó nhất là bắt đầu. Cứ bắt đầu đi.", author: "" },
  { text: "Hôm nay là một ngày mới — hãy tận dụng nó.", author: "" },
  { text: "Small steps every day.", author: "" },
  { text: "Kỷ luật là cầu nối giữa mục tiêu và thành quả.", author: "Jim Rohn" },
];

const KEY = "newtab.dailyQuote";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyQuote(): Promise<Quote> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { date: string; quote: Quote };
      if (cached.date === todayStr()) return cached.quote;
    }
  } catch {
    /* ignore */
  }

  let quote: Quote | null = null;
  if (isOnline()) {
    try {
      const res = await fetch("https://api.quotable.io/random?maxLength=140");
      if (res.ok) {
        const json = await res.json();
        if (json?.content) quote = { text: json.content, author: json.author ?? "" };
      }
    } catch {
      /* fall through to fallback */
    }
  }
  if (!quote) quote = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];

  try {
    localStorage.setItem(KEY, JSON.stringify({ date: todayStr(), quote }));
  } catch {
    /* ignore */
  }
  return quote;
}

/** Time-of-day greeting key for i18n. */
export function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return "dailyQuote.night";
  if (h < 12) return "dailyQuote.morning";
  if (h < 18) return "dailyQuote.afternoon";
  return "dailyQuote.evening";
}
