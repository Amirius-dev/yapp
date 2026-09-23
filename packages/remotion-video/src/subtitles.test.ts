import { describe, expect, it } from "vitest";
import { buildSubtitleCues } from "./subtitles.js";
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
      { startSeconds: 0, endSeconds: 3, text: "one two three four five six" },
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
});
