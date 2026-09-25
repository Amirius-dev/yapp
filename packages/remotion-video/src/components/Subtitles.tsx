import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleCue } from "../schema";
import {
  interpolateSubtitle,
  outputToSourceTime,
} from "@studio/contracts/timeline";
import { VIDEO_TEMPLATES } from "@studio/contracts/templates";
import type { SubtitleStyle } from "@studio/contracts";

function colorWithOpacity(hex: string, opacity: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export const SUBTITLE_LAYOUT = {
  topPercent: 72,
  maxWidth: 918,
  horizontalInset: 81,
  fontSize: 64,
  lineHeight: 1.08,
} as const;

export function Subtitles({
  cues,
  hiddenUntil = 0,
  x,
  y,
  scale,
  align,
  ranges,
  keyframes,
  templateId,
  accentColor,
  style,
}: {
  cues: SubtitleCue[];
  hiddenUntil?: number;
  x: number;
  y: number;
  scale: number;
  align: "left" | "center" | "right";
  ranges: Array<{ id: string; start: number; end: number }>;
  keyframes: Array<{
    rangeId: string;
    sourceTimeSeconds: number;
    subtitleX: number;
    subtitleY: number;
    subtitleScale: number;
    subtitleAlign: "left" | "center" | "right";
    transition: "hold" | "smooth";
  }>;
  templateId: "clean" | "motivational" | "podcast";
  accentColor: string;
  style: SubtitleStyle;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const cue =
    time < hiddenUntil
      ? undefined
      : cues.find(
          (item) => time >= item.startSeconds && time < item.endSeconds,
        );
  if (!cue) return null;
  const mapped = outputToSourceTime(ranges, time);
  const animated = mapped
    ? interpolateSubtitle(keyframes, mapped.rangeId, mapped.sourceTime, {
        subtitleX: x,
        subtitleY: y,
        subtitleScale: scale,
        subtitleAlign: align,
      })
    : {
        subtitleX: x,
        subtitleY: y,
        subtitleScale: scale,
        subtitleAlign: align,
      };
  x = animated.subtitleX;
  y = animated.subtitleY;
  scale = animated.subtitleScale;
  align = animated.subtitleAlign;
  const template = VIDEO_TEMPLATES[templateId];
  const cueProgress = Math.min(
    1,
    Math.max(0, (time - cue.startSeconds) / 0.14),
  );
  const entranceScale =
    style.animation === "pop" ? 0.88 + cueProgress * 0.12 : 1;
  const entranceOpacity = style.animation === "none" ? 1 : cueProgress;
  const position = {
    x: Math.min(85, Math.max(15, x)),
    y: Math.min(84, Math.max(18, y)),
  };
  const widthPercent =
    Math.min(85, 2 * Math.min(position.x - 5, 95 - position.x)) / scale;
  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${widthPercent}%`,
        transform: `translate(-50%, -50%) scale(${scale * entranceScale})`,
        opacity: entranceOpacity,
        display: "flex",
        justifyContent:
          align === "left"
            ? "flex-start"
            : align === "right"
              ? "flex-end"
              : "center",
        textAlign: align,
      }}
    >
      <span
        style={{
          color: style.textColor,
          padding: `${style.paddingVertical}px ${style.paddingHorizontal}px`,
          fontFamily: `${style.fontFamily}, sans-serif`,
          fontWeight: style.fontWeight,
          fontSize: template.fontSize,
          lineHeight: SUBTITLE_LAYOUT.lineHeight,
          maxWidth: SUBTITLE_LAYOUT.maxWidth,
          overflowWrap: "anywhere",
          display: "-webkit-box",
          WebkitLineClamp: style.maxLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textTransform: style.uppercase ? "uppercase" : "none",
          backgroundColor: colorWithOpacity(
            style.backgroundColor,
            style.backgroundOpacity,
          ),
          borderRadius: style.borderRadius,
          WebkitTextStroke: `${style.outlineWidth}px ${style.outlineColor}`,
          paintOrder: "stroke fill",
          textShadow: style.shadow ? "0 6px 16px rgba(0,0,0,0.72)" : "none",
        }}
      >
        {cue.words.length
          ? cue.words.map((word, index) => (
              <span
                key={`${word.startSeconds}-${index}`}
                style={{
                  color:
                    time >= word.startSeconds && time < word.endSeconds
                      ? style.activeWordColor || accentColor
                      : style.textColor,
                }}
              >
                {word.text}{" "}
              </span>
            ))
          : cue.text}
      </span>
    </div>
  );
}
