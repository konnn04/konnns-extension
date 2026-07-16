/**
 * Translation via MyMemory (https://mymemory.translated.net/doc/spec.php).
 * Keyless and returns `Access-Control-Allow-Origin: *`, so the NewTab page can
 * fetch it directly without any host permission. Anonymous quota is generous
 * enough for a personal tool.
 */

let decoder: HTMLTextAreaElement | null = null;
function decodeEntities(s: string): string {
  // MyMemory occasionally returns HTML entities (e.g. &#39;) — decode them.
  if (!s.includes("&")) return s;
  decoder ??= document.createElement("textarea");
  decoder.innerHTML = s;
  return decoder.value;
}

export async function translate(text: string, from: string, to: string): Promise<string> {
  const q = text.trim();
  if (!q) return "";
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}` +
    `&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate-failed");
  const json = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
  };
  const out = json.responseData?.translatedText;
  const status = Number(json.responseStatus);
  if (typeof out !== "string" || (status && status >= 400)) throw new Error("translate-failed");
  return decodeEntities(out);
}
