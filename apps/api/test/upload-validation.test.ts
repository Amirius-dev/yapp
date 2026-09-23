import { describe, expect, it } from "vitest";
import { validateVideoUpload } from "../src/services/project-files.js";

describe("validateVideoUpload", () => {
  it.each([
    ["clip.mp4", "video/mp4", ".mp4"],
    ["clip.MOV", "video/quicktime", ".mov"],
    ["clip.webm", "video/webm", ".webm"],
    ["clip.mkv", "video/x-matroska", ".mkv"],
  ])("accepts %s with matching MIME type", (filename, mimeType, extension) => {
    expect(validateVideoUpload(filename, mimeType)).toEqual({
      originalName: filename,
      extension,
    });
  });

  it("rejects unsupported extensions", () => {
    expect(() => validateVideoUpload("clip.avi", "video/x-msvideo")).toThrow(
      "Поддерживаются только",
    );
  });

  it("rejects a MIME type that does not match the extension", () => {
    expect(() => validateVideoUpload("clip.mp4", "text/plain")).toThrow(
      "не соответствует расширению",
    );
  });

  it("drops path components from the client filename", () => {
    expect(
      validateVideoUpload("../../clip.mp4", "video/mp4").originalName,
    ).toBe("clip.mp4");
  });
});
