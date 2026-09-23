import { AbsoluteFill } from "remotion";
import type { VerticalClipProps } from "./schema";
import { OpeningCaption } from "./components/OpeningCaption";
import { Subtitles } from "./components/Subtitles";
import { VideoLayers } from "./components/VideoLayers";

function normalized(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function VerticalClip(props: VerticalClipProps) {
  const hideOpening = Boolean(
    props.cues[0] &&
    normalized(props.cues[0].text) === normalized(props.openingCaption),
  );
  return (
    <AbsoluteFill>
      <VideoLayers
        videoFileName={props.videoFileName}
        cropMode={props.cropMode}
        cropX={props.cropX}
        cropY={props.cropY}
        zoom={props.zoom}
      />
      <OpeningCaption text={props.openingCaption} hidden={hideOpening} />
      <Subtitles
        cues={props.cues}
        hiddenUntil={!hideOpening && props.openingCaption.trim() ? 3 : 0}
        x={props.subtitleX}
        y={props.subtitleY}
        scale={props.subtitleScale}
        align={props.subtitleAlign}
      />
    </AbsoluteFill>
  );
}
