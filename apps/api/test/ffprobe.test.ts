import { describe, expect, it } from "vitest";
import { parseFfprobeOutput, probeVideo } from "../src/services/ffprobe.js";

describe("parseFfprobeOutput", () => {
  it("normalizes video metadata and detects audio", () => {
    expect(
      parseFfprobeOutput(
        {
          streams: [
            {
              codec_type: "video",
              width: 1920,
              height: 1080,
              avg_frame_rate: "30000/1001",
            },
            { codec_type: "audio" },
          ],
          format: { duration: "2.500000" },
        },
        42_000,
      ),
    ).toEqual({
      durationSeconds: 2.5,
      width: 1920,
      height: 1080,
      fps: 30000 / 1001,
      fileSizeBytes: 42_000,
      hasAudio: true,
    });
  });

  it("rejects media without a readable video stream", () => {
    expect(() =>
      parseFfprobeOutput(
        { streams: [{ codec_type: "audio" }], format: { duration: "3" } },
        10,
      ),
    ).toThrow("Не удалось определить");
  });

  it("returns an actionable error when ffprobe is unavailable", async () => {
    await expect(
      probeVideo("/tmp/does-not-matter.mp4", 0, "missing-ffprobe-for-test"),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("Установите FFmpeg"),
    });
  });
});
