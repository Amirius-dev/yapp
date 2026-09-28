import {
  evaluateImageOverlay,
  evaluateMask,
  type EditorMask,
  type ImageOverlay,
  type TimelineRange,
} from "@studio/contracts";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export function EffectsLayers({
  ranges,
  masks,
  imageOverlays,
  imageAssets,
}: {
  ranges: TimelineRange[];
  masks: EditorMask[];
  imageOverlays: ImageOverlay[];
  imageAssets: Array<{ id: string; fileName: string }>;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const visibleMasks = masks
    .map((mask) => evaluateMask(mask, ranges, time))
    .filter((mask) => mask !== null)
    .sort((a, b) => a.layerOrder - b.layerOrder);
  const visibleOverlays = imageOverlays
    .map((overlay) => evaluateImageOverlay(overlay, ranges, time))
    .filter((overlay) => overlay !== null)
    .sort((a, b) => a.layerOrder - b.layerOrder);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {visibleMasks.map((mask) => (
        <div
          key={mask.id}
          style={{
            position: "absolute",
            zIndex: 10 + mask.layerOrder,
            left: `${mask.x}%`,
            top: `${mask.y}%`,
            width: `${mask.width}%`,
            height: `${mask.height}%`,
            opacity: mask.opacity,
            transform: `translate(-50%, -50%) rotate(${mask.rotation}deg)`,
            borderRadius:
              mask.shape === "ellipse"
                ? "50%"
                : mask.shape === "rounded-rectangle"
                  ? "18%"
                  : 2,
            backgroundColor:
              mask.type === "solid" ? mask.fillColor : "transparent",
            backdropFilter:
              mask.type === "blur"
                ? `blur(${Math.max(1, mask.intensity / 4)}px)`
                : mask.type === "pixelate"
                  ? `blur(${Math.max(1, mask.intensity / 18)}px) contrast(1.8)`
                  : undefined,
            boxShadow:
              mask.feather > 0
                ? `0 0 ${mask.feather / 2}px ${mask.feather / 5}px ${mask.fillColor}55`
                : undefined,
          }}
        />
      ))}
      {visibleOverlays.map((overlay) => {
        const asset = imageAssets.find((item) => item.id === overlay.assetId);
        if (!asset) return null;
        const progress = Math.min(
          1,
          Math.max(0, (time - overlay.startSeconds) / 0.35),
        );
        const scale =
          overlay.animation === "pop" || overlay.animation === "zoom"
            ? overlay.scale * (0.75 + progress * 0.25)
            : overlay.scale;
        const x =
          overlay.animation === "slide"
            ? overlay.x - (1 - progress) * 12
            : overlay.x;
        return (
          <Img
            key={overlay.id}
            src={staticFile(asset.fileName)}
            style={{
              position: "absolute",
              zIndex: 100 + overlay.layerOrder,
              left: `${x}%`,
              top: `${overlay.y}%`,
              width: `${overlay.width}%`,
              height: `${overlay.height}%`,
              objectFit: "contain",
              opacity:
                overlay.animation === "fade"
                  ? overlay.opacity * progress
                  : overlay.opacity,
              transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${scale})`,
              borderRadius: `${overlay.borderRadius}%`,
              boxShadow: overlay.shadow
                ? "0 28px 70px rgba(0,0,0,.34)"
                : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
