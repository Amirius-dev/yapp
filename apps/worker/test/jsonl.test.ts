import { describe, expect, it } from "vitest";
import { parseRunnerLine } from "../src/jsonl.js";

describe("parseRunnerLine", () => {
  it("parses a valid segment event", () => {
    expect(
      parseRunnerLine(
        JSON.stringify({
          type: "segment",
          index: 2,
          start: 1.25,
          end: 3.5,
          text: "Проверка сегмента",
        }),
      ),
    ).toEqual({
      type: "segment",
      index: 2,
      start: 1.25,
      end: 3.5,
      text: "Проверка сегмента",
    });
  });

  it("rejects diagnostics mixed into stdout", () => {
    expect(() => parseRunnerLine("loading model...")).toThrow(
      "Python runner нарушил JSON Lines протокол",
    );
  });

  it("parses a word timestamp event", () => {
    expect(
      parseRunnerLine(
        JSON.stringify({
          type: "word",
          segmentIndex: 12,
          wordIndex: 3,
          start: 42.15,
          end: 42.61,
          text: "discipline",
          probability: 0.96,
        }),
      ),
    ).toMatchObject({ type: "word", wordIndex: 3, probability: 0.96 });
  });

  it("rejects invalid progress", () => {
    expect(() =>
      parseRunnerLine(JSON.stringify({ type: "progress", progress: 101 })),
    ).toThrow();
  });
});
