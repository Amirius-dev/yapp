import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  editorSaveSchema,
  interpolateCrop,
  interpolateSubtitle,
  outputToSourceTime,
  rangeLocalToOutputTime,
  sourceToOutputTime,
  timelineDuration,
} from "@studio/contracts";

const ranges = [
  { id: "one", start: 10, end: 15 },
  { id: "two", start: 30, end: 40 },
  { id: "three", start: 55, end: 70 },
];

describe("shared timeline mapping", () => {
  it("maps ordered source ranges onto one output timeline", () => {
    expect(buildTimeline(ranges)).toMatchObject([
      { id: "one", outputStart: 0, outputEnd: 5 },
      { id: "two", outputStart: 5, outputEnd: 15 },
      { id: "three", outputStart: 15, outputEnd: 30 },
    ]);
    expect(timelineDuration(ranges)).toBe(30);
    expect(outputToSourceTime(ranges, 8)).toEqual({
      rangeId: "two",
      sourceTime: 33,
    });
    expect(sourceToOutputTime(ranges, "three", 60)).toBe(20);
    expect(rangeLocalToOutputTime(ranges, "three", 5)).toBe(20);
  });

  it("sums one, two, and three ranges instead of using the source span", () => {
    expect(
      timelineDuration([{ id: "a", start: 60.78, end: 89.8 }]),
    ).toBeCloseTo(29.02, 6);
    const two = [
      { id: "a", start: 60.78, end: 89.8 },
      { id: "b", start: 189.56, end: 211.42 },
    ];
    expect(timelineDuration(two)).toBeCloseTo(50.88, 6);
    expect(timelineDuration(two)).not.toBeCloseTo(211.42 - 60.78, 2);
    expect(
      timelineDuration([...two, { id: "c", start: 300, end: 309 }]),
    ).toBeCloseTo(59.88, 6);
  });

  it("maps both sides of hard-cut boundaries without playing source gaps", () => {
    const two = [
      { id: "a", start: 60, end: 89 },
      { id: "b", start: 189, end: 211 },
    ];
    expect(outputToSourceTime(two, 28.999)).toMatchObject({
      rangeId: "a",
      sourceTime: 88.999,
    });
    expect(outputToSourceTime(two, 29)).toEqual({
      rangeId: "b",
      sourceTime: 189,
    });
  });

  it("subtracts safe transition overlap from output duration", () => {
    const transitioned = [
      {
        id: "a",
        start: 0,
        end: 10,
        transition: { type: "crossfade" as const, durationSeconds: 1 },
      },
      {
        id: "b",
        start: 20,
        end: 30,
        transition: { type: "dip-to-black" as const, durationSeconds: 0.5 },
      },
      { id: "c", start: 40, end: 50 },
    ];
    expect(timelineDuration(transitioned)).toBe(28.5);
    expect(
      buildTimeline(transitioned).map((range) => range.outputStart),
    ).toEqual([0, 9, 18.5]);
  });

  it("respects explicit range reordering", () => {
    expect(buildTimeline([ranges[2]!, ranges[0]!])).toMatchObject([
      { id: "three", outputStart: 0, outputEnd: 15 },
      { id: "one", outputStart: 15, outputEnd: 20 },
    ]);
  });

  it("never interpolates keyframes across a cut", () => {
    const crop = interpolateCrop(
      [
        {
          rangeId: "one",
          sourceTimeSeconds: 10,
          cropX: 10,
          cropY: 20,
          zoom: 1,
          easing: "linear",
        },
        {
          rangeId: "two",
          sourceTimeSeconds: 30,
          cropX: 90,
          cropY: 80,
          zoom: 1.5,
          easing: "linear",
        },
      ],
      "one",
      14,
      { cropX: 50, cropY: 50, zoom: 1 },
    );
    expect(crop).toMatchObject({ cropX: 10, cropY: 20, zoom: 1 });
  });

  it("supports smooth subtitle movement within one range", () => {
    const subtitle = interpolateSubtitle(
      [
        {
          rangeId: "two",
          sourceTimeSeconds: 30,
          subtitleX: 20,
          subtitleY: 30,
          subtitleScale: 1,
          subtitleAlign: "left",
          transition: "smooth",
        },
        {
          rangeId: "two",
          sourceTimeSeconds: 40,
          subtitleX: 80,
          subtitleY: 70,
          subtitleScale: 1.4,
          subtitleAlign: "right",
          transition: "hold",
        },
      ],
      "two",
      35,
      {
        subtitleX: 50,
        subtitleY: 72,
        subtitleScale: 1,
        subtitleAlign: "center",
      },
    );
    expect(subtitle).toMatchObject({
      subtitleX: 50,
      subtitleY: 50,
      subtitleScale: 1.2,
      subtitleAlign: "right",
    });
  });

  it("validates editor state at the shared runtime boundary", () => {
    const result = editorSaveSchema.safeParse({
      ranges: [{ id: "not-a-uuid", start: 3, end: 2 }],
      cropKeyframes: [],
      subtitleKeyframes: [],
      frameMode: "fill",
      subtitleX: 99,
      subtitleY: 72,
      subtitleScale: 1,
      subtitleAlign: "center",
      templateId: "custom-css",
      accentColor: "red",
      captionsEnabled: true,
      openingCaptionEnabled: true,
      image: {},
      audio: {},
      subtitleStyle: {},
      openingCaption: {},
    });
    expect(result.success).toBe(false);
  });
});
