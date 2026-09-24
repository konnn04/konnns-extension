import { forwardRef, useImperativeHandle, useRef } from "react";

export interface PreviewPaneHandle {
  scrollTo: (ratio: number) => void;
}

/**
 * Renders already-sanitized HTML (from `engine/render.ts` — never re-render
 * here with different settings, see that file's own comment) and reports its
 * own scroll position so `MarkdownEditor` can drive `SourcePane` to match.
 */
export const PreviewPane = forwardRef<PreviewPaneHandle, { html: string; onScroll: (ratio: number) => void }>(
  function PreviewPane({ html, onScroll }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      scrollTo(ratio: number) {
        const el = hostRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = max * ratio;
      },
    }));

    return (
      <div
        className="mdp__preview"
        ref={hostRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const max = el.scrollHeight - el.clientHeight;
          onScroll(max > 0 ? el.scrollTop / max : 0);
        }}
        // `html` is already DOMPurify-sanitized in engine/render.ts, the one place this string is produced
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);
