import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { JobDto, TranscriptDto } from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import {
  jobs,
  projects,
  transcriptSegments,
  transcriptWords,
  type JobRow,
} from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";

function toJobDto(row: JobRow, model: string): JobDto {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    status: row.status,
    progress: row.progress,
    model: row.type === "transcription" ? model : null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export function createTranscriptionRepository(
  db: StudioDatabase,
  model: string,
) {
  return {
    async enqueue(
      projectId: string,
      options: { regenerate?: boolean } = {},
    ): Promise<{ job: JobDto; created: boolean }> {
      return db.transaction((tx) => {
        const [project] = tx
          .select({ sourcePath: projects.sourceFilePath })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
          .all();
        if (!project) throw new HttpError(404, "Проект не найден.");
        if (!project.sourcePath) {
          throw new HttpError(409, "Сначала загрузите исходное видео.");
        }

        const [existing] = tx
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.projectId, projectId),
              eq(jobs.type, "transcription"),
              inArray(
                jobs.status,
                options.regenerate
                  ? ["queued", "running"]
                  : ["queued", "running", "completed"],
              ),
            ),
          )
          .orderBy(desc(jobs.createdAt))
          .limit(1)
          .all();
        if (existing) return { job: toJobDto(existing, model), created: false };

        const now = new Date();
        const [row] = tx
          .insert(jobs)
          .values({
            id: randomUUID(),
            projectId,
            type: "transcription",
            status: "queued",
            progress: 0,
            createdAt: now,
          })
          .returning()
          .all();
        const hasTranscript = Boolean(
          tx
            .select({ id: transcriptSegments.id })
            .from(transcriptSegments)
            .where(eq(transcriptSegments.projectId, projectId))
            .limit(1)
            .get(),
        );
        tx.update(projects)
          .set({
            ...(hasTranscript ? {} : { status: "transcribing" as const }),
            errorMessage: null,
            updatedAt: now,
          })
          .where(eq(projects.id, projectId))
          .run();
        return { job: toJobDto(row!, model), created: true };
      });
    },

    async listJobs(projectId: string): Promise<JobDto[]> {
      const rows = await db
        .select()
        .from(jobs)
        .where(eq(jobs.projectId, projectId))
        .orderBy(desc(jobs.createdAt));
      return rows.map((row) => toJobDto(row, model));
    },

    async getTranscript(projectId: string): Promise<TranscriptDto> {
      const [project] = await db
        .select({
          id: projects.id,
          language: projects.language,
          durationSeconds: projects.durationSeconds,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!project) throw new HttpError(404, "Проект не найден.");
      const rows = await db
        .select()
        .from(transcriptSegments)
        .where(eq(transcriptSegments.projectId, projectId))
        .orderBy(asc(transcriptSegments.segmentIndex));
      const wordRows = await db
        .select()
        .from(transcriptWords)
        .where(eq(transcriptWords.projectId, projectId))
        .orderBy(
          asc(transcriptWords.segmentIndex),
          asc(transcriptWords.wordIndex),
        );
      return {
        projectId,
        language: project.language,
        durationSeconds: project.durationSeconds ?? 0,
        segments: rows.map((row) => ({
          id: row.id,
          segmentIndex: row.segmentIndex,
          startSeconds: row.startSeconds,
          endSeconds: row.endSeconds,
          text: row.text,
        })),
        words: wordRows.map((row) => ({
          id: row.id,
          segmentIndex: row.segmentIndex,
          wordIndex: row.wordIndex,
          startSeconds: row.startSeconds,
          endSeconds: row.endSeconds,
          text: row.text,
          probability: row.probability,
        })),
        hasWordTimestamps: wordRows.length > 0,
      };
    },
  };
}

export type TranscriptionRepository = ReturnType<
  typeof createTranscriptionRepository
>;
