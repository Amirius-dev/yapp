import { createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { createProjectSchema, projectParamsSchema } from "@studio/contracts";
import { ffprobePath } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import type { ProjectsRepository } from "../repositories/projects.js";
import { probeVideo } from "../services/ffprobe.js";
import { deleteProjectSafely } from "../services/project-deletion.js";
import {
  prepareSourceDestination,
  validateVideoUpload,
} from "../services/project-files.js";

type RouteDependencies = {
  repository: ProjectsRepository;
  probe?: typeof probeVideo;
};

function parseProjectId(params: unknown) {
  const result = projectParamsSchema.safeParse(params);
  if (!result.success)
    throw new HttpError(400, "Некорректный идентификатор проекта.");
  return result.data.id;
}

export async function registerProjectRoutes(
  app: FastifyInstance,
  { repository, probe = probeVideo }: RouteDependencies,
) {
  app.post("/api/projects", async (request, reply) => {
    const result = createProjectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: "Проверьте данные проекта.",
        details: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const project = await repository.create({
      id: randomUUID(),
      name: result.data.name,
    });
    return reply.status(201).send(project);
  });

  app.get("/api/projects", async () => repository.list());

  app.get("/api/projects/:id", async (request) => {
    const id = parseProjectId(request.params);
    const project = await repository.findById(id);
    if (!project) throw new HttpError(404, "Проект не найден.");
    return project;
  });

  app.delete("/api/projects/:id", async (request, reply) => {
    const id = parseProjectId(request.params);
    await deleteProjectSafely(id, repository);
    return reply.status(204).send();
  });

  app.post("/api/projects/:id/source", async (request, reply) => {
    const id = parseProjectId(request.params);
    const project = await repository.findById(id);
    if (!project) throw new HttpError(404, "Проект не найден.");
    if (await repository.hasSource(id)) {
      throw new HttpError(
        409,
        "Исходное видео уже загружено для этого проекта.",
      );
    }

    const part = await request.file();
    if (!part) throw new HttpError(400, "Добавьте видео в поле file.");

    let upload: ReturnType<typeof validateVideoUpload>;
    try {
      upload = validateVideoUpload(part.filename, part.mimetype);
    } catch (error) {
      part.file.resume();
      throw error;
    }

    const destination = await prepareSourceDestination(id, upload.extension);
    const temporaryPath = `${destination.absolutePath}.${randomUUID()}.upload`;
    let processingStarted = false;

    try {
      await repository.setStatus(id, "uploading");
      processingStarted = true;
      await pipeline(
        part.file,
        createWriteStream(temporaryPath, { flags: "wx" }),
      );
      if (part.file.truncated) {
        throw new HttpError(413, "Видеофайл превышает допустимый размер.");
      }

      const fileStats = await stat(temporaryPath);
      await repository.setStatus(id, "probing");
      const mediaInfo = await probe(temporaryPath, fileStats.size, ffprobePath);
      await rename(temporaryPath, destination.absolutePath);

      const updated = await repository.attachSource(
        id,
        {
          relativePath: destination.relativePath,
          originalName: upload.originalName,
          mimeType: part.mimetype,
        },
        mediaInfo,
      );
      return reply.status(200).send(updated);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      if (processingStarted) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось обработать видео.";
        await repository.setStatus(id, "failed", message);
      }
      throw error;
    }
  });
}
