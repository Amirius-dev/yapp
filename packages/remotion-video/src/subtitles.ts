import type { SubtitleCue } from "./schema.js";
import { buildTimeline, type TimelineRange } from "@studio/contracts/timeline";

export type TimedTranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TimedTranscriptWord = TimedTranscriptSegment;
export type SubtitleRange = TimelineRange;

function splitWords(words: string[], maxWords: number) {
  const partCount = Math.ceil(words.length / maxWords);
  const baseSize = Math.floor(words.length / partCount);
  const largerParts = words.length % partCount;
  const parts: string[][] = [];
  let offset = 0;
  for (let index = 0; index < partCount; index += 1) {
    const size = baseSize + (index < largerParts ? 1 : 0);
    parts.push(words.slice(offset, offset + size));
    offset += size;
  }
  return parts;
}

export function buildSubtitleCues(
  segments: TimedTranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  maxWords = 6,
): SubtitleCue[] {
  const duration = Math.max(0, clipEnd - clipStart);
  if (duration === 0) return [];
  const cues: SubtitleCue[] = [];
  for (const segment of segments) {
    const absoluteStart = Math.max(clipStart, segment.startSeconds);
    const absoluteEnd = Math.min(clipEnd, segment.endSeconds);
    if (absoluteEnd <= absoluteStart) continue;
    const words = segment.text.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) continue;
    const phrases = splitWords(words, Math.max(4, Math.min(6, maxWords)));
    let consumed = 0;
    for (const phrase of phrases) {
      const start =
        absoluteStart +
        ((absoluteEnd - absoluteStart) * consumed) / words.length;
      consumed += phrase.length;
      const end =
        absoluteStart +
        ((absoluteEnd - absoluteStart) * consumed) / words.length;
      const relativeStart = Math.max(0, Math.min(duration, start - clipStart));
      const relativeEnd = Math.max(
        relativeStart,
        Math.min(duration, end - clipStart),
      );
      const text = phrase.join(" ").trim();
      if (text && relativeEnd > relativeStart) {
        cues.push({
          startSeconds: relativeStart,
          endSeconds: relativeEnd,
          text,
          words: [],
        });
      }
    }
  }
  return cues;
}

export function buildTimelineSubtitleCues(
  ranges: SubtitleRange[],
  segments: TimedTranscriptSegment[],
  words: TimedTranscriptWord[],
  maxWords = 6,
): SubtitleCue[] {
  const result: SubtitleCue[] = [];
  for (const range of buildTimeline(ranges)) {
    const outputOffset = range.outputStart;
    const visibleOutputEnd = range.outputEnd - range.transitionOutDuration;
    const rangeWords = words.filter(
      (word) => word.endSeconds > range.start && word.startSeconds < range.end,
    );
    if (rangeWords.length) {
      for (let index = 0; index < rangeWords.length; index += maxWords) {
        const group = rangeWords.slice(index, index + maxWords);
        const mappedWords = group
          .map((word) => ({
            startSeconds:
              outputOffset +
              Math.max(range.start, word.startSeconds) -
              range.start,
            endSeconds: Math.min(
              visibleOutputEnd,
              outputOffset + Math.min(range.end, word.endSeconds) - range.start,
            ),
            text: word.text.trim(),
          }))
          .filter((word) => word.text && word.endSeconds > word.startSeconds);
        if (mappedWords.length)
          result.push({
            startSeconds: mappedWords[0]!.startSeconds,
            endSeconds: mappedWords.at(-1)!.endSeconds,
            text: mappedWords.map((word) => word.text).join(" "),
            words: mappedWords,
          });
      }
    } else {
      result.push(
        ...buildSubtitleCues(segments, range.start, range.end, maxWords)
          .map((cue) => ({
            ...cue,
            startSeconds: cue.startSeconds + outputOffset,
            endSeconds: Math.min(
              visibleOutputEnd,
              cue.endSeconds + outputOffset,
            ),
          }))
          .filter((cue) => cue.endSeconds > cue.startSeconds),
      );
    }
  }
  return result;
}
