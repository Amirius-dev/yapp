import { z } from "zod";

export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
]);
export const jobTypeSchema = z.enum(["transcription", "render_clips"]);

export const jobSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  type: jobTypeSchema,
  status: jobStatusSchema,
  progress: z.number().int().min(0).max(100),
  model: z.string().min(1).nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});

export const jobListSchema = z.array(jobSchema);

export const transcriptSegmentSchema = z.object({
  id: z.uuid(),
  segmentIndex: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1),
});

export const transcriptSchema = z.object({
  projectId: z.uuid(),
  language: z.string().nullable(),
  durationSeconds: z.number().nonnegative(),
  segments: z.array(transcriptSegmentSchema),
});

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobDto = z.infer<typeof jobSchema>;
export type TranscriptSegmentDto = z.infer<typeof transcriptSegmentSchema>;
export type TranscriptDto = z.infer<typeof transcriptSchema>;
