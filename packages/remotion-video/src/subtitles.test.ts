import { describe, expect, it } from "vitest";
import { buildSubtitleCues } from "./subtitles.js";

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

  it("never puts more than eight words into one cue", () => {
    const text = Array.from({ length: 18 }, (_, index) => `word${index}`).join(
      " ",
    );
    const cues = buildSubtitleCues(
      [{ startSeconds: 0, endSeconds: 18, text }],
      0,
      18,
      8,
    );
    expect(cues.map((cue) => cue.text.split(" ").length)).toEqual([8, 8, 2]);
    expect(cues.at(-1)?.endSeconds).toBe(18);
  });
});
