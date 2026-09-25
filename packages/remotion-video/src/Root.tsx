import { Composition } from "remotion";
import { VerticalClip } from "./VerticalClip";
import { verticalClipPropsSchema, type VerticalClipProps } from "./schema";
import {
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
} from "@studio/contracts";

const defaults: VerticalClipProps = {
  videoFileName: "input.mp4",
  durationSeconds: 30,
  fps: 30,
  openingCaption: "",
  openingCaptionEnabled: true,
  captionsEnabled: true,
  templateId: "clean",
  accentColor: "#8f7cff",
  cropMode: "fill",
  cropX: 50,
  cropY: 50,
  zoom: 1,
  subtitleX: 50,
  subtitleY: 72,
  subtitleScale: 1,
  subtitleAlign: "center",
  image: DEFAULT_IMAGE_ADJUSTMENTS,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  openingCaptionSettings: DEFAULT_OPENING_CAPTION_SETTINGS,
  cues: [],
  ranges: [
    {
      id: "preview",
      start: 0,
      end: 30,
      transition: { type: "hard-cut", durationSeconds: 0 },
    },
  ],
  cropKeyframes: [],
  subtitleKeyframes: [],
};

export function RemotionRoot() {
  return (
    <Composition
      id="VerticalClip"
      component={VerticalClip}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={900}
      schema={verticalClipPropsSchema}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({
        fps: props.fps,
        durationInFrames: Math.max(
          1,
          Math.ceil(props.durationSeconds * props.fps),
        ),
      })}
    />
  );
}
