import { z } from "zod";

export const subtitleCueSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1),
});

export const verticalClipPropsSchema = z.object({
  videoFileName: z.string().min(1),
  durationSeconds: z.number().positive(),
  fps: z.number().positive().default(30),
  openingCaption: z.string(),
  cues: z.array(subtitleCueSchema),
});

export type SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type VerticalClipProps = z.infer<typeof verticalClipPropsSchema>;
