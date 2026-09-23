import type { SubtitleCue } from "./schema.js";

export type TimedTranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

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
        });
      }
    }
  }
  return cues;
}
