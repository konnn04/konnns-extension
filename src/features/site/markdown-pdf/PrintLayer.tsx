import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { paginateBlocks } from "./engine/paginate";
import { contentBoxPx, pageRuleCss, type PrintSettings } from "./engine/paper";

/**
 * What `window.print()` actually prints — docs/site/02-markdown-pdf.md.
 *
 * Two problems with the naive version this replaces:
 *
 * 1. It lived inside the app's own DOM, so the printed sheet carried the
 *    site shell with it (sidebar, header). Hiding the editor's own parts was
 *    not enough — the shell is a different component entirely. It now
 *    renders through a PORTAL as a direct child of `<body>`, which lets the
 *    print CSS hide every other top-level child by structure rather than by
 *    guessing at class names.
 *
 * 2. It let the browser flow the content, which meant no page numbers:
 *    Chrome supports neither `@page` margin boxes nor `counter(page)` in
 *    generated content. Content is measured and laid into real page-sized
 *    containers here instead, so each page is a box we own and can put a
 *    footer in.
 */
export function PrintLayer({
  title,
  html,
  settings,
  /** bumping this re-measures — pagination has to be redone when the paper changes */
  revision,
}: {
  title: string;
  html: string;
  settings: PrintSettings;
  revision: number;
}) {
  const { t } = useTranslation();
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[][] | null>(null);

  const box = useMemo(() => contentBoxPx(settings), [settings]);

  // Measure off-screen at the real page width, then decide where the breaks
  // go. `visibility: hidden` rather than `display: none` — a display:none
  // subtree has no layout, so every height would come back 0.
  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;

    const blocks = [...host.children] as HTMLElement[];
    if (blocks.length === 0) {
      setPages([]);
      return;
    }

    const heights = blocks.map((el) => {
      const style = getComputedStyle(el);
      return el.offsetHeight + parseFloat(style.marginTop || "0") + parseFloat(style.marginBottom || "0");
    });

    const assignment = paginateBlocks(heights, box.height);
    setPages(assignment.map((indices) => indices.map((i) => blocks[i].outerHTML)));
  }, [html, box.height, revision]);

  const layer = (
    <div className="mdp-print-root">
      <style>{pageRuleCss(settings)}</style>

      {/* the measuring copy: laid out at the exact printable width so the
          heights match what the real pages will get, but never printed */}
      <div
        className="mdp-print-measure"
        ref={measureRef}
        style={{ width: box.width }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {(pages ?? []).map((blocksHtml, index) => (
        <section className="mdp-print-page" key={index} style={{ width: box.width, height: box.height }}>
          {index === 0 && <h1 className="mdp-print-title">{title}</h1>}
          <div className="mdp-print-body" dangerouslySetInnerHTML={{ __html: blocksHtml.join("") }} />
          {settings.pageNumbers && (
            <footer className="mdp-print-footer">
              {t("markdownPdf.pageOf", { page: index + 1, total: pages?.length ?? 1 })}
            </footer>
          )}
        </section>
      ))}
    </div>
  );

  return createPortal(layer, document.body);
}
