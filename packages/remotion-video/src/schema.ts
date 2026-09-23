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
  cropMode: z.enum(["fill", "fit"]),
  cropX: z.number().min(0).max(100),
  cropY: z.number().min(0).max(100),
  zoom: z.number().min(1).max(1.5),
  subtitleX: z.number().min(15).max(85),
  subtitleY: z.number().min(18).max(84),
  subtitleScale: z.number().min(0.75).max(1.5),
  subtitleAlign: z.enum(["left", "center", "right"]),
  cues: z.array(subtitleCueSchema),
});

export type SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type VerticalClipProps = z.infer<typeof verticalClipPropsSchema>;
