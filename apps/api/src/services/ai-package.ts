import { strToU8, zipSync } from "fflate";
import type { AiPackageMetadata } from "@studio/contracts";
import { AI_PROMPT } from "../templates/ai-prompt.js";

export type AiPackageContext = {
  metadata: AiPackageMetadata;
  segments: Array<{ id: number; start: number; end: number; text: string }>;
};

export const CLIPS_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Clip suggestions",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "projectId", "clips"],
  properties: {
    schemaVersion: { const: 1 },
    projectId: { type: "string", minLength: 1 },
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "start",
          "end",
          "hookScore",
          "reason",
          "openingCaption",
          "segmentIds",
        ],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 160 },
          start: { type: "number" },
          end: { type: "number" },
          hookScore: { type: "integer", minimum: 1, maximum: 10 },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
          openingCaption: { type: "string", minLength: 1, maxLength: 300 },
          segmentIds: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },
} as const;

export function createAiPackage(context: AiPackageContext) {
  const transcript = {
    schemaVersion: 1,
    projectId: context.metadata.projectId,
    language: context.metadata.language,
    durationSeconds: context.metadata.durationSeconds,
    segments: context.segments,
  };
  const files = {
    "AI_PROMPT.md": strToU8(AI_PROMPT),
    "transcript.json": strToU8(JSON.stringify(transcript, null, 2)),
    "clips.schema.json": strToU8(JSON.stringify(CLIPS_JSON_SCHEMA, null, 2)),
    "project-context.json": strToU8(JSON.stringify(context.metadata, null, 2)),
  };
  return {
    prompt: AI_PROMPT,
    zip: zipSync(files, { level: 6 }),
    files: [
      "AI_PROMPT.md",
      "transcript.json",
      "clips.schema.json",
      "project-context.json",
    ] as const,
  };
}
