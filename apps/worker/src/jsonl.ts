import { z } from "zod";

const metadataEvent = z.object({
  type: z.literal("metadata"),
  language: z.string().min(1),
  durationSeconds: z.number().nonnegative(),
  model: z.string().min(1),
});
const segmentEvent = z.object({
  type: z.literal("segment"),
  index: z.number().int().nonnegative(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  text: z.string().trim().min(1),
});
const progressEvent = z.object({
  type: z.literal("progress"),
  progress: z.number().min(0).max(100),
});
const resultEvent = z.object({
  type: z.literal("result"),
  language: z.string().min(1),
  segmentCount: z.number().int().nonnegative(),
});
const errorEvent = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string().min(1),
});

export const runnerEventSchema = z.discriminatedUnion("type", [
  metadataEvent,
  segmentEvent,
  progressEvent,
  resultEvent,
  errorEvent,
]);
export type RunnerEvent = z.infer<typeof runnerEventSchema>;

export function parseRunnerLine(line: string): RunnerEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Python runner нарушил JSON Lines протокол.");
  }
  return runnerEventSchema.parse(value);
}
