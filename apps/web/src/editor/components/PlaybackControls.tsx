import type { ReactNode } from "react";

export function PlaybackControls({ children }: { children: ReactNode }) {
  return <div className="ce-playback-controls">{children}</div>;
}
