import { Composition } from "remotion";
import { VerticalClip } from "./VerticalClip";
import { verticalClipPropsSchema, type VerticalClipProps } from "./schema";

const defaults: VerticalClipProps = {
  videoFileName: "input.mp4",
  durationSeconds: 30,
  fps: 30,
  openingCaption: "",
  cropMode: "fill",
  cropX: 50,
  cropY: 50,
  zoom: 1,
  subtitleX: 50,
  subtitleY: 72,
  subtitleScale: 1,
  subtitleAlign: "center",
  cues: [],
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
