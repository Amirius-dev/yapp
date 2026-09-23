import { stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { projectParamsSchema, renderRequestSchema } from "@studio/contracts";
import { projectsRoot } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import type { ClipsRepository } from "../repositories/clips.js";
import type { RenderRepository } from "../repositories/render.js";
import { resolveDataFile, sendMedia } from "../services/media.js";

const clipParamsSchema = projectParamsSchema.extend({ clipId: z.uuid() });
const mediaQuerySchema = z.object({ download: z.enum(["0", "1"]).optional() });

function projectIdFrom(params: unknown) {
  const parsed = projectParamsSchema.safeParse(params);
  if (!parsed.success)
    throw new HttpError(400, "Некорректный идентификатор проекта.");
  return parsed.data.id;
}

export async function registerRenderRoutes(
  app: FastifyInstance,
  renderRepository: RenderRepository,
  clipsRepository: ClipsRepository,
) {
  app.post("/api/projects/:id/render", async (request, reply) => {
    const id = projectIdFrom(request.params);
    const parsed = renderRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success)
      throw new HttpError(400, "Проверьте параметры рендера.");
    return reply.status(202).send(renderRepository.enqueue(id, parsed.data));
  });

  app.get("/api/projects/:id/results", async (request) => {
    const projectId = projectIdFrom(request.params);
    const allClips = await clipsRepository.list(projectId);
    const completed = allClips.filter(
      (clip) => clip.renderStatus === "completed" && clip.outputFileName,
    );
    const results = await Promise.all(
      completed.map(async (clip) => {
        const outputPath = join(
          projectsRoot,
          projectId,
          "outputs",
          clip.outputFileName!,
        );
        const info = await stat(outputPath);
        const mediaUrl = `/api/projects/${projectId}/clips/${clip.id}/media`;
        return {
          clip,
          durationSeconds: clip.end - clip.start,
          fileSizeBytes: info.size,
          mediaUrl,
          downloadUrl: `${mediaUrl}?download=1`,
        };
      }),
    );
    return {
      projectId,
      job: await renderRepository.latestJob(projectId),
      clips: allClips,
      results,
    };
  });

  app.get("/api/projects/:id/source/media", async (request, reply) => {
    const projectId = projectIdFrom(request.params);
    const source = await renderRepository.projectSource(projectId);
    return sendMedia(request, reply, resolveDataFile(source.path), {
      mimeType: source.mimeType,
    });
  });

  app.get("/api/projects/:id/clips/:clipId/media", async (request, reply) => {
    const params = clipParamsSchema.safeParse(request.params);
    const query = mediaQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      throw new HttpError(400, "Некорректный запрос медиафайла.");
    const fileName = await renderRepository.clipOutput(
      params.data.id,
      params.data.clipId,
    );
    if (
      basename(fileName) !== fileName ||
      fileName !== `${params.data.clipId}.mp4`
    )
      throw new HttpError(400, "Некорректное имя готового файла.");
    return sendMedia(
      request,
      reply,
      join(projectsRoot, params.data.id, "outputs", fileName),
      { download: query.data.download === "1" },
    );
  });
}
