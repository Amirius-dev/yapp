import type { FastifyInstance } from "fastify";
import { projectParamsSchema } from "@studio/contracts";
import { HttpError } from "../lib/http-error.js";
import type { TranscriptionRepository } from "../repositories/transcription.js";

function projectIdFrom(params: unknown) {
  const parsed = projectParamsSchema.safeParse(params);
  if (!parsed.success)
    throw new HttpError(400, "Некорректный идентификатор проекта.");
  return parsed.data.id;
}

export async function registerTranscriptionRoutes(
  app: FastifyInstance,
  repository: TranscriptionRepository,
) {
  app.post("/api/projects/:id/transcription", async (request, reply) => {
    const result = await repository.enqueue(projectIdFrom(request.params));
    return reply.status(result.created ? 202 : 200).send(result.job);
  });

  app.post(
    "/api/projects/:id/transcription/regenerate",
    async (request, reply) => {
      const result = await repository.enqueue(projectIdFrom(request.params), {
        regenerate: true,
      });
      return reply.status(result.created ? 202 : 200).send(result.job);
    },
  );

  app.get("/api/projects/:id/transcript", async (request) =>
    repository.getTranscript(projectIdFrom(request.params)),
  );

  app.get("/api/projects/:id/jobs", async (request) =>
    repository.listJobs(projectIdFrom(request.params)),
  );
}
