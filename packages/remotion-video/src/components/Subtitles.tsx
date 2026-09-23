import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleCue } from "../schema";

export function Subtitles({
  cues,
  hiddenUntil = 0,
}: {
  cues: SubtitleCue[];
  hiddenUntil?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const cue =
    time < hiddenUntil
      ? undefined
      : cues.find(
          (item) => time >= item.startSeconds && time < item.endSeconds,
        );
  if (!cue) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 250,
        display: "flex",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span
        style={{
          color: "white",
          backgroundColor: "rgba(0,0,0,0.72)",
          borderRadius: 24,
          padding: "18px 28px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontSize: 58,
          lineHeight: 1.15,
          maxWidth: 930,
          textShadow: "0 3px 12px rgba(0,0,0,0.9)",
        }}
      >
        {cue.text}
      </span>
    </div>
  );
}
