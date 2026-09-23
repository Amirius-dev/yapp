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
        top: 190,
        textAlign: "center",
      }}
    >
      <span
        style={{
          color: "white",
          backgroundColor: "rgba(0,0,0,0.76)",
          borderRadius: 22,
          padding: "18px 26px",
          fontFamily: "Arial, sans-serif",
          fontWeight: 800,
          fontSize: 64,
          lineHeight: 1.12,
          textShadow: "0 3px 14px rgba(0,0,0,0.9)",
        }}
      >
        {text}
      </span>
    </div>
  );
}
