import type { CSSProperties, PointerEventHandler, ReactNode } from "react";

export function TimelineClip({
  selected,
  style,
  onClick,
  onTrimStart,
  onTrimEnd,
  children,
}: {
  selected?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  onTrimStart?: PointerEventHandler<HTMLSpanElement>;
  onTrimEnd?: PointerEventHandler<HTMLSpanElement>;
  children: ReactNode;
}) {
  return (
    <button
      className={`ce-timeline-clip ${selected ? "is-selected" : ""}`}
      style={style}
      onClick={onClick}
    >
      {onTrimStart && (
        <span className="ce-trim-handle is-start" onPointerDown={onTrimStart} />
      )}
      {children}
      {onTrimEnd && (
        <span className="ce-trim-handle is-end" onPointerDown={onTrimEnd} />
      )}
    </button>
  );
}
