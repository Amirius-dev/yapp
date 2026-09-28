import { z } from "zod";
import { editorSaveSchema, editorStateSchema } from "./editor.js";
import {
  editorEasingSchema,
  easingProgress,
  outputToSourceTime,
  rangeLocalToOutputTime,
  type TimelineRange,
} from "./timeline.js";

const finite = () => z.number().finite();
const percent = () => finite().min(0).max(100);

export const editorMediaKindSchema = z.enum(["music", "image"]);

export const editorMediaAssetSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    clipId: z.uuid().nullable(),
    kind: editorMediaKindSchema,
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    durationSeconds: finite().nonnegative().nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    fileSizeBytes: z.number().int().nonnegative(),
    mediaUrl: z.string().min(1),
    waveform: z.array(finite().min(-1).max(1)).max(4096).nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const maskTypeSchema = z.enum(["blur", "pixelate", "solid"]);
export const maskShapeSchema = z.enum([
  "rectangle",
  "rounded-rectangle",
  "ellipse",
]);

const maskGeometrySchema = z.object({
  x: percent(),
  y: percent(),
  width: finite().min(1).max(100),
  height: finite().min(1).max(100),
  rotation: finite().min(-180).max(180),
  intensity: percent(),
  opacity: finite().min(0).max(1),
});

export const maskKeyframeSchema = maskGeometrySchema
  .extend({
    id: z.uuid(),
    rangeId: z.uuid(),
    rangeTimeSeconds: finite().nonnegative(),
    easing: editorEasingSchema,
  })
  .strict();

