import { describe, expect, it } from "vitest";
import {
  editorMediaAssetSchema,
  evaluateImageOverlay,
  evaluateMask,
  type EditorMask,
  type ImageOverlay,
} from "@studio/contracts";

const firstRangeId = "11111111-1111-4111-8111-111111111111";
const secondRangeId = "22222222-2222-4222-8222-222222222222";
const ranges = [
  {
    id: firstRangeId,
    start: 10,
    end: 20,
    transition: { type: "crossfade" as const, durationSeconds: 1 },
  },
  { id: secondRangeId, start: 60, end: 70 },
];

const mask: EditorMask = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Logo",
  type: "blur",
  shape: "rounded-rectangle",
  startSeconds: 2,
  endSeconds: 15,
  x: 20,
  y: 20,
  width: 20,
  height: 10,
  rotation: 0,
  intensity: 50,
  opacity: 1,
  feather: 10,
  fillColor: "#000000",
  visible: true,
  locked: false,
  layerOrder: 1,
  keyframes: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      rangeId: secondRangeId,
      rangeTimeSeconds: 0,
      x: 10,
      y: 20,
      width: 20,
      height: 10,
      rotation: 0,
      intensity: 40,
      opacity: 1,
      easing: "linear",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      rangeId: secondRangeId,
      rangeTimeSeconds: 4,
      x: 50,
      y: 60,
      width: 40,
      height: 20,
      rotation: 20,
      intensity: 80,
      opacity: 0.5,
      easing: "hold",
    },
  ],
};

const overlay: ImageOverlay = {
  id: "66666666-6666-4666-8666-666666666666",
  assetId: "77777777-7777-4777-8777-777777777777",
  name: "Watermark",
  startSeconds: 1,
  endSeconds: 18,
  x: 80,
  y: 15,
  width: 15,
  height: 10,
  scale: 1,
  rotation: 0,
  opacity: 0.7,
  borderRadius: 0,
  shadow: true,
  visible: true,
  locked: false,
  layerOrder: 4,
  animation: "fade",
  watermark: true,
  safeZone: true,
  keyframes: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      anchor: "timeline",
      rangeId: null,
      localTimeSeconds: 1,
      x: 80,
      y: 15,
      width: 15,
      height: 10,
      scale: 1,
      rotation: 0,
      opacity: 0,
      easing: "ease-out",
    },
    {
      id: "99999999-9999-4999-8999-999999999999",
      anchor: "timeline",
      rangeId: null,
      localTimeSeconds: 2,
      x: 80,
      y: 15,
      width: 15,
      height: 10,
      scale: 1,
      rotation: 0,
      opacity: 0.7,
      easing: "hold",
    },
  ],
};

describe("editor document masks and overlays", () => {
  it("honors mask timing and interpolates range-local keyframes", () => {
    expect(evaluateMask(mask, ranges, 1.99)).toBeNull();
    expect(evaluateMask(mask, ranges, 11)).toMatchObject({ x: 30, y: 40 });
    expect(evaluateMask(mask, ranges, 15)).toBeNull();
  });

  it("uses the incoming range at a transition and supports hold", () => {
    expect(evaluateMask(mask, ranges, 9.5)).toMatchObject({ x: 15, y: 25 });
    const held = {
      ...mask,
      keyframes: mask.keyframes.map((frame, index) =>
        index === 0 ? { ...frame, easing: "hold" as const } : frame,
      ),
    };
    expect(evaluateMask(held, ranges, 11)).toMatchObject({ x: 10, y: 20 });
  });

  it("honors overlay timing, keyframes, and explicit layer order", () => {
    expect(evaluateImageOverlay(overlay, ranges, 0.5)).toBeNull();
    expect(evaluateImageOverlay(overlay, ranges, 1.5)?.opacity).toBeCloseTo(
      0.525,
    );
    expect(evaluateImageOverlay(overlay, ranges, 18)).toBeNull();
    expect(
      [overlay, { ...overlay, id: firstRangeId, layerOrder: 1 }]
        .sort((a, b) => a.layerOrder - b.layerOrder)
        .map((item) => item.layerOrder),
    ).toEqual([1, 4]);
  });

  it("accepts transparent PNG image assets without filesystem paths", () => {
    const parsed = editorMediaAssetSchema.parse({
      id: overlay.assetId,
      projectId: firstRangeId,
      clipId: secondRangeId,
      kind: "image",
      originalName: "transparent-logo.png",
      mimeType: "image/png",
      durationSeconds: null,
      width: 512,
      height: 512,
      fileSizeBytes: 2048,
      mediaUrl: `/api/editor/assets/${overlay.assetId}/media`,
      waveform: null,
      createdAt: new Date(0).toISOString(),
    });
    expect(parsed.kind).toBe("image");
    expect(JSON.stringify(parsed)).not.toContain("/Users/");
  });
});
