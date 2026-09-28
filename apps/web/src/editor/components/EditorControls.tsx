import { LoaderCircle } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type ControlSize = "small" | "medium";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const EditorButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ControlSize;
    loading?: boolean;
  }
>(function EditorButton(
  {
    variant = "secondary",
    size = "small",
    loading = false,
    className = "",
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`button ce-button ce-button--${variant} ce-control--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export function Tooltip({
  label,
  children,
  open = false,
}: {
  label: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <span
      className={`ce-tooltip ${open ? "is-open" : ""}`}
      data-tooltip={label}
    >
      {children}
    </span>
  );
}

export const EditorIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    size?: ControlSize;
    selected?: boolean;
    tooltipOpen?: boolean;
  }
>(function EditorIconButton(
  {
    label,
    size = "small",
    selected,
    tooltipOpen = false,
    className = "",
    children,
    ...props
  },
  ref,
) {
  return (
    <Tooltip label={label} open={tooltipOpen}>
      <button
        ref={ref}
        className={`ce-icon-control ce-control--${size} ${selected ? "is-selected" : ""} ${className}`}
        aria-label={label}
        aria-pressed={selected}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});

export function SegmentedControl({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ce-segmented" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function Tabs({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ce-tabs ${className}`} role="tablist" aria-label={label}>
      {children}
    </div>
  );
}

export function EditorInput({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`ce-field ${className}`}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function EditorSelect({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={`ce-field ${className}`}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function EditorCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ce-checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function EditorToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ce-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="ce-color-control">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`ce-badge ce-badge--${tone} ${className}`}>
      {children}
    </span>
  );
}

export function Divider() {
  return <hr className="ce-divider" />;
}

export function PanelHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="ce-ui-panel-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <strong>{title}</strong>
      </div>
      {meta && <div>{meta}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="ce-ui-section-header">
      <strong>{title}</strong>
      {action}
    </header>
  );
}

export function EditorEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ce-ui-empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

export function ContextMenu({ children }: { children: ReactNode }) {
  return (
    <div className="ce-context-menu ce-ui-context-menu" role="menu">
      {children}
    </div>
  );
}
