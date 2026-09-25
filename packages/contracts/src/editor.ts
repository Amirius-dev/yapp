import { z } from "zod";
import {
  accentColorSchema,
  templateIdSchema,
  VIDEO_TEMPLATES,
} from "./templates.js";
import { SUBTITLE_POSITION, clipSchema, subtitleAlignSchema } from "./clips.js";
import {
  transcriptSegmentSchema,
  transcriptWordSchema,
} from "./transcription.js";
import {
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  editorPresetSchema,
  imageAdjustmentsSchema,
  openingCaptionSettingsSchema,
  subtitleStyleSchema,
} from "./editor-settings.js";
import { rangeTransitionSchema } from "./timeline.js";

export const cropEasingSchema = z.enum(["linear", "ease-in-out", "hold"]);
export const subtitleTransitionSchema = z.enum(["hold", "smooth"]);

export const editorRangeSchema = z
  .object({
    id: z.uuid(),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    transition: rangeTransitionSchema.default({
      type: "hard-cut",
      durationSeconds: 0,
    }),
  })
  .strict();

export const cropKeyframeSchema = z
  .object({
    id: z.uuid(),
    rangeId: z.uuid(),
    sourceTimeSeconds: z.number().finite().nonnegative(),
    cropX: z.number().finite().min(0).max(100),
    cropY: z.number().finite().min(0).max(100),
    zoom: z.number().finite().min(1).max(1.5),
    easing: cropEasingSchema,
  })
  .strict();

export const subtitleKeyframeSchema = z
  .object({
    id: z.uuid(),
    rangeId: z.uuid(),
    sourceTimeSeconds: z.number().finite().nonnegative(),
    subtitleX: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minX)
      .max(SUBTITLE_POSITION.maxX),
    subtitleY: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minY)
      .max(SUBTITLE_POSITION.maxY),
    subtitleScale: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minScale)
      .max(SUBTITLE_POSITION.maxScale),
    subtitleAlign: subtitleAlignSchema,
    transition: subtitleTransitionSchema,
  })
  .strict();

export const editorSaveSchema = z
  .object({
    ranges: z.array(editorRangeSchema).min(1),
    cropKeyframes: z.array(cropKeyframeSchema),
    subtitleKeyframes: z.array(subtitleKeyframeSchema),
    frameMode: z.enum(["fill", "fit"]).default("fill"),
    subtitleX: z
      .number()
      .min(SUBTITLE_POSITION.minX)
      .max(SUBTITLE_POSITION.maxX),
    subtitleY: z
      .number()
      .min(SUBTITLE_POSITION.minY)
      .max(SUBTITLE_POSITION.maxY),
    subtitleScale: z
      .number()
      .min(SUBTITLE_POSITION.minScale)
      .max(SUBTITLE_POSITION.maxScale),
    subtitleAlign: subtitleAlignSchema,
    templateId: templateIdSchema,
    accentColor: accentColorSchema,
    captionsEnabled: z.boolean(),
    openingCaptionEnabled: z.boolean(),
    image: imageAdjustmentsSchema.default(DEFAULT_IMAGE_ADJUSTMENTS),
    audio: audioSettingsSchema.default(DEFAULT_AUDIO_SETTINGS),
    subtitleStyle: subtitleStyleSchema.default(DEFAULT_SUBTITLE_STYLE),
    openingCaption: openingCaptionSettingsSchema.default(
      DEFAULT_OPENING_CAPTION_SETTINGS,
    ),
  })
  .strict();

export const editorStateSchema = editorSaveSchema.extend({
  clip: clipSchema,
  sourceDurationSeconds: z.number().positive(),
  words: z.array(transcriptWordSchema),
  segments: z.array(transcriptSegmentSchema),
  hasWordTimestamps: z.boolean(),
  templates: z.array(
    z.object({
      id: templateIdSchema,
      name: z.string(),
      description: z.string(),
      defaultAccentColor: accentColorSchema,
    }),
  ),
  presets: z.array(editorPresetSchema),
  warnings: z.array(z.string()),
});

export const templateOptions = Object.values(VIDEO_TEMPLATES).map(
  ({ id, name, description, defaultAccentColor }) => ({
    id,
    name,
    description,
    defaultAccentColor,
  }),
);

export type EditorRange = z.infer<typeof editorRangeSchema>;
export type CropKeyframe = z.infer<typeof cropKeyframeSchema>;
export type SubtitleKeyframe = z.infer<typeof subtitleKeyframeSchema>;
export type EditorSaveInput = z.infer<typeof editorSaveSchema>;
export type EditorState = z.infer<typeof editorStateSchema>;
