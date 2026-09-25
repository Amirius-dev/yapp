import {
  outputToSourceTime,
  interpolateCrop,
} from "@studio/contracts/timeline";
import {
  imageFilterCss,
  imageTransformCss,
  type ImageAdjustments,
} from "@studio/contracts";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export function VideoLayers({
  videoFileName,
  cropMode,
  cropX,
  cropY,
  zoom,
  ranges,
  cropKeyframes,
  image,
}: {
  videoFileName: string;
  cropMode: "fill" | "fit";
  cropX: number;
  cropY: number;
  zoom: number;
  ranges: Array<{ id: string; start: number; end: number }>;
  cropKeyframes: Array<{
    rangeId: string;
    sourceTimeSeconds: number;
    cropX: number;
    cropY: number;
    zoom: number;
    easing: "linear" | "ease-in-out" | "hold";
  }>;
  image: ImageAdjustments;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mapped = outputToSourceTime(ranges, frame / fps);
  const crop = mapped
    ? interpolateCrop(cropKeyframes, mapped.rangeId, mapped.sourceTime, {
        cropX,
        cropY,
        zoom,
      })
    : { cropX, cropY, zoom };
  const src = staticFile(videoFileName);
  const position = `${crop.cropX}% ${crop.cropY}%`;
  const filter = imageFilterCss(image);
  const transform = imageTransformCss(image, crop.zoom);
  const vignette = Math.max(0, Math.min(1, image.vignette / 100));
  const effects = (
    <>
      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle, transparent 42%, rgba(0,0,0,${(
              vignette * 0.72
            ).toFixed(3)}) 100%)`,
          }}
        />
      )}
    </>
  );
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
            transform,
            filter,
          }}
        />
        {effects}
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
          filter: `blur(${image.backgroundBlur}px) saturate(${image.backgroundSaturation}) brightness(${1 - image.backgroundDim})`,
          transform: "scale(1.12)",
          objectPosition: position,
        }}
      />
      <OffthreadVideo
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: position,
          transform,
          filter,
        }}
      />
      {effects}
    </AbsoluteFill>
  );
}
