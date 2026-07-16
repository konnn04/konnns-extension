import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./rail-scroll.css";

/**
 * Wraps a vertical dock's triggers. When there are more than `max` items the
 * list becomes a fixed-height viewport paged by ▲/▼ buttons (no scroll wheel,
 * per request) so long docks never run off the top/bottom of the screen.
 * Below the threshold the children render as-is so short docks look untouched.
 */
export function RailScroll({
  count,
  max = 10,
  children,
}: {
  count: number;
  max?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanUp(el.scrollTop > 1);
    setCanDown(el.scrollTop < el.scrollHeight - el.clientHeight - 1);
  }, []);

  useEffect(() => {
    update();
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [update, count]);

  if (count <= max) return <>{children}</>;

  const page = (dir: -1 | 1) =>
    ref.current?.scrollBy({ top: dir * 168, behavior: "smooth" });

  return (
    <>
      <button
        type="button"
        className={`rail-arrow ${canUp ? "rail-arrow--on" : ""}`}
        onClick={() => page(-1)}
        tabIndex={canUp ? 0 : -1}
        aria-label="Scroll up"
      >
        <ChevronUp size={16} />
      </button>
      <div className="rail-scroll" ref={ref} onScroll={update}>
        {children}
      </div>
      <button
        type="button"
        className={`rail-arrow ${canDown ? "rail-arrow--on" : ""}`}
        onClick={() => page(1)}
        tabIndex={canDown ? 0 : -1}
        aria-label="Scroll down"
      >
        <ChevronDown size={16} />
      </button>
    </>
  );
}
