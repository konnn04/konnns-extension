import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Custom Select + Combobox — replaces the native <select> so options are fully
 * themeable (native option lists can't be styled cross-browser). Combobox adds
 * search + multi-select for future feature lists (docs request).
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** render the label in this font-family (used by the font picker preview) */
  font?: string;
}

/** Fixed-position dropdown anchored under a trigger element. */
function Dropdown({
  anchor,
  onClose,
  children,
  width,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < menuH + 12 && r.top > spaceBelow;
      setStyle({
        position: "fixed",
        left: r.left,
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
        width: width ?? r.width,
        visibility: "visible",
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  return createPortal(
    <div ref={menuRef} className="ui-select-menu" style={style} role="listbox">
      {children}
    </div>,
    document.body,
  );
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = options.findIndex((o) => o.value === value);
      const next = e.key === "ArrowDown" ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1);
      onChange(options[next]?.value ?? value);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="ui-select-trigger__value">
          {selected?.icon}
          <span
            className={selected ? "" : "ui-select-trigger__placeholder"}
            style={selected?.font ? { fontFamily: selected.font } : undefined}
          >
            {selected?.label ?? placeholder ?? ""}
          </span>
        </span>
        <ChevronDown size={16} className="ui-select-trigger__chevron" data-open={open} />
      </button>
      {open && (
        <Dropdown anchor={triggerRef.current} onClose={() => setOpen(false)}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`ui-select-option ${o.value === value ? "ui-select-option--active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.icon}
              <span
                className="ui-select-option__label"
                style={o.font ? { fontFamily: o.font, fontSize: 16 } : undefined}
              >
                {o.label}
              </span>
              {o.value === value && <Check size={15} className="ui-select-option__check" />}
            </button>
          ))}
        </Dropdown>
      )}
    </>
  );
}

/**
 * Combobox / "Select2" — searchable dropdown supporting single or multiple
 * selection (checkboxes + chips). Kept generic for future feature toggles.
 */
export function Combobox<T extends string = string>({
  value,
  onChange,
  options,
  multiple = false,
  placeholder,
  searchPlaceholder,
  className = "",
}: {
  value: T[];
  onChange: (value: T[]) => void;
  options: Array<Option<T>>;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  const selectedOptions = options.filter((o) => value.includes(o.value));

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const toggle = (v: T) => {
    if (multiple) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    } else {
      onChange([v]);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ui-select-trigger__value ui-combobox__chips">
          {selectedOptions.length === 0 && (
            <span className="ui-select-trigger__placeholder">{placeholder ?? ""}</span>
          )}
          {multiple
            ? selectedOptions.map((o) => (
                <span key={o.value} className="ui-combobox__chip">
                  {o.icon}
                  {o.label}
                  <X
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o.value);
                    }}
                  />
                </span>
              ))
            : selectedOptions[0] && (
                <span className="ui-select-trigger__value">
                  {selectedOptions[0].icon}
                  {selectedOptions[0].label}
                </span>
              )}
        </span>
        <ChevronDown size={16} className="ui-select-trigger__chevron" data-open={open} />
      </button>
      {open && (
        <Dropdown anchor={triggerRef.current} onClose={() => setOpen(false)}>
          <div className="ui-combobox__search">
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? "..."}
            />
          </div>
          <div className="ui-combobox__list">
            {filtered.length === 0 && <div className="ui-combobox__empty">—</div>}
            {filtered.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className={`ui-select-option ${checked ? "ui-select-option--active" : ""}`}
                  onClick={() => toggle(o.value)}
                >
                  {multiple && (
                    <span className={`ui-combobox__check ${checked ? "ui-combobox__check--on" : ""}`}>
                      {checked && <Check size={12} />}
                    </span>
                  )}
                  {o.icon}
                  <span className="ui-select-option__label">{o.label}</span>
                  {!multiple && checked && <Check size={15} className="ui-select-option__check" />}
                </button>
              );
            })}
          </div>
        </Dropdown>
      )}
    </>
  );
}
