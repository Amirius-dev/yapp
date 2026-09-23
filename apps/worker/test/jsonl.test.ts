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

  it("rejects invalid progress", () => {
    expect(() =>
      parseRunnerLine(JSON.stringify({ type: "progress", progress: 101 })),
    ).toThrow();
  });
});
