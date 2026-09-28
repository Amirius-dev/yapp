import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Inspector({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="timeline-tools ce-inspector">
      <header className="ce-inspector__header">
        <span>Инспектор</span>
        <strong>{title}</strong>
      </header>
      <div className="ce-inspector__scroll">
        <InspectorSection title="Параметры">{children}</InspectorSection>
      </div>
    </aside>
  );
}

export function InspectorSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ce-inspector-section ${open ? "is-open" : ""}`}>
      <button onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <ChevronDown />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
