import { useCurrentFrame, useVideoConfig } from "remotion";

export function OpeningCaption({
  text,
  hidden,
}: {
  text: string;
  hidden: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (hidden || !text.trim() || frame >= fps * 3) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 245,
        textAlign: "center",
      }}
    >
      <span
        style={{
          color: "#ffd166",
          padding: "12px 24px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 800,
          fontSize: 68,
          lineHeight: 1.08,
          maxWidth: 920,
          margin: "0 auto",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
          textShadow:
            "-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, 0 6px 18px rgba(0,0,0,0.9)",
        }}
      >
        {text}
      </span>
    </div>
  );
}
