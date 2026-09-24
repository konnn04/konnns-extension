import { browser } from "wxt/browser";
import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import type { OcrLanguage } from "./types";

/**
 * OCR — docs/roadmap/01-pdf-to-text.md §5, "tesseract.js kéo theo WASM + gói
 * ngôn ngữ nặng, phải tự host và tải lười". Every asset tesseract.js touches
 * (`workerPath`, `corePath`, `langPath`) is pinned to `browser.runtime.getURL`
 * paths under `public/tesseract-assets/` — never the jsdelivr CDN it falls
 * back to when these are left unset. `workerBlobURL: false` matters just as
 * much as the paths themselves: left at its default (true), tesseract.js
 * fetches `workerPath` and re-launches it from a `blob:` URL, and this
 * extension's CSP (`script-src 'self' 'wasm-unsafe-eval'`) does not list
 * `blob:` — `false` makes it `new Worker(workerPath)` directly instead, a
 * same-origin `chrome-extension://…` script the CSP already allows.
 *
 * Only the LSTM engine build is self-hosted (tesseract.js 5+ dropped the
 * legacy OEM anyway), and only `eng`/`vie` language data is vendored — see
 * docs/site/03-pdf-to-text.md.
 */

function assetUrl(path: string): string {
  try {
    return browser.runtime.getURL(path as never);
  } catch {
    return `/${path}`;
  }
}

let cached: { lang: OcrLanguage; worker: Promise<TesseractWorker> } | null = null;
/** tesseract.js only accepts a `logger` at worker creation, not per call — one worker is reused across every page in a session, so progress is routed through this mutable slot instead. */
let currentProgressHandler: ((progress: number) => void) | null = null;

function getWorker(lang: OcrLanguage): Promise<TesseractWorker> {
  if (cached && cached.lang === lang) return cached.worker;
  if (cached) void cached.worker.then((w) => w.terminate());

  const worker = createWorker(lang, 1, {
    workerPath: assetUrl("tesseract-assets/worker.min.js"),
    corePath: assetUrl("tesseract-assets/core/"),
    langPath: assetUrl("tesseract-assets/lang/"),
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text" && currentProgressHandler) currentProgressHandler(m.progress);
    },
  });
  cached = { lang, worker };
  return worker;
}

export async function ocrImage(
  image: HTMLCanvasElement,
  lang: OcrLanguage,
  onProgress?: (progress: number) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(lang);
  currentProgressHandler = onProgress ?? null;
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text.trim(), confidence: data.confidence };
  } finally {
    currentProgressHandler = null;
  }
}

/** Release the cached worker — called when the tool unmounts, so a closed tab does not leave a worker running. */
export async function disposeOcrWorker(): Promise<void> {
  if (!cached) return;
  const w = await cached.worker;
  cached = null;
  await w.terminate();
}
