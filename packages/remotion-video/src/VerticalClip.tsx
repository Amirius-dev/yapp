import { AbsoluteFill } from "remotion";
import type { VerticalClipProps } from "./schema";
import { OpeningCaption } from "./components/OpeningCaption";
import { Subtitles } from "./components/Subtitles";
import { VideoLayers } from "./components/VideoLayers";

export function VerticalClip(props: VerticalClipProps) {
  return (
    <AbsoluteFill>
      <VideoLayers
        videoFileName={props.videoFileName}
        cropMode={props.cropMode}
        cropX={props.cropX}
        cropY={props.cropY}
        zoom={props.zoom}
        ranges={props.ranges}
        cropKeyframes={props.cropKeyframes}
        image={props.image}
      />
      <OpeningCaption settings={props.openingCaptionSettings} />
      {props.captionsEnabled && (
        <Subtitles
          cues={props.cues}
          hiddenUntil={
            props.openingCaptionSettings.enabled
              ? props.openingCaptionSettings.durationSeconds
              : 0
          }
          x={props.subtitleX}
          y={props.subtitleY}
          scale={props.subtitleScale}
          align={props.subtitleAlign}
          ranges={props.ranges}
          keyframes={props.subtitleKeyframes}
          templateId={props.templateId}
          accentColor={props.accentColor}
          style={props.subtitleStyle}
        />
      )}
    </AbsoluteFill>
  );
}
