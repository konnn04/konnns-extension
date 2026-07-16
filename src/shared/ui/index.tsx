import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import "./ui.css";

/**
 * Shared UI kit — the single reusable component set for the whole project.
 * All colors/spacing/motion come from design tokens; no feature builds its own
 * buttons/inputs/modals (docs/00 §2.4 "Themeable từ gốc").
 */

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "subtle" | "ghost" | "danger";

export function Button({
  variant = "subtle",
  size,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm";
}) {
  const cls = ["ui-btn", `ui-btn--${variant}`, size === "sm" && "ui-btn--sm", className]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={cls} {...rest} />;
}

/* ---------- ReloadButton (force refresh, bypasses cache) ---------- */
export function ReloadButton({
  onClick,
  busy,
  label,
  className = "",
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ui-reload ${busy ? "ui-reload--spin" : ""} ${className}`}
      aria-label={label ?? "Reload"}
      title={label ?? "Reload"}
      onClick={onClick}
    >
      <RefreshCw size={14} />
    </button>
  );
}

/* ---------- IconButton ---------- */
export function IconButton({
  label,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={`ui-iconbtn ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    />
  );
}

/* ---------- Toggle ---------- */
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="ui-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="ui-toggle__thumb" />
    </button>
  );
}

/* ---------- TextInput ---------- */
export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`ui-input ${className}`} {...rest} />;
});

/* ---------- Select / Combobox (styled, portal-based) ---------- */
export { Select, Combobox, type Option } from "./Select";

/* ---------- Slider ---------- */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <input
      type="range"
      className="ui-slider"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* ---------- Segmented ---------- */
export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="ui-segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`ui-segmented__item ${o.value === value ? "ui-segmented__item--active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Field (label + control + description/error) ---------- */
export function Field({
  label,
  description,
  error,
  inline = false,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  /** inline = label left, control right (toggles/selects) */
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-field">
      {inline ? (
        <div className="ui-field__row">
          <span className="ui-field__label">{label}</span>
          {children}
        </div>
      ) : (
        <>
          <span className="ui-field__label">{label}</span>
          {children}
        </>
      )}
      {description && <span className="ui-field__desc">{description}</span>}
      {error && <span className="ui-field__error">{error}</span>}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({
  elevated,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  const cls = ["ui-card", elevated && "ui-card--elevated", className].filter(Boolean).join(" ");
  return <div className={cls} {...rest} />;
}

/* ---------- Skeleton ---------- */
export function Skeleton({
  width,
  height,
  radius,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  radius?: string;
  className?: string;
}) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  width,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number | string;
  children: React.ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="ui-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="ui-modal"
            style={{ width }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {title && (
              <div className="ui-modal__header">
                <span className="ui-modal__title">{title}</span>
                <IconButton label="Close" onClick={onClose}>
                  <X size={18} />
                </IconButton>
              </div>
            )}
            <div className="ui-modal__body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
