import { z } from "zod";

export const projectStatusSchema = z.enum([
  "created",
  "uploading",
  "probing",
  "ready_for_transcription",
  "transcribing",
  "ready_for_ai",
  "waiting_for_ai_result",
  "reviewing_clips",
  "rendering",
  "completed",
  "failed",
]);

export const projectModeSchema = z.literal("long_video_to_shorts");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Введите название проекта").max(120),
  mode: projectModeSchema.default("long_video_to_shorts"),
});

export const projectParamsSchema = z.object({
  id: z.uuid("Некорректный идентификатор проекта"),
});

export const mediaInfoSchema = z.object({
  durationSeconds: z.number().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  fileSizeBytes: z.number().int().nonnegative(),
  hasAudio: z.boolean(),
});

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mode: projectModeSchema,
  status: projectStatusSchema,
  sourceFileName: z.string().nullable(),
  sourceMimeType: z.string().nullable(),
  language: z.string().nullable(),
  mediaInfo: mediaInfoSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  errorMessage: z.string().nullable(),
});

export const projectListSchema = z.array(projectSchema);

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectMode = z.infer<typeof projectModeSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type MediaInfo = z.infer<typeof mediaInfoSchema>;
export type ProjectDto = z.infer<typeof projectSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
