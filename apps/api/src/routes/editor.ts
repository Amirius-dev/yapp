import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  editorPresetCreateSchema,
  editorSaveSchema,
  projectParamsSchema,
} from "@studio/contracts";
import { maxMusicUploadBytes, projectsRoot } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import type { EditorRepository } from "../repositories/editor.js";
import {
  prepareMusicDestination,
  validateMusicUpload,
} from "../services/project-files.js";
import { sendMedia } from "../services/media.js";

const editorParamsSchema = projectParamsSchema.extend({ clipId: z.uuid() });
const presetParamsSchema = z.object({ presetId: z.uuid() });
const musicParamsSchema = projectParamsSchema.extend({
  fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/u),
});
const musicMimeTypes: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

export async function registerEditorRoutes(
  app: FastifyInstance,
  repository: EditorRepository,
) {
  app.get("/api/projects/:id/clips/:clipId/editor", async (request) => {
    const params = editorParamsSchema.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "Некорректный editor URL.");
    return repository.getState(params.data.id, params.data.clipId);
  });

  app.put("/api/projects/:id/clips/:clipId/editor", async (request) => {
    const params = editorParamsSchema.safeParse(request.params);
    const input = editorSaveSchema.safeParse(request.body);
    if (!params.success || !input.success)
      throw new HttpError(400, "Проверьте timeline и keyframes.");
    return repository.save(params.data.id, params.data.clipId, input.data);
  });

  app.post("/api/projects/:id/clips/:clipId/music", async (request, reply) => {
    const params = editorParamsSchema.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "Некорректный URL музыки.");
    await repository.getState(params.data.id, params.data.clipId);
    const part = await request.file({
      limits: { files: 1, fields: 0, fileSize: maxMusicUploadBytes },
    });
    if (!part) throw new HttpError(400, "Добавьте аудиофайл в поле file.");
    let upload: ReturnType<typeof validateMusicUpload>;
    try {
      upload = validateMusicUpload(part.filename, part.mimetype);
    } catch (error) {
      part.file.resume();
      throw error;
    }
    const destination = await prepareMusicDestination(
      params.data.id,
      upload.extension,
    );
    const temporaryPath = `${destination.absolutePath}.${randomUUID()}.upload`;
    try {
      await pipeline(
        part.file,
        createWriteStream(temporaryPath, { flags: "wx" }),
      );
      if (part.file.truncated)
        throw new HttpError(413, "Музыкальный файл превышает 200 МБ.");
      await rename(temporaryPath, destination.absolutePath);
      return reply.status(201).send({
        fileName: destination.fileName,
        originalName: upload.originalName,
        mimeType: part.mimetype,
        mediaUrl: `/api/projects/${params.data.id}/music/${destination.fileName}`,
      });
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  });

  app.get("/api/projects/:id/music/:fileName", async (request, reply) => {
    const params = musicParamsSchema.safeParse(request.params);
    if (
      !params.success ||
      basename(params.data.fileName) !== params.data.fileName
    )
      throw new HttpError(400, "Некорректное имя музыкального файла.");
    return sendMedia(
      request,
      reply,
      join(projectsRoot, params.data.id, "music", params.data.fileName),
      { mimeType: musicMimeTypes[extname(params.data.fileName).toLowerCase()] },
    );
  });

  app.get("/api/editor/presets", async () => repository.listPresets());

  app.post("/api/editor/presets", async (request, reply) => {
    const input = editorPresetCreateSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "Проверьте данные preset.");
    return reply.status(201).send(await repository.createPreset(input.data));
  });

  app.delete("/api/editor/presets/:presetId", async (request, reply) => {
    const params = presetParamsSchema.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "Некорректный preset ID.");
    await repository.deletePreset(params.data.presetId);
    return reply.status(204).send();
  });
}
