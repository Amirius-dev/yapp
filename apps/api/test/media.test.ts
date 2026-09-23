import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/http-error.js";
import { parseByteRange, resolveDataFile } from "../src/services/media.js";

describe("media range", () => {
  it("parses open, bounded and suffix ranges", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("rejects unavailable ranges", () => {
    expect(() => parseByteRange("bytes=100-", 100)).toThrow(HttpError);
    expect(() => parseByteRange("items=0-1", 100)).toThrow(HttpError);
  });

  it("keeps media paths inside the data directory", () => {
    expect(() => resolveDataFile("../secret.mp4")).toThrow(HttpError);
  });
});
