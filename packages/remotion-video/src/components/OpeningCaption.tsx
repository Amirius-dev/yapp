import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OpeningCaptionSettings } from "@studio/contracts";

function colorWithOpacity(hex: string, opacity: number) {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
}

export function OpeningCaption({
  settings,
}: {
  settings: OpeningCaptionSettings;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (
    !settings.enabled ||
    !settings.text.trim() ||
    frame >= fps * settings.durationSeconds
  )
    return null;
  const progress = Math.min(1, frame / Math.max(1, fps * 0.22));
  const remaining = settings.durationSeconds - frame / fps;
  const exit = Math.min(1, Math.max(0, remaining / 0.22));
  const opacity = settings.animation === "none" ? 1 : Math.min(progress, exit);
  const entranceScale =
    settings.animation === "pop" ? 0.84 + progress * 0.16 : 1;
  const translateY = settings.animation === "slide" ? (1 - progress) * 28 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: `${settings.x}%`,
        top: `${settings.y}%`,
        width: "82%",
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${settings.scale * entranceScale})`,
        textAlign: "center",
        opacity,
      }}
    >
      <span
        style={{
          color: settings.color,
          padding: "12px 24px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
          fontSize: 68,
          lineHeight: 1.08,
          maxWidth: 920,
          margin: "0 auto",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
          borderRadius: 18,
          backgroundColor: colorWithOpacity(
            settings.backgroundColor,
            settings.backgroundOpacity,
          ),
          textShadow: "0 6px 18px rgba(0,0,0,0.72)",
        }}
      >
        {settings.text}
      </span>
    </div>
  );
}
