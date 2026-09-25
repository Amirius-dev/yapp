import { randomUUID } from "node:crypto";
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

const allowedMusicTypes = new Map([
  [".mp3", new Set(["audio/mpeg"])],
  [".wav", new Set(["audio/wav", "audio/x-wav"])],
  [".m4a", new Set(["audio/mp4", "audio/x-m4a"])],
  [".aac", new Set(["audio/aac"])],
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

export function validateMusicUpload(filename: string, mimeType: string) {
  const safeName = basename(filename);
  const extension = extname(safeName).toLowerCase();
  const mimeTypes = allowedMusicTypes.get(extension);
  if (!mimeTypes)
    throw new HttpError(415, "Поддерживаются MP3, WAV, M4A и AAC.");
  if (!mimeTypes.has(mimeType.toLowerCase()))
    throw new HttpError(
      415,
      `MIME-тип ${mimeType || "не указан"} не соответствует расширению ${extension}.`,
    );
  return { originalName: safeName, extension };
}

export async function prepareMusicDestination(
  projectId: string,
  extension: string,
) {
  const directory = join(projectsRoot, projectId, "music");
  await mkdir(directory, { recursive: true });
  const fileName = `${randomUUID()}${extension}`;
  const absolutePath = join(directory, fileName);
  return { absolutePath, fileName };
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
