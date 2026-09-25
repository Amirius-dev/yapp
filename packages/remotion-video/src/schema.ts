import { z } from "zod";
import {
  imageAdjustmentsSchema,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  openingCaptionSettingsSchema,
  rangeTransitionSchema,
  subtitleStyleSchema,
} from "@studio/contracts";

export const subtitleCueSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1),
  words: z
    .array(
      z.object({
        startSeconds: z.number().nonnegative(),
        endSeconds: z.number().positive(),
        text: z.string().min(1),
      }),
    )
    .default([]),
});

const rangeSchema = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  transition: rangeTransitionSchema.default({
    type: "hard-cut",
    durationSeconds: 0,
  }),
});
const cropKeyframeSchema = z.object({
  rangeId: z.string(),
  sourceTimeSeconds: z.number(),
  cropX: z.number(),
  cropY: z.number(),
  zoom: z.number(),
  easing: z.enum(["linear", "ease-in-out", "hold"]),
});
const subtitleKeyframeSchema = z.object({
  rangeId: z.string(),
  sourceTimeSeconds: z.number(),
  subtitleX: z.number(),
  subtitleY: z.number(),
  subtitleScale: z.number(),
  subtitleAlign: z.enum(["left", "center", "right"]),
  transition: z.enum(["hold", "smooth"]),
});

export const verticalClipPropsSchema = z.object({
  videoFileName: z.string().min(1),
  durationSeconds: z.number().positive(),
  fps: z.number().positive().default(30),
  openingCaption: z.string(),
  openingCaptionEnabled: z.boolean().default(true),
  captionsEnabled: z.boolean().default(true),
  templateId: z.enum(["clean", "motivational", "podcast"]).default("clean"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#8f7cff"),
  cropMode: z.enum(["fill", "fit"]),
  cropX: z.number().min(0).max(100),
  cropY: z.number().min(0).max(100),
  zoom: z.number().min(1).max(1.5),
  subtitleX: z.number().min(15).max(85),
  subtitleY: z.number().min(18).max(84),
  subtitleScale: z.number().min(0.75).max(1.5),
  subtitleAlign: z.enum(["left", "center", "right"]),
  image: imageAdjustmentsSchema.default(DEFAULT_IMAGE_ADJUSTMENTS),
  subtitleStyle: subtitleStyleSchema.default(DEFAULT_SUBTITLE_STYLE),
  openingCaptionSettings: openingCaptionSettingsSchema.default(
    DEFAULT_OPENING_CAPTION_SETTINGS,
  ),
  cues: z.array(subtitleCueSchema),
  ranges: z.array(rangeSchema).default([]),
  cropKeyframes: z.array(cropKeyframeSchema).default([]),
  subtitleKeyframes: z.array(subtitleKeyframeSchema).default([]),
});

export type SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type VerticalClipProps = z.infer<typeof verticalClipPropsSchema>;
