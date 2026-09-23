import { mkdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { projectsRoot, dataRoot } from "../config.js";
import { HttpError } from "../lib/http-error.js";

const allowedTypes = new Map([
  [".mp4", new Set(["video/mp4"])],
  [".mov", new Set(["video/quicktime"])],
  [".webm", new Set(["video/webm"])],
  [".mkv", new Set(["video/x-matroska", "video/matroska"])],
]);

export function validateVideoUpload(filename: string, mimeType: string) {
  const safeName = basename(filename);
  const extension = extname(safeName).toLowerCase();
  const mimeTypes = allowedTypes.get(extension);

  if (!mimeTypes) {
    throw new HttpError(
      415,
      "Поддерживаются только MP4, MOV, WebM и MKV файлы.",
    );
  }
  if (!mimeTypes.has(mimeType.toLowerCase())) {
    throw new HttpError(
      415,
      `MIME-тип ${mimeType || "не указан"} не соответствует расширению ${extension}.`,
    );
  }

  return { originalName: safeName, extension };
}

export async function prepareSourceDestination(
  projectId: string,
  extension: string,
) {
  const sourceDirectory = join(projectsRoot, projectId, "source");
  await mkdir(sourceDirectory, { recursive: true });
  const absolutePath = join(sourceDirectory, `source${extension}`);
  return {
    absolutePath,
    relativePath: relative(dataRoot, absolutePath),
  };
}
