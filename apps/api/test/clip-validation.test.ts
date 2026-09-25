import { describe, expect, it } from "vitest";
import { validateClipsContent } from "../src/services/clip-validation.js";

const context = {
  projectId: "11111111-1111-4111-8111-111111111111",
  durationSeconds: 120,
  segments: [
    { id: 0, start: 0, end: 20 },
    { id: 1, start: 20, end: 40 },
    { id: 2, start: 40, end: 70 },
  ],
};

function response(clips: unknown[]) {
  return JSON.stringify({
    schemaVersion: 1,
    projectId: context.projectId,
    clips,
  });
}

const validClip = {
  title: "Complete idea",
  start: 0,
  end: 40,
  hookScore: 9,
  reason: "Clear hook and conclusion",
  openingCaption: "A short opening hook",
  segmentIds: [0, 1],
};

describe("validateClipsContent", () => {
  it("returns a preview and a non-blocking count warning", () => {
    const result = validateClipsContent(response([validClip]), context);
    expect(result.valid).toBe(true);
    expect(result.preview?.clips).toHaveLength(1);
    expect(result.preview?.schemaVersion).toBe(2);
    expect(result.preview?.clips[0]?.ranges).toEqual([
      { start: 0, end: 40, segmentIds: [0, 1] },
    ]);
    expect(result.warnings.map((item) => item.code)).toContain(
      "clip_count_outside_recommended",
    );
  });

  it("accepts schema v2 multi-range clips and sums their duration", () => {
    const result = validateClipsContent(
      JSON.stringify({
        schemaVersion: 2,
        projectId: context.projectId,
        clips: [
          {
            title: "Multi range",
            ranges: [
              { start: 0, end: 10, segmentIds: [0] },
              { start: 40, end: 60, segmentIds: [2] },
            ],
            hookScore: 9,
            reason: "One coherent thought",
            openingCaption: "Combined idea",
          },
        ],
      }),
      context,
    );
    expect(result.valid).toBe(true);
    expect(result.preview?.clips[0]?.ranges).toHaveLength(2);
    expect(result.errors.some((item) => item.code === "invalid_duration")).toBe(
      false,
    );
  });

  it("accepts schema v2 with one range and three non-adjacent ranges", () => {
    const clips = [
      {
        title: "Single range",
        ranges: [{ start: 0, end: 20, segmentIds: [0] }],
        hookScore: 8,
        reason: "Already complete",
        openingCaption: "One idea",
      },
      {
        title: "Three ranges",
        ranges: [
          { start: 0, end: 6, segmentIds: [0] },
          { start: 20, end: 28, segmentIds: [1] },
          { start: 40, end: 48, segmentIds: [2] },
        ],
        hookScore: 9,
        reason: "Setup, evidence, conclusion",
        openingCaption: "Three moments",
      },
    ];
    const result = validateClipsContent(
      JSON.stringify({
        schemaVersion: 2,
        projectId: context.projectId,
        clips,
      }),
      context,
    );
    expect(result.valid).toBe(true);
    expect(result.preview?.clips.map((clip) => clip.ranges.length)).toEqual([
      1, 3,
    ]);
  });

  it("rejects invalid JSON and empty clips", () => {
    expect(validateClipsContent("not-json", context).errors[0]?.code).toBe(
      "invalid_json",
    );
    expect(
      validateClipsContent(response([]), context).errors.map(
        (item) => item.code,
      ),
    ).toContain("empty_clips");
  });

  it("rejects wrong project, unknown segments, invalid duration and duplicate ranges", () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      projectId: "another-project",
      clips: [
        { ...validClip, end: 10, segmentIds: [99] },
        { ...validClip, end: 10, segmentIds: [0] },
      ],
    });
    const codes = validateClipsContent(input, context).errors.map(
      (item) => item.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "wrong_project_id",
        "unknown_segment_ids",
        "invalid_duration",
        "duplicate_range",
      ]),
    );
  });

  it("warns for heavy overlap, incomplete coverage and a long caption", () => {
    const second = {
      ...validClip,
      title: "Second",
      start: 10,
      end: 40,
      segmentIds: [1],
      openingCaption:
        "one two three four five six seven eight nine ten eleven twelve thirteen",
    };
    const codes = validateClipsContent(
      response([validClip, second]),
      context,
    ).warnings.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "heavy_overlap",
        "segments_do_not_cover_range",
        "opening_caption_too_long",
      ]),
    );
  });
});
