import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export function VideoLayers({
  videoFileName,
  cropMode,
  cropX,
  cropY,
  zoom,
}: {
  videoFileName: string;
  cropMode: "fill" | "fit";
  cropX: number;
  cropY: number;
  zoom: number;
}) {
  const src = staticFile(videoFileName);
  const position = `${cropX}% ${cropY}%`;
  if (cropMode === "fill") {
    return (
      <AbsoluteFill style={{ backgroundColor: "#07090f", overflow: "hidden" }}>
        <OffthreadVideo
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: position,
            transform: `scale(${zoom})`,
          }}
        />
        <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.18)" }} />
      </AbsoluteFill>
    );
  }
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
          objectPosition: position,
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.28)" }} />
      <OffthreadVideo
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: position,
          transform: `scale(${zoom})`,
        }}
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
