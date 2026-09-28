import type { ReactNode } from "react";

export function Timeline({ children }: { children: ReactNode }) {
  return (
    <section className="template-panel editor-timeline-panel ce-timeline">
      {children}
    </section>
  );
}
