import { z } from "zod";
import { accentColorSchema, templateIdSchema } from "./templates.js";
import {
  audioSettingsSchema,
  imageAdjustmentsSchema,
  openingCaptionSettingsSchema,
  subtitleStyleSchema,
} from "./editor-settings.js";
import { rangeTransitionSchema } from "./timeline.js";

export const SUBTITLE_POSITION = {
  minX: 15,
  maxX: 85,
  minY: 18,
  maxY: 84,
  defaultX: 50,
  defaultY: 72,
  defaultScale: 1,
  minScale: 0.75,
  maxScale: 1.5,
} as const;

export const subtitleAlignSchema = z.enum(["left", "center", "right"]);

export function clampSubtitlePosition(x: number, y: number) {
  return {
    x: Math.min(SUBTITLE_POSITION.maxX, Math.max(SUBTITLE_POSITION.minX, x)),
    y: Math.min(SUBTITLE_POSITION.maxY, Math.max(SUBTITLE_POSITION.minY, y)),
  };
}

export function subtitleSafeWidthPercent(x: number, scale: number) {
  const safeX = clampSubtitlePosition(x, SUBTITLE_POSITION.defaultY).x;
  const safeScale = Math.min(
    SUBTITLE_POSITION.maxScale,
    Math.max(SUBTITLE_POSITION.minScale, scale),
  );
  return Math.min(85, 2 * Math.min(safeX - 5, 95 - safeX)) / safeScale;
}

export const aiPackageRequestSchema = z
  .object({ format: z.enum(["zip", "prompt"]).default("zip") })
  .strict();

export const aiPackageMetadataSchema = z
  .object({
    schemaVersion: z.literal(2),
    projectId: z.uuid(),
    projectName: z.string().min(1),
    language: z.string().nullable(),
    durationSeconds: z.number().nonnegative(),
    segmentCount: z.number().int().nonnegative(),
    generatedAt: z.iso.datetime(),
  })
  .strict();

export const aiPackagePromptSchema = z
  .object({
    metadata: aiPackageMetadataSchema,
    prompt: z.string().min(1),
    files: z.tuple([
      z.literal("AI_PROMPT.md"),
      z.literal("transcript.json"),
      z.literal("clips.schema.json"),
      z.literal("project-context.json"),
    ]),
  })
  .strict();

export const clipSuggestionSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    start: z.number().finite(),
    end: z.number().finite(),
    hookScore: z.number().int().min(1).max(10),
    reason: z.string().trim().min(1).max(1000),
    openingCaption: z.string().trim().min(1).max(300),
    segmentIds: z.array(z.number().int().nonnegative()).min(1),
  })
  .strict();

export const clipRangeSuggestionSchema = z
  .object({
    start: z.number().finite(),
    end: z.number().finite(),
    segmentIds: z.array(z.number().int().nonnegative()).min(1),
  })
  .strict();

export const clipSuggestionV2Schema = z
  .object({
    title: z.string().trim().min(1).max(160),
    ranges: z.array(clipRangeSuggestionSchema).min(1),
    hookScore: z.number().int().min(1).max(10),
    reason: z.string().trim().min(1).max(1000),
    openingCaption: z.string().trim().min(1).max(300),
  })
  .strict();

export const aiResponseV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: z.string().min(1),
    clips: z.array(clipSuggestionSchema),
  })
  .strict();

export const aiResponseV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    projectId: z.string().min(1),
    clips: z.array(clipSuggestionV2Schema),
  })
  .strict();

export const aiResponseSchema = z.discriminatedUnion("schemaVersion", [
  aiResponseV1Schema,
  aiResponseV2Schema,
]);

export const normalizedAiResponseSchema = aiResponseV2Schema;

export const clipsImportSchema = z
  .object({ content: z.string().min(1, "Вставьте JSON от AI.") })
  .strict();

export const clipUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    start: z.number().finite().optional(),
    end: z.number().finite().optional(),
    openingCaption: z.string().trim().min(1).max(300).optional(),
    enabled: z.boolean().optional(),
    cropMode: z.enum(["fill", "fit"]).optional(),
    cropX: z.number().finite().min(0).max(100).optional(),
    cropY: z.number().finite().min(0).max(100).optional(),
    zoom: z.number().finite().min(1).max(1.5).optional(),
    subtitleX: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minX)
      .max(SUBTITLE_POSITION.maxX)
      .optional(),
    subtitleY: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minY)
      .max(SUBTITLE_POSITION.maxY)
      .optional(),
    subtitleScale: z
      .number()
      .finite()
      .min(SUBTITLE_POSITION.minScale)
      .max(SUBTITLE_POSITION.maxScale)
      .optional(),
    subtitleAlign: subtitleAlignSchema.optional(),
    image: imageAdjustmentsSchema.optional(),
    audio: audioSettingsSchema.optional(),
    subtitleStyle: subtitleStyleSchema.optional(),
    openingCaptionSettings: openingCaptionSettingsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Укажите хотя бы одно изменяемое поле.",
  });

export const validationIssueSchema = z
  .object({
    code: z.string().min(1),
    path: z.string(),
    message: z.string().min(1),
    clipIndex: z.number().int().nonnegative().optional(),
    relatedClipIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export const clipsValidationResultSchema = z
  .object({
    valid: z.boolean(),
    preview: normalizedAiResponseSchema.nullable(),
    errors: z.array(validationIssueSchema),
    warnings: z.array(validationIssueSchema),
  })
  .strict();

export const clipSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string(),
    start: z.number(),
    end: z.number(),
    hookScore: z.number().int().min(1).max(10),
    reason: z.string(),
    openingCaption: z.string(),
    segmentIds: z.array(z.number().int().nonnegative()),
    ranges: z.array(
      z.object({
        id: z.uuid(),
        rangeOrder: z.number().int().nonnegative(),
        start: z.number().nonnegative(),
        end: z.number().positive(),
        transition: rangeTransitionSchema,
        segmentIds: z.array(z.number().int().nonnegative()),
      }),
    ),
    enabled: z.boolean(),
    cropMode: z.enum(["fill", "fit"]),
    cropX: z.number().min(0).max(100),
    cropY: z.number().min(0).max(100),
    zoom: z.number().min(1).max(1.5),
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
    image: imageAdjustmentsSchema,
    audio: audioSettingsSchema,
    subtitleStyle: subtitleStyleSchema,
    openingCaptionSettings: openingCaptionSettingsSchema,
    renderStatus: z.enum([
      "idle",
      "queued",
      "rendering",
      "completed",
      "failed",
    ]),
    renderProgress: z.number().int().min(0).max(100),
    renderError: z.string().nullable(),
    outputFileName: z.string().nullable(),
    renderedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const clipListSchema = z.array(clipSchema);

export type AiPackageRequest = z.infer<typeof aiPackageRequestSchema>;
export type AiPackageMetadata = z.infer<typeof aiPackageMetadataSchema>;
export type AiPackagePrompt = z.infer<typeof aiPackagePromptSchema>;
export type ClipSuggestion = z.infer<typeof clipSuggestionSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AiResponseV2 = z.infer<typeof aiResponseV2Schema>;
export type ClipsImportInput = z.infer<typeof clipsImportSchema>;
export type ClipUpdateInput = z.infer<typeof clipUpdateSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ClipsValidationResult = z.infer<typeof clipsValidationResultSchema>;
export type ClipDto = z.infer<typeof clipSchema>;
