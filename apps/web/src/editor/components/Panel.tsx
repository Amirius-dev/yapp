import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  actions,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`ce-panel ${className}`}>
      {(title || actions) && (
        <header className="ce-panel__header">
          <div>
            {title && <strong>{title}</strong>}
            {description && <span>{description}</span>}
          </div>
          {actions && <div className="ce-panel__actions">{actions}</div>}
        </header>
      )}
      <div className="ce-panel__body">{children}</div>
    </section>
  );
}
