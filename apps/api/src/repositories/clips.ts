import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  AiPackageMetadata,
  AiResponse,
  ClipDto,
  ClipUpdateInput,
} from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import {
  clips,
  projects,
  transcriptSegments,
  type ClipRow,
} from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";

const segmentIdsSchema = z.array(z.number().int().nonnegative());

function toDto(row: ClipRow): ClipDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    start: row.startSeconds,
    end: row.endSeconds,
    hookScore: row.hookScore,
    reason: row.reason,
    openingCaption: row.openingCaption,
    segmentIds: segmentIdsSchema.parse(JSON.parse(row.segmentIdsJson)),
    enabled: row.enabled,
    renderStatus: row.renderStatus,
    renderProgress: row.renderProgress,
    renderError: row.renderError,
    outputFileName: row.outputFileName,
    renderedAt: row.renderedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createClipsRepository(db: StudioDatabase) {
  return {
    async getContext(projectId: string) {
      const [project] = await db
        .select({
          id: projects.id,
          name: projects.name,
          language: projects.language,
          durationSeconds: projects.durationSeconds,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!project) throw new HttpError(404, "Проект не найден.");
      const rows = await db
        .select({
          id: transcriptSegments.segmentIndex,
          start: transcriptSegments.startSeconds,
          end: transcriptSegments.endSeconds,
          text: transcriptSegments.text,
        })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.projectId, projectId))
        .orderBy(asc(transcriptSegments.segmentIndex));
      if (!rows.length || project.durationSeconds === null) {
        throw new HttpError(409, "Сначала завершите транскрипцию проекта.");
      }
      const metadata: AiPackageMetadata = {
        schemaVersion: 1,
        projectId: project.id,
        projectName: project.name,
        language: project.language,
        durationSeconds: project.durationSeconds,
        segmentCount: rows.length,
        generatedAt: new Date().toISOString(),
      };
      return { metadata, segments: rows };
    },

    async list(projectId: string): Promise<ClipDto[]> {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!project) throw new HttpError(404, "Проект не найден.");
      const rows = await db
        .select()
        .from(clips)
        .where(eq(clips.projectId, projectId))
        .orderBy(asc(clips.createdAt), asc(clips.id));
      return rows.map(toDto);
    },

    async markWaitingForAi(projectId: string) {
      await db
        .update(projects)
        .set({
          status: "waiting_for_ai_result",
          updatedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(projects.id, projectId));
    },

    import(projectId: string, response: AiResponse): ClipDto[] {
      return db.transaction((tx) => {
        const now = new Date();
        tx.delete(clips).where(eq(clips.projectId, projectId)).run();
        const inserted = response.clips.map((clip, index) => {
          const orderedAt = new Date(now.getTime() + index);
          const [row] = tx
            .insert(clips)
            .values({
              id: randomUUID(),
              projectId,
              title: clip.title,
              startSeconds: clip.start,
              endSeconds: clip.end,
              hookScore: clip.hookScore,
              reason: clip.reason,
              openingCaption: clip.openingCaption,
              segmentIdsJson: JSON.stringify(clip.segmentIds),
              enabled: true,
              createdAt: orderedAt,
              updatedAt: orderedAt,
            })
            .returning()
            .all();
          return toDto(row!);
        });
        tx.update(projects)
          .set({
            status: "reviewing_clips",
            updatedAt: now,
            errorMessage: null,
          })
          .where(eq(projects.id, projectId))
          .run();
        return inserted;
      });
    },

    update(projectId: string, clipId: string, patch: ClipUpdateInput): ClipDto {
      return db.transaction((tx) => {
        const [row] = tx
          .select()
          .from(clips)
          .where(eq(clips.id, clipId))
          .limit(1)
          .all();
        if (!row || row.projectId !== projectId)
          throw new HttpError(404, "Clip не найден.");
        const [project] = tx
          .select({ durationSeconds: projects.durationSeconds })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
          .all();
        if (!project || project.durationSeconds === null)
          throw new HttpError(409, "У проекта отсутствует длительность видео.");

        const start = patch.start ?? row.startSeconds;
        const end = patch.end ?? row.endSeconds;
        if (start < 0)
          throw new HttpError(400, "Начало не может быть меньше нуля.");
        if (end <= start)
          throw new HttpError(400, "Конец должен быть позже начала.");
        if (end > project.durationSeconds)
          throw new HttpError(400, "Конец выходит за длительность видео.");
        const duration = end - start;
        if (duration < 15 || duration > 90)
          throw new HttpError(
            400,
            "Длительность clip должна быть от 15 до 90 секунд.",
          );
        const duplicate = tx
          .select({
            id: clips.id,
            start: clips.startSeconds,
            end: clips.endSeconds,
          })
          .from(clips)
          .where(eq(clips.projectId, projectId))
          .all()
          .some(
            (candidate) =>
              candidate.id !== clipId &&
              candidate.start === start &&
              candidate.end === end,
          );
        if (duplicate)
          throw new HttpError(
            400,
            "Другой clip уже использует такой же диапазон.",
          );

        let segmentIdsJson = row.segmentIdsJson;
        if (patch.start !== undefined || patch.end !== undefined) {
          const intersecting = tx
            .select({
              id: transcriptSegments.segmentIndex,
              start: transcriptSegments.startSeconds,
              end: transcriptSegments.endSeconds,
            })
            .from(transcriptSegments)
            .where(eq(transcriptSegments.projectId, projectId))
            .orderBy(asc(transcriptSegments.segmentIndex))
            .all()
            .filter((segment) => segment.end > start && segment.start < end)
            .map((segment) => segment.id);
          if (!intersecting.length) {
            throw new HttpError(
              400,
              "Новый диапазон не пересекается ни с одним сегментом транскрипта.",
            );
          }
          segmentIdsJson = JSON.stringify(intersecting);
        }

        const [updated] = tx
          .update(clips)
          .set({
            ...(patch.title === undefined ? {} : { title: patch.title }),
            ...(patch.openingCaption === undefined
              ? {}
              : { openingCaption: patch.openingCaption }),
            ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
            startSeconds: start,
            endSeconds: end,
            segmentIdsJson,
            updatedAt: new Date(),
          })
          .where(eq(clips.id, clipId))
          .returning()
          .all();
        return toDto(updated!);
      });
    },
  };
}

export type ClipsRepository = ReturnType<typeof createClipsRepository>;
