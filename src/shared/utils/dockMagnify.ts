/**
 * macOS-dock style proximity magnification for the sidebar trigger rails.
 * Sets a `--dock-scale` CSS var on each trigger based on distance to the
 * pointer (CSS transform only — light on the GPU).
 */
export function magnify(rail: HTMLElement, selector: string, pointer: number): void {
  rail.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    const r = node.getBoundingClientRect();
    const center = r.top + r.height / 2;
    const dist = Math.abs(pointer - center);
    const scale = Math.max(1, 1.45 - dist / 70);
    node.style.setProperty("--dock-scale", scale.toFixed(3));
  });
}

export function clearMagnify(rail: HTMLElement, selector: string): void {
  rail.querySelectorAll<HTMLElement>(selector).forEach((n) => n.style.removeProperty("--dock-scale"));
}