export const editorMaskSchema = maskGeometrySchema
  .extend({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    type: maskTypeSchema,
    shape: maskShapeSchema,
    startSeconds: finite().nonnegative(),
    endSeconds: finite().positive(),
    feather: percent(),
    fillColor: z.string().regex(/^#[0-9a-f]{6}$/iu),
    visible: z.boolean(),
    locked: z.boolean(),
    layerOrder: z.number().int().min(0).max(999),
    keyframes: z.array(maskKeyframeSchema),
  })
  .strict()
  .refine((mask) => mask.endSeconds > mask.startSeconds, {
    message: "Конец маски должен быть позже начала.",
    path: ["endSeconds"],
  });

export const overlayAnimationSchema = z.enum([
  "none",
  "fade",
  "pop",
  "slide",
  "zoom",
]);

const overlayGeometrySchema = z.object({
  x: percent(),
  y: percent(),
  width: finite().min(1).max(100),
  height: finite().min(1).max(100),
  scale: finite().min(0.05).max(10),
  rotation: finite().min(-180).max(180),
  opacity: finite().min(0).max(1),
});

export const imageOverlayKeyframeSchema = overlayGeometrySchema
  .extend({
    id: z.uuid(),
    anchor: z.enum(["timeline", "range"]),
    rangeId: z.uuid().nullable(),
    localTimeSeconds: finite().nonnegative(),
    easing: editorEasingSchema,
  })
  .strict()
  .superRefine((frame, context) => {
    if (frame.anchor === "range" && !frame.rangeId)
      context.addIssue({
        code: "custom",
        path: ["rangeId"],
        message: "Для range-relative keyframe нужен rangeId.",
      });
  });

export const imageOverlaySchema = overlayGeometrySchema
  .extend({
    id: z.uuid(),
    assetId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    startSeconds: finite().nonnegative(),
    endSeconds: finite().positive(),
    borderRadius: finite().min(0).max(100),
    shadow: z.boolean(),
    visible: z.boolean(),
    locked: z.boolean(),
    layerOrder: z.number().int().min(0).max(999),
    animation: overlayAnimationSchema,
    watermark: z.boolean(),
    safeZone: z.boolean(),
    keyframes: z.array(imageOverlayKeyframeSchema),
  })
  .strict()
  .refine((overlay) => overlay.endSeconds > overlay.startSeconds, {
    message: "Конец overlay должен быть позже начала.",
    path: ["endSeconds"],
  });

export const editorDocumentV2Schema = editorSaveSchema
  .extend({
    schemaVersion: z.literal(2),
    masks: z.array(editorMaskSchema).default([]),
    imageOverlays: z.array(imageOverlaySchema).default([]),
    markers: z
      .array(
        z
          .object({
            id: z.uuid(),
            timeSeconds: finite().nonnegative(),
            label: z.string().trim().max(120),
            color: z.string().regex(/^#[0-9a-f]{6}$/iu),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const editorDocumentSaveRequestSchema = z
  .object({
    baseRevision: z.number().int().positive(),
    document: editorDocumentV2Schema,
  })
  .strict();

export const editorDocumentSnapshotSchema = z
  .object({
    revision: z.number().int().positive(),
    document: editorDocumentV2Schema,
    context: editorStateSchema,
    mediaAssets: z.array(editorMediaAssetSchema),
  })
  .strict();

type NumericGeometry = Record<string, number>;

function interpolateGeometry<T extends NumericGeometry>(
  previous: T,
  next: T | undefined,
  progress: number,
  easing: z.infer<typeof editorEasingSchema>,
): T {
  if (!next || easing === "hold") return previous;
  const eased = easingProgress(progress, easing);
  return Object.fromEntries(
    Object.entries(previous).map(([key, value]) => [
      key,
      value + ((next[key] ?? value) - value) * eased,
    ]),
  ) as T;
}

export function evaluateMask(
  mask: EditorMask,
  ranges: readonly TimelineRange[],
  outputTime: number,
) {
  if (
    !mask.visible ||
    outputTime < mask.startSeconds ||
    outputTime >= mask.endSeconds
  )
    return null;
  const mapped = outputToSourceTime(ranges, outputTime);
  if (!mapped) return null;
  const range = ranges.find((item) => item.id === mapped.rangeId);
  if (!range) return null;
  const localTime = mapped.sourceTime - range.start;
  const frames = mask.keyframes
    .filter((frame) => frame.rangeId === mapped.rangeId)
    .sort((a, b) => a.rangeTimeSeconds - b.rangeTimeSeconds);
  const previous = [...frames]
    .reverse()
    .find((frame) => frame.rangeTimeSeconds <= localTime);
  const next = frames.find((frame) => frame.rangeTimeSeconds > localTime);
  if (!previous) return { ...mask, ...(frames[0] ?? {}) };
  const span = next ? next.rangeTimeSeconds - previous.rangeTimeSeconds : 0;
  const geometry = interpolateGeometry(
    {
      x: previous.x,
      y: previous.y,
      width: previous.width,
      height: previous.height,
      rotation: previous.rotation,
      intensity: previous.intensity,
      opacity: previous.opacity,
    },
    next
      ? {
          x: next.x,
          y: next.y,
          width: next.width,
          height: next.height,
          rotation: next.rotation,
          intensity: next.intensity,
          opacity: next.opacity,
        }
      : undefined,
    span > 0 ? (localTime - previous.rangeTimeSeconds) / span : 0,
    previous.easing,
  );
  return { ...mask, ...geometry };
}

export function evaluateImageOverlay(
  overlay: ImageOverlay,
  ranges: readonly TimelineRange[],
  outputTime: number,
) {
  if (
    !overlay.visible ||
    outputTime < overlay.startSeconds ||
    outputTime >= overlay.endSeconds
  )
    return null;
  const frames = overlay.keyframes
    .flatMap((frame) => {
      if (frame.anchor === "timeline")
        return [{ frame, time: frame.localTimeSeconds }];
      if (!frame.rangeId) return [];
      const time = rangeLocalToOutputTime(
        ranges,
        frame.rangeId,
        frame.localTimeSeconds,
      );
      return time === null ? [] : [{ frame, time }];
    })
    .sort((a, b) => a.time - b.time);
  const previous = [...frames]
    .reverse()
    .find((item) => item.time <= outputTime);
  const next = frames.find((item) => item.time > outputTime);
  if (!previous) return { ...overlay, ...(frames[0]?.frame ?? {}) };
  const span = next ? next.time - previous.time : 0;
  const geometry = interpolateGeometry(
    {
      x: previous.frame.x,
      y: previous.frame.y,
      width: previous.frame.width,
      height: previous.frame.height,
      scale: previous.frame.scale,
      rotation: previous.frame.rotation,
      opacity: previous.frame.opacity,
    },
    next
      ? {
          x: next.frame.x,
          y: next.frame.y,
          width: next.frame.width,
          height: next.frame.height,
          scale: next.frame.scale,
          rotation: next.frame.rotation,
          opacity: next.frame.opacity,
        }
      : undefined,
    span > 0 ? (outputTime - previous.time) / span : 0,
    previous.frame.easing,
  );
  return { ...overlay, ...geometry };
}

export type EditorMediaAsset = z.infer<typeof editorMediaAssetSchema>;
export type EditorMask = z.infer<typeof editorMaskSchema>;
export type MaskKeyframe = z.infer<typeof maskKeyframeSchema>;
export type ImageOverlay = z.infer<typeof imageOverlaySchema>;
export type ImageOverlayKeyframe = z.infer<typeof imageOverlayKeyframeSchema>;
export type EditorDocumentV2 = z.infer<typeof editorDocumentV2Schema>;
export type EditorDocumentSaveRequest = z.infer<
  typeof editorDocumentSaveRequestSchema
>;
export type EditorDocumentSnapshot = z.infer<
  typeof editorDocumentSnapshotSchema
>;
