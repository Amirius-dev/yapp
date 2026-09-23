import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { maxUploadBytes, whisperModel } from "./config.js";
import { createDatabase } from "./db/client.js";
import { HttpError } from "./lib/http-error.js";
import { createProjectsRepository } from "./repositories/projects.js";
import { createTranscriptionRepository } from "./repositories/transcription.js";
import { createClipsRepository } from "./repositories/clips.js";
import { createRenderRepository } from "./repositories/render.js";
import { registerClipRoutes } from "./routes/clips.js";
import { registerRenderRoutes } from "./routes/render.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerTranscriptionRoutes } from "./routes/transcription.js";

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
  const { db, sqlite } = createDatabase();
  const repository = createProjectsRepository(db);
  const transcriptionRepository = createTranscriptionRepository(
    db,
    whisperModel,
  );
  const clipsRepository = createClipsRepository(db);
  const renderRepository = createRenderRepository(db);

  await app.register(multipart, {
    limits: { files: 1, fields: 0, fileSize: maxUploadBytes },
  });
  await registerProjectRoutes(app, { repository });
  await registerTranscriptionRoutes(app, transcriptionRepository);
  await registerClipRoutes(app, clipsRepository);
  await registerRenderRoutes(app, renderRepository, clipsRepository);

  app.get("/api/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Некорректные данные запроса." });
    }
    if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
      return reply
        .status(413)
        .send({ error: "Видеофайл превышает допустимый размер." });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Внутренняя ошибка сервера." });
  });

  app.addHook("onClose", async () => sqlite.close());
  return app;
}
