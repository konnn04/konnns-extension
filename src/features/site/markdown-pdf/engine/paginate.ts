/**
 * Splitting rendered content across pages — docs/site/02-markdown-pdf.md.
 *
 * Why do this by hand at all, when the browser paginates automatically?
 * Because Chrome supports neither `@page` margin boxes nor `counter(page)`
 * in generated content, so there is no CSS-only way to print "page 3 of 7".
 * Laying the content into real page-sized containers ourselves is what makes
 * a per-page footer possible — and it also makes page breaks predictable
 * instead of wherever the flow happens to land.
 *
 * Pure: takes measured heights, returns which blocks go on which page.
 */

/** Indices into the block list, grouped per page. */
export type PageAssignment = number[][];

export function paginateBlocks(heights: number[], pageHeight: number): PageAssignment {
  if (heights.length === 0) return [];
  if (pageHeight <= 0) return [heights.map((_, i) => i)];

  const pages: PageAssignment = [];
  let current: number[] = [];
  let used = 0;

  heights.forEach((height, index) => {
    // A block taller than a whole page cannot be made to fit by moving it —
    // give it a page of its own and let it overflow, rather than pushing an
    // endless run of empty pages ahead of it.
    if (height > pageHeight) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        used = 0;
      }
      pages.push([index]);
      return;
    }

    if (used + height > pageHeight && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }

    current.push(index);
    used += height;
  });

  if (current.length > 0) pages.push(current);
  return pages;
}
