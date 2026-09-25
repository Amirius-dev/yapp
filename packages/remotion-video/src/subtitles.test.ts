import { describe, expect, it } from "vitest";
import { buildSubtitleCues, buildTimelineSubtitleCues } from "./subtitles.js";
import { verticalClipPropsSchema } from "./schema.js";
import { SUBTITLE_LAYOUT } from "./components/Subtitles";

describe("buildSubtitleCues", () => {
  it("rebases and clips transcript timestamps to the clip", () => {
    const cues = buildSubtitleCues(
      [
        {
          startSeconds: 8,
          endSeconds: 14,
          text: "one two three four five six",
        },
      ],
      10,
      13,
    );
    expect(cues).toEqual([
      {
        startSeconds: 0,
        endSeconds: 3,
        text: "one two three four five six",
        words: [],
      },
    ]);
  });

  it("never puts more than six words into one cue", () => {
    const text = Array.from({ length: 18 }, (_, index) => `word${index}`).join(
      " ",
    );
    const cues = buildSubtitleCues(
      [{ startSeconds: 0, endSeconds: 18, text }],
      0,
      18,
      6,
    );
    expect(cues.map((cue) => cue.text.split(" ").length)).toEqual([6, 6, 6]);
    expect(cues.at(-1)?.endSeconds).toBe(18);
  });

  it("uses short phrases and a stable safe-zone layout", () => {
    const text = "one two three four five six seven eight nine ten eleven";
    const cues = buildSubtitleCues(
      [{ startSeconds: 0, endSeconds: 11, text }],
      0,
      11,
    );
    expect(cues.map((cue) => cue.text.split(" ").length)).toEqual([6, 5]);
    expect(SUBTITLE_LAYOUT.topPercent).toBeGreaterThanOrEqual(68);
    expect(SUBTITLE_LAYOUT.topPercent).toBeLessThanOrEqual(75);
    expect(SUBTITLE_LAYOUT.maxWidth).toBeLessThanOrEqual(1080 * 0.85);
  });

  it("validates crop props", () => {
    const base = {
      videoFileName: "input.mp4",
      durationSeconds: 20,
      fps: 30,
      openingCaption: "Hook",
      cues: [],
      subtitleX: 50,
      subtitleY: 72,
      subtitleScale: 1,
      subtitleAlign: "center" as const,
    };
    expect(
      verticalClipPropsSchema.parse({
        ...base,
        cropMode: "fill",
        cropX: 50,
        cropY: 50,
        zoom: 1,
      }).cropMode,
    ).toBe("fill");
    expect(() =>
      verticalClipPropsSchema.parse({
        ...base,
        cropMode: "fill",
        cropX: 101,
        cropY: 50,
        zoom: 1,
      }),
    ).toThrow();
    expect(() =>
      verticalClipPropsSchema.parse({
        ...base,
        cropMode: "fill",
        cropX: 50,
        cropY: 50,
        zoom: 1,
        subtitleX: 86,
      }),
    ).toThrow();
  });

  it("rebases word timestamps across ordered ranges", () => {
    const cues = buildTimelineSubtitleCues(
      [
        { id: "a", start: 10, end: 12 },
        { id: "b", start: 30, end: 33 },
      ],
      [],
      [
        { startSeconds: 10.5, endSeconds: 11, text: "first" },
        { startSeconds: 31, endSeconds: 31.5, text: "second" },
      ],
    );
    expect(cues[0]?.words[0]).toMatchObject({
      startSeconds: 0.5,
      endSeconds: 1,
    });
    expect(cues[1]?.words[0]).toMatchObject({
      startSeconds: 3,
      endSeconds: 3.5,
    });
  });

  it("hands subtitle ownership to the incoming range during a crossfade", () => {
    const cues = buildTimelineSubtitleCues(
      [
        {
          id: "a",
          start: 0,
          end: 10,
          transition: { type: "crossfade", durationSeconds: 1 },
        },
        { id: "b", start: 30, end: 40 },
      ],
      [],
      [
        { startSeconds: 9.5, endSeconds: 10, text: "outgoing" },
        { startSeconds: 30, endSeconds: 30.5, text: "incoming" },
      ],
    );
    expect(cues.map((cue) => cue.text)).toEqual(["incoming"]);
    expect(cues[0]).toMatchObject({ startSeconds: 9, endSeconds: 9.5 });
  });

  it("passes Fit and image settings through the Remotion boundary", () => {
    const parsed = verticalClipPropsSchema.parse({
      videoFileName: "input.mp4",
      durationSeconds: 20,
      fps: 30,
      openingCaption: "",
      cues: [],
      cropMode: "fit",
      cropX: 50,
      cropY: 50,
      zoom: 1,
      subtitleX: 50,
      subtitleY: 72,
      subtitleScale: 1,
      subtitleAlign: "center",
      image: {
        brightness: 118,
        exposure: 0.2,
        contrast: 105,
        saturation: 90,
        temperature: 5,
        tint: 0,
        sharpness: 12,
        blur: 0,
        vignette: 10,
        opacity: 100,
        rotation: 0,
        flipHorizontal: false,
        zoom: 1,
        positionX: 50,
        positionY: 50,
        backgroundBlur: 42,
        backgroundDim: 0.28,
        backgroundSaturation: 0.78,
      },
    });
    expect(parsed).toMatchObject({
      cropMode: "fit",
      image: {
        brightness: 118,
        backgroundBlur: 42,
        backgroundDim: 0.28,
      },
    });
  });
});
