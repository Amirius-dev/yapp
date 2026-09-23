import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export function VideoLayers({ videoFileName }: { videoFileName: string }) {
  const src = staticFile(videoFileName);
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090f" }}>
      <OffthreadVideo
        src={src}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(42px)",
          transform: "scale(1.12)",
          opacity: 0.72,
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.28)" }} />
      <OffthreadVideo
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.52) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}
