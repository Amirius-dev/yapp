import type { SubtitleCue } from "./schema.js";

export type TimedTranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

function splitWords(words: string[], maxWords: number) {
  const parts: string[][] = [];
  for (let offset = 0; offset < words.length; offset += maxWords) {
    parts.push(words.slice(offset, offset + maxWords));
  }
  return parts;
}

export function buildSubtitleCues(
  segments: TimedTranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  maxWords = 7,
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
    const phrases = splitWords(words, Math.max(5, Math.min(8, maxWords)));
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
