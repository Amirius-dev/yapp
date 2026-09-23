import { z } from "zod";
import { clipSchema } from "./clips.js";
import { jobSchema } from "./transcription.js";

export const renderRequestSchema = z
  .object({
    clipIds: z.array(z.uuid()).min(1).optional(),
    force: z.boolean().optional(),
  })
  .strict();

export const renderResultSchema = z
  .object({
    clip: clipSchema,
    durationSeconds: z.number().positive(),
    fileSizeBytes: z.number().int().positive(),
    mediaUrl: z.string(),
    downloadUrl: z.string(),
  })
  .strict();

export const renderResultsSchema = z
  .object({
    projectId: z.uuid(),
    job: jobSchema.nullable(),
    clips: z.array(clipSchema),
    results: z.array(renderResultSchema),
  })
  .strict();

export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type RenderResultDto = z.infer<typeof renderResultSchema>;
export type RenderResultsDto = z.infer<typeof renderResultsSchema>;
