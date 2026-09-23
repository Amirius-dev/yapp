import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleCue } from "../schema";

export const SUBTITLE_LAYOUT = {
  topPercent: 72,
  maxWidth: 918,
  horizontalInset: 81,
  fontSize: 64,
  lineHeight: 1.08,
} as const;

export function Subtitles({
  cues,
  hiddenUntil = 0,
  x,
  y,
  scale,
  align,
}: {
  cues: SubtitleCue[];
  hiddenUntil?: number;
  x: number;
  y: number;
  scale: number;
  align: "left" | "center" | "right";
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
  const position = {
    x: Math.min(85, Math.max(15, x)),
    y: Math.min(84, Math.max(18, y)),
  };
  const widthPercent =
    Math.min(85, 2 * Math.min(position.x - 5, 95 - position.x)) / scale;
  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${widthPercent}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        display: "flex",
        justifyContent:
          align === "left"
            ? "flex-start"
            : align === "right"
              ? "flex-end"
              : "center",
        textAlign: align,
      }}
    >
      <span
        style={{
          color: "white",
          padding: "10px 20px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
          fontSize: SUBTITLE_LAYOUT.fontSize,
          lineHeight: SUBTITLE_LAYOUT.lineHeight,
          maxWidth: SUBTITLE_LAYOUT.maxWidth,
          overflowWrap: "anywhere",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textShadow:
            "-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, 0 6px 16px rgba(0,0,0,0.9)",
        }}
      >
        {cue.text}
      </span>
    </div>
  );
}
