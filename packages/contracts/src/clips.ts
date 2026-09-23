import { z } from "zod";

export const aiPackageRequestSchema = z
  .object({ format: z.enum(["zip", "prompt"]).default("zip") })
  .strict();

export const aiPackageMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
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

export const aiResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: z.string().min(1),
    clips: z.array(clipSuggestionSchema),
  })
  .strict();

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
    preview: aiResponseSchema.nullable(),
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
    enabled: z.boolean(),
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
export type ClipsImportInput = z.infer<typeof clipsImportSchema>;
export type ClipUpdateInput = z.infer<typeof clipUpdateSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ClipsValidationResult = z.infer<typeof clipsValidationResultSchema>;
export type ClipDto = z.infer<typeof clipSchema>;
