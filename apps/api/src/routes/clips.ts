import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  aiPackageRequestSchema,
  clipUpdateSchema,
  clipsImportSchema,
  projectParamsSchema,
} from "@studio/contracts";
import { HttpError } from "../lib/http-error.js";
import type { ClipsRepository } from "../repositories/clips.js";
import { createAiPackage } from "../services/ai-package.js";
import { validateClipsContent } from "../services/clip-validation.js";

const clipParamsSchema = projectParamsSchema.extend({ clipId: z.uuid() });

function projectIdFrom(params: unknown) {
  const parsed = projectParamsSchema.safeParse(params);
  if (!parsed.success)
    throw new HttpError(400, "Некорректный идентификатор проекта.");
  return parsed.data.id;
}

function importContentFrom(body: unknown) {
  const parsed = clipsImportSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Добавьте JSON от AI.");
  return parsed.data.content;
}

export async function registerClipRoutes(
  app: FastifyInstance,
  repository: ClipsRepository,
) {
  app.post("/api/projects/:id/ai-package", async (request, reply) => {
    const projectId = projectIdFrom(request.params);
    const input = aiPackageRequestSchema.safeParse(request.body ?? {});
    if (!input.success)
      throw new HttpError(400, "Некорректный формат AI-пакета.");
    const context = await repository.getContext(projectId);
    const output = createAiPackage(context);
    await repository.markWaitingForAi(projectId);
    if (input.data.format === "prompt") {
      return {
        metadata: context.metadata,
        prompt: output.prompt,
        files: output.files,
      };
    }
    const safeName = context.metadata.projectName
      .replace(/[^a-z0-9_-]+/giu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return reply
      .header("content-type", "application/zip")
      .header(
        "content-disposition",
        `attachment; filename="${safeName || context.metadata.projectId}-ai-package.zip"`,
      )
      .send(Buffer.from(output.zip));
  });

  app.post("/api/projects/:id/clips/validate", async (request) => {
    const projectId = projectIdFrom(request.params);
    const content = importContentFrom(request.body);
    const context = await repository.getContext(projectId);
    return validateClipsContent(content, {
      projectId,
      durationSeconds: context.metadata.durationSeconds,
      segments: context.segments,
    });
  });

  app.post("/api/projects/:id/clips/import", async (request, reply) => {
    const projectId = projectIdFrom(request.params);
    const content = importContentFrom(request.body);
    const context = await repository.getContext(projectId);
    const validation = validateClipsContent(content, {
      projectId,
      durationSeconds: context.metadata.durationSeconds,
      segments: context.segments,
    });
    if (!validation.valid || !validation.preview) {
      return reply.status(422).send(validation);
    }
    return repository.import(projectId, validation.preview);
  });

  app.get("/api/projects/:id/clips", async (request) =>
    repository.list(projectIdFrom(request.params)),
  );

  app.patch("/api/projects/:id/clips/:clipId", async (request) => {
    const params = clipParamsSchema.safeParse(request.params);
    if (!params.success)
      throw new HttpError(400, "Некорректный идентификатор clip.");
    const patch = clipUpdateSchema.safeParse(request.body);
    if (!patch.success)
      throw new HttpError(400, "Проверьте изменённые поля clip.");
    return repository.update(params.data.id, params.data.clipId, patch.data);
  });
}
