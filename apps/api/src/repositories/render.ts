import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { JobDto, RenderRequest } from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import { clips, jobs, projects, type JobRow } from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";

function toJobDto(row: JobRow): JobDto {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    status: row.status,
    progress: row.progress,
    model: null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export function createRenderRepository(db: StudioDatabase) {
  return {
    enqueue(projectId: string, input: RenderRequest): JobDto {
      return db.transaction((tx) => {
        const [project] = tx
          .select({ id: projects.id, sourcePath: projects.sourceFilePath })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
          .all();
        if (!project) throw new HttpError(404, "Проект не найден.");
        if (!project.sourcePath)
          throw new HttpError(409, "У проекта нет исходного видео.");

        const [active] = tx
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.projectId, projectId),
              eq(jobs.type, "render_clips"),
              inArray(jobs.status, ["queued", "running"]),
            ),
          )
          .limit(1)
          .all();
        if (active) return toJobDto(active);

        const rows = tx
          .select()
          .from(clips)
          .where(eq(clips.projectId, projectId))
          .orderBy(asc(clips.createdAt))
          .all();
        const explicit = input.clipIds ? [...new Set(input.clipIds)] : null;
        if (explicit) {
          const found = rows.filter((clip) => explicit.includes(clip.id));
          if (found.length !== explicit.length)
            throw new HttpError(
              400,
              "Один или несколько clips не принадлежат проекту.",
            );
          if (found.some((clip) => !clip.enabled))
            throw new HttpError(409, "Нельзя запустить disabled clip.");
        }
        const selected = explicit
          ? explicit.map((id) => rows.find((clip) => clip.id === id)!)
          : rows.filter((clip) => clip.enabled);
        const candidates = selected.filter((clip) => {
          if (clip.renderStatus === "idle" || clip.renderStatus === "failed")
            return true;
          return input.force && clip.renderStatus === "completed";
        });
        if (
          selected.some((clip) => clip.renderStatus === "completed") &&
          !input.force &&
          explicit
        )
          throw new HttpError(
            409,
            "Completed clip требует force: true для повторного рендера.",
          );
        if (!candidates.length)
          throw new HttpError(
            409,
            "Нет clips, доступных для рендера или повторной попытки.",
          );

        const now = new Date();
        const jobId = randomUUID();
        const clipIds = candidates.map((clip) => clip.id);
        const [job] = tx
          .insert(jobs)
          .values({
            id: jobId,
            projectId,
            type: "render_clips",
            status: "queued",
            progress: 0,
            payloadJson: JSON.stringify({ projectId, clipIds }),
            createdAt: now,
          })
          .returning()
          .all();
        for (const clipId of clipIds) {
          tx.update(clips)
            .set({
              renderStatus: "queued",
              renderProgress: 0,
              renderError: null,
            })
            .where(eq(clips.id, clipId))
            .run();
        }
        tx.update(projects)
          .set({ status: "rendering", updatedAt: now, errorMessage: null })
          .where(eq(projects.id, projectId))
          .run();
        return toJobDto(job!);
      });
    },

    async latestJob(projectId: string): Promise<JobDto | null> {
      const [row] = await db
        .select()
        .from(jobs)
        .where(
          and(eq(jobs.projectId, projectId), eq(jobs.type, "render_clips")),
        )
        .orderBy(desc(jobs.createdAt))
        .limit(1);
      return row ? toJobDto(row) : null;
    },

    async projectSource(projectId: string) {
      const [row] = await db
        .select({
          path: projects.sourceFilePath,
          mimeType: projects.sourceMimeType,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!row) throw new HttpError(404, "Проект не найден.");
      if (!row.path) throw new HttpError(404, "Исходное видео не найдено.");
      return { path: row.path, mimeType: row.mimeType };
    },

    async clipOutput(projectId: string, clipId: string) {
      const [row] = await db
        .select({ fileName: clips.outputFileName, status: clips.renderStatus })
        .from(clips)
        .where(and(eq(clips.id, clipId), eq(clips.projectId, projectId)))
        .limit(1);
      if (!row) throw new HttpError(404, "Clip не найден.");
      if (row.status !== "completed" || !row.fileName)
        throw new HttpError(404, "Готовый MP4 для clip ещё не создан.");
      return row.fileName;
    },
  };
}

export type RenderRepository = ReturnType<typeof createRenderRepository>;
