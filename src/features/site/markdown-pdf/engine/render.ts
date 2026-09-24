import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

/**
 * The one render function used by BOTH `PreviewPane` (screen) and
 * `PrintLayer` (the hidden container `window.print()` sees) — docs/roadmap/02
 * §5, "hai lần render khác cấu hình sanitize là lỗi dễ xảy ra". A single
 * shared function makes that class of bug structurally impossible instead of
 * a discipline to remember.
 */
const md = new MarkdownIt({
  html: false, // raw HTML in the SOURCE is rejected outright, not sanitized-then-kept — simplest safe default
  linkify: true,
  breaks: false,
  typographer: true,
});

/**
 * DOMPurify is the second line of defense (CSP's `script-src 'self'` already
 * blocks `<script>`/`on*` execution) against real risks in a markdown preview:
 * tracking pixels (`<img src="https://…">` some untrusted .md was shared to
 * you), stray `<iframe>`/`<object>` if `html` is ever turned on later, and
 * layout-breaking attributes. `class` must survive on `<code>` — markdown-it
 * emits `<code class="language-js">` for fenced code blocks, and the default
 * DOMPurify allowlist already keeps `class`, but it is named explicitly here
 * so this stays true even if DOMPurify's own defaults change.
 */
export function renderMarkdown(source: string): string {
  const html = md.render(source);
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["class", "target", "rel"],
  });
}
