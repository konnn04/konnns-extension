import { useEffect, useState } from "react";
import { Slider } from "@/shared/ui";

/**
 * A slider that shows its value while you drag and only WRITES on release.
 *
 * Two problems this exists to solve.
 *
 * The first was a real bug: the wrapper that listened for the end of a drag
 * used to be a component declared inside a render body. React treats a
 * function defined during render as a brand-new component type every time, so
 * each step of the drag unmounted the subtree and mounted a fresh one — which
 * destroyed the `<input type="range">` mid-gesture and threw away its pointer
 * capture. The slider could be clicked but never dragged.
 *
 * The second is weight. Writing to the store on every pointer move pushed a
 * new project object through zustand sixty times a second, re-rendering the
 * panel and forcing a full waveform repaint each time. The draft lives here
 * instead, and exactly one commit lands when the pointer comes up.
 */
export function ValueSlider({
  value,
  onCommit,
  min,
  max,
  step = 1,
}: {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const [draft, setDraft] = useState<number | null>(null);

  /**
   * The release can land anywhere: a range input captures the pointer, so
   * letting go with the cursor outside this element still ends the drag. A
   * window listener is the only way to hear about that reliably.
   */
  useEffect(() => {
    if (draft === null) return;
    /**
     * `draft` is read from the closure, not from a setState updater. Calling
     * onCommit inside an updater looks tidy but is a side effect in a function
     * React may run more than once or discard — and it silently never fired.
     * The effect re-runs on every draft change, so this closure is current.
     */
    const settle = () => {
      setDraft(null);
      if (draft !== value) onCommit(draft);
    };
    window.addEventListener("pointerup", settle);
    window.addEventListener("pointercancel", settle);
    window.addEventListener("keyup", settle);
    return () => {
      window.removeEventListener("pointerup", settle);
      window.removeEventListener("pointercancel", settle);
      window.removeEventListener("keyup", settle);
    };
  }, [draft, value, onCommit]);

  return <Slider value={draft ?? value} onChange={setDraft} min={min} max={max} step={step} />;
}
