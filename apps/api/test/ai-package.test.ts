import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createAiPackage } from "../src/services/ai-package.js";

describe("createAiPackage", () => {
  it("creates the four provider-neutral files with absolute timestamps", () => {
    const result = createAiPackage({
      metadata: {
        schemaVersion: 2,
        projectId: "11111111-1111-4111-8111-111111111111",
        projectName: "Test",
        language: "en",
        durationSeconds: 60,
        segmentCount: 1,
        generatedAt: "2026-09-23T10:00:00.000Z",
      },
      segments: [{ id: 7, start: 20.5, end: 31.25, text: "Real transcript" }],
    });
    const files = unzipSync(result.zip);
    expect(Object.keys(files).sort()).toEqual(
      [
        "AI_PROMPT.md",
        "clips.schema.json",
        "project-context.json",
        "transcript.json",
      ].sort(),
    );
    const transcript = JSON.parse(strFromU8(files["transcript.json"]!));
    const schema = JSON.parse(strFromU8(files["clips.schema.json"]!));
    const context = JSON.parse(strFromU8(files["project-context.json"]!));
    const prompt = strFromU8(files["AI_PROMPT.md"]!);
    expect(transcript).toMatchObject({
      projectId: "11111111-1111-4111-8111-111111111111",
      segments: [{ id: 7, start: 20.5, end: 31.25, text: "Real transcript" }],
    });
    expect(prompt).toContain("Return only one valid JSON object");
    expect(prompt).toContain("10–18, 240–252, and 500–510");
    expect(prompt).toContain("Single-range example");
    expect(prompt).toContain("Three-range example");
    expect(schema).toMatchObject({
      properties: { schemaVersion: { const: 2 } },
    });
    expect(context.schemaVersion).toBe(2);
    expect(context.projectId).toBe(transcript.projectId);
    expect(schema.properties.projectId.type).toBe("string");
  });
});
