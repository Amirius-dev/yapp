import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import type { ReactNode } from "react";

export function TimelineTrack({
  label,
  color,
  hidden = false,
  locked = false,
  onToggleHidden,
  onToggleLocked,
  children,
}: {
  label: string;
  color?: string;
  hidden?: boolean;
  locked?: boolean;
  onToggleHidden?: () => void;
  onToggleLocked?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="ce-timeline-track"
      style={{ "--track-color": color } as React.CSSProperties}
    >
      <header>
        <i />
        <span>{label}</span>
        {onToggleHidden && (
          <button onClick={onToggleHidden}>
            {hidden ? <EyeOff /> : <Eye />}
          </button>
        )}
        {onToggleLocked && (
          <button onClick={onToggleLocked}>
            {locked ? <Lock /> : <Unlock />}
          </button>
        )}
      </header>
      <div>{children}</div>
    </div>
  );
}
