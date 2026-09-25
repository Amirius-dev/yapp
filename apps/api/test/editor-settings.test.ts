import { describe, expect, it } from "vitest";
import {
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  editorSaveSchema,
  imageAdjustmentsSchema,
  openingCaptionSettingsSchema,
  rangeTransitionSchema,
  subtitleStyleSchema,
} from "@studio/contracts";

describe("editor setting contracts", () => {
  it("accepts all safe defaults", () => {
    expect(imageAdjustmentsSchema.parse(DEFAULT_IMAGE_ADJUSTMENTS)).toEqual(
      DEFAULT_IMAGE_ADJUSTMENTS,
    );
    expect(audioSettingsSchema.parse(DEFAULT_AUDIO_SETTINGS)).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(subtitleStyleSchema.parse(DEFAULT_SUBTITLE_STYLE)).toEqual(
      DEFAULT_SUBTITLE_STYLE,
    );
    expect(
      openingCaptionSettingsSchema.parse(DEFAULT_OPENING_CAPTION_SETTINGS),
    ).toEqual(DEFAULT_OPENING_CAPTION_SETTINGS);
  });

  it("rejects unsafe image, audio, and subtitle values", () => {
    expect(
      imageAdjustmentsSchema.safeParse({
        ...DEFAULT_IMAGE_ADJUSTMENTS,
        exposure: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(
      audioSettingsSchema.safeParse({
        ...DEFAULT_AUDIO_SETTINGS,
        volume: 2.01,
      }).success,
    ).toBe(false);
    expect(
      subtitleStyleSchema.safeParse({
        ...DEFAULT_SUBTITLE_STYLE,
        fontFamily: "url(https://example.com/font.woff)",
      }).success,
    ).toBe(false);
  });

  it("limits transitions to the supported set and safe duration", () => {
    expect(
      rangeTransitionSchema.parse({
        type: "crossfade",
        durationSeconds: 0.5,
      }),
    ).toEqual({ type: "crossfade", durationSeconds: 0.5 });
    expect(
      rangeTransitionSchema.safeParse({
        type: "wipe",
        durationSeconds: 0.5,
      }).success,
    ).toBe(false);
    expect(
      rangeTransitionSchema.safeParse({
        type: "dip-to-black",
        durationSeconds: 2,
      }).success,
    ).toBe(false);
  });

  it("parses a complete atomic editor payload", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      editorSaveSchema.safeParse({
        ranges: [
          {
            id,
            start: 10,
            end: 30,
            transition: { type: "hard-cut", durationSeconds: 0 },
          },
        ],
        cropKeyframes: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            rangeId: id,
            sourceTimeSeconds: 10,
            cropX: 50,
            cropY: 50,
            zoom: 1,
            easing: "linear",
          },
        ],
        subtitleKeyframes: [],
        frameMode: "fit",
        subtitleX: 50,
        subtitleY: 72,
        subtitleScale: 1,
        subtitleAlign: "center",
        templateId: "clean",
        accentColor: "#ff6b00",
        captionsEnabled: true,
        openingCaptionEnabled: false,
        image: DEFAULT_IMAGE_ADJUSTMENTS,
        audio: DEFAULT_AUDIO_SETTINGS,
        subtitleStyle: DEFAULT_SUBTITLE_STYLE,
        openingCaption: DEFAULT_OPENING_CAPTION_SETTINGS,
      }).success,
    ).toBe(true);
  });
});
