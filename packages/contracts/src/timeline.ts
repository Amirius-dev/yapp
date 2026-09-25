import { z } from "zod";

export const rangeTransitionTypeSchema = z.enum([
  "hard-cut",
  "crossfade",
  "dip-to-black",
]);

export const rangeTransitionSchema = z
  .object({
    type: rangeTransitionTypeSchema.default("hard-cut"),
    durationSeconds: z.number().finite().min(0).max(1.5).default(0),
  })
  .strict();

export const timelineRangeSchema = z
  .object({
    id: z.string().min(1),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    transition: rangeTransitionSchema.optional(),
  })
  .strict();

export type TimelineRange = z.infer<typeof timelineRangeSchema>;
export type RangeTransition = z.infer<typeof rangeTransitionSchema>;

export type MappedTimelineRange = TimelineRange & {
  outputStart: number;
  outputEnd: number;
  duration: number;
  transitionOutDuration: number;
};

export function effectiveTransitionDuration(
  range: TimelineRange,
  nextRange?: TimelineRange,
) {
  if (!nextRange || !range.transition || range.transition.type === "hard-cut")
    return 0;
  const requested = range.transition.durationSeconds;
  const rangeDuration = Math.max(0, range.end - range.start);
  const nextDuration = Math.max(0, nextRange.end - nextRange.start);
  return Math.max(
    0,
    Math.min(requested, 1.5, rangeDuration / 2, nextDuration / 2),
  );
}

export function buildTimeline(ranges: readonly TimelineRange[]) {
  let cursor = 0;
  return ranges.map<MappedTimelineRange>((range, index) => {
    const duration = range.end - range.start;
    const transitionOutDuration = effectiveTransitionDuration(
      range,
      ranges[index + 1],
    );
    const mapped = {
      ...range,
      duration,
      outputStart: cursor,
      outputEnd: cursor + duration,
      transitionOutDuration,
    };
    cursor += duration - transitionOutDuration;
    return mapped;
  });
}

export function timelineDuration(ranges: readonly TimelineRange[]) {
  return buildTimeline(ranges).at(-1)?.outputEnd ?? 0;
}

export function outputToSourceTime(
  ranges: readonly TimelineRange[],
  outputTime: number,
) {
  const timeline = buildTimeline(ranges);
  if (!timeline.length) return null;
  const bounded = Math.max(0, Math.min(outputTime, timeline.at(-1)!.outputEnd));
  const range =
    [...timeline]
      .reverse()
      .find(
        (item, index) =>
          bounded >= item.outputStart &&
          (bounded < item.outputEnd || index === 0),
      ) ?? timeline.at(-1)!;
  return {
    rangeId: range.id,
    sourceTime: Math.min(range.end, range.start + bounded - range.outputStart),
  };
}

export function rangeLocalToOutputTime(
  ranges: readonly TimelineRange[],
  rangeId: string,
  localTime: number,
) {
  const range = buildTimeline(ranges).find((item) => item.id === rangeId);
  if (!range || localTime < 0 || localTime > range.duration) return null;
  return range.outputStart + localTime;
}

export function sourceToOutputTime(
  ranges: readonly TimelineRange[],
  rangeId: string,
  sourceTime: number,
) {
  const range = buildTimeline(ranges).find((item) => item.id === rangeId);
  if (!range || sourceTime < range.start || sourceTime > range.end) return null;
  return range.outputStart + sourceTime - range.start;
}

export function easingProgress(
  value: number,
  easing: "linear" | "ease-in-out" | "hold",
) {
  const progress = Math.max(0, Math.min(1, value));
  if (easing === "hold") return 0;
  if (easing === "ease-in-out") return progress * progress * (3 - 2 * progress);
  return progress;
}

type CropFrame = {
  rangeId: string;
  sourceTimeSeconds: number;
  cropX: number;
  cropY: number;
  zoom: number;
  easing: "linear" | "ease-in-out" | "hold";
};

export function interpolateCrop(
  keyframes: readonly CropFrame[],
  rangeId: string,
  sourceTime: number,
  fallback: Pick<CropFrame, "cropX" | "cropY" | "zoom">,
) {
  const frames = keyframes
    .filter((frame) => frame.rangeId === rangeId)
    .sort((a, b) => a.sourceTimeSeconds - b.sourceTimeSeconds);
  const previous = [...frames]
    .reverse()
    .find((frame) => frame.sourceTimeSeconds <= sourceTime);
  const next = frames.find((frame) => frame.sourceTimeSeconds > sourceTime);
  if (!previous) return frames[0] ?? fallback;
  if (!next) return previous;
  const progress = easingProgress(
    (sourceTime - previous.sourceTimeSeconds) /
      (next.sourceTimeSeconds - previous.sourceTimeSeconds),
    previous.easing,
  );
  return {
    cropX: previous.cropX + (next.cropX - previous.cropX) * progress,
    cropY: previous.cropY + (next.cropY - previous.cropY) * progress,
    zoom: previous.zoom + (next.zoom - previous.zoom) * progress,
  };
}

type SubtitleFrame = {
  rangeId: string;
  sourceTimeSeconds: number;
  subtitleX: number;
  subtitleY: number;
  subtitleScale: number;
  subtitleAlign: "left" | "center" | "right";
  transition: "hold" | "smooth";
};

export function interpolateSubtitle(
  keyframes: readonly SubtitleFrame[],
  rangeId: string,
  sourceTime: number,
  fallback: Omit<SubtitleFrame, "rangeId" | "sourceTimeSeconds" | "transition">,
) {
  const frames = keyframes
    .filter((frame) => frame.rangeId === rangeId)
    .sort((a, b) => a.sourceTimeSeconds - b.sourceTimeSeconds);
  const previous = [...frames]
    .reverse()
    .find((frame) => frame.sourceTimeSeconds <= sourceTime);
  const next = frames.find((frame) => frame.sourceTimeSeconds > sourceTime);
  if (!previous) return frames[0] ?? fallback;
  if (!next || previous.transition === "hold") return previous;
  const progress = Math.max(
    0,
    Math.min(
      1,
      (sourceTime - previous.sourceTimeSeconds) /
        (next.sourceTimeSeconds - previous.sourceTimeSeconds),
    ),
  );
  return {
    subtitleX:
      previous.subtitleX + (next.subtitleX - previous.subtitleX) * progress,
    subtitleY:
      previous.subtitleY + (next.subtitleY - previous.subtitleY) * progress,
    subtitleScale:
      previous.subtitleScale +
      (next.subtitleScale - previous.subtitleScale) * progress,
    subtitleAlign: progress < 0.5 ? previous.subtitleAlign : next.subtitleAlign,
  };
}
