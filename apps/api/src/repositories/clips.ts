import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  AiPackageMetadata,
  AiResponseV2,
  ClipDto,
  ClipUpdateInput,
} from "@studio/contracts";
import {
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  imageAdjustmentsSchema,
  openingCaptionSettingsSchema,
  subtitleStyleSchema,
} from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import {
  clips,
  clipRanges,
  projects,
  transcriptSegments,
  type ClipRow,
} from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";

const segmentIdsSchema = z.array(z.number().int().nonnegative());

type ClipRangeDto = ClipDto["ranges"][number];

function parseJson<T>(schema: z.ZodType<T>, value: string, fallback: T): T {
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function toDto(row: ClipRow, ranges: ClipRangeDto[]): ClipDto {
  const image = parseJson(
    imageAdjustmentsSchema,
    row.imageSettingsJson,
    DEFAULT_IMAGE_ADJUSTMENTS,
  );
  const audio = parseJson(
    audioSettingsSchema,
    row.audioSettingsJson,
    DEFAULT_AUDIO_SETTINGS,
  );
  const subtitleStyle = parseJson(
    subtitleStyleSchema,
    row.subtitleStyleJson,
    DEFAULT_SUBTITLE_STYLE,
  );
  const openingCaptionSettings = parseJson(
    openingCaptionSettingsSchema,
    row.openingCaptionSettingsJson,
    { ...DEFAULT_OPENING_CAPTION_SETTINGS, text: row.openingCaption },
  );
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
    ranges,
    enabled: row.enabled,
    cropMode: row.cropMode,
    cropX: row.cropX,
    cropY: row.cropY,
    zoom: row.zoom,
    subtitleX: row.subtitleX,
    subtitleY: row.subtitleY,
    subtitleScale: row.subtitleScale,
    subtitleAlign: row.subtitleAlign,
    templateId: row.templateId,
    accentColor: row.accentColor,
    captionsEnabled: row.captionsEnabled,
    openingCaptionEnabled: row.openingCaptionEnabled,
    image,
    audio,
    subtitleStyle,
    openingCaptionSettings,
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
        schemaVersion: 2,
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
      const rangeRows = await db
        .select()
        .from(clipRanges)
        .orderBy(asc(clipRanges.rangeOrder));
      const segmentRows = await db
        .select({
          id: transcriptSegments.segmentIndex,
          start: transcriptSegments.startSeconds,
          end: transcriptSegments.endSeconds,
        })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.projectId, projectId));
      return rows.map((row) =>
        toDto(
          row,
          rangeRows
            .filter((range) => range.clipId === row.id)
            .map((range) => ({
              id: range.id,
              rangeOrder: range.rangeOrder,
              start: range.startSeconds,
              end: range.endSeconds,
              transition: {
                type: range.transitionType,
                durationSeconds: range.transitionDurationSeconds,
              },
              segmentIds: segmentRows
                .filter(
                  (segment) =>
                    segment.end > range.startSeconds &&
                    segment.start < range.endSeconds,
                )
                .map((segment) => segment.id),
            })),
        ),
      );
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

    import(projectId: string, response: AiResponseV2): ClipDto[] {
      return db.transaction((tx) => {
        const now = new Date();
        tx.delete(clips).where(eq(clips.projectId, projectId)).run();
        const inserted = response.clips.map((clip, index) => {
          const orderedAt = new Date(now.getTime() + index);
          const start = Math.min(...clip.ranges.map((range) => range.start));
          const end = Math.max(...clip.ranges.map((range) => range.end));
          const segmentIds = [
            ...new Set(clip.ranges.flatMap((range) => range.segmentIds)),
          ];
          const [row] = tx
            .insert(clips)
            .values({
              id: randomUUID(),
              projectId,
              title: clip.title,
              startSeconds: start,
              endSeconds: end,
              hookScore: clip.hookScore,
              reason: clip.reason,
              openingCaption: clip.openingCaption,
              segmentIdsJson: JSON.stringify(segmentIds),
              enabled: true,
              createdAt: orderedAt,
              updatedAt: orderedAt,
            })
            .returning()
            .all();
          const ranges = clip.ranges.map((range, rangeOrder) => {
            const id = randomUUID();
            tx.insert(clipRanges)
              .values({
                id,
                clipId: row!.id,
                rangeOrder,
                startSeconds: range.start,
                endSeconds: range.end,
                transitionType: "hard-cut",
                transitionDurationSeconds: 0,
                createdAt: orderedAt,
                updatedAt: orderedAt,
              })
              .run();
            return {
              id,
              rangeOrder,
              start: range.start,
              end: range.end,
              transition: { type: "hard-cut" as const, durationSeconds: 0 },
              segmentIds: range.segmentIds,
            };
          });
          return toDto(row!, ranges);
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

        const storedImage = parseJson(
          imageAdjustmentsSchema,
          row.imageSettingsJson,
          DEFAULT_IMAGE_ADJUSTMENTS,
        );
        const nextImage = patch.image
          ? patch.image
          : {
              ...storedImage,
              ...(patch.cropX === undefined ? {} : { positionX: patch.cropX }),
              ...(patch.cropY === undefined ? {} : { positionY: patch.cropY }),
              ...(patch.zoom === undefined ? {} : { zoom: patch.zoom }),
            };
        const renderChanged = [
          patch.start,
          patch.end,
          patch.openingCaption,
          patch.cropMode,
          patch.cropX,
          patch.cropY,
          patch.zoom,
          patch.subtitleX,
          patch.subtitleY,
          patch.subtitleScale,
          patch.subtitleAlign,
          patch.image,
          patch.audio,
          patch.subtitleStyle,
          patch.openingCaptionSettings,
        ].some((value) => value !== undefined);
        const [updated] = tx
          .update(clips)
          .set({
            ...(patch.title === undefined ? {} : { title: patch.title }),
            ...(patch.openingCaption === undefined
              ? {}
              : { openingCaption: patch.openingCaption }),
            ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
            ...(patch.cropMode === undefined
              ? {}
              : { cropMode: patch.cropMode }),
            ...(patch.cropX === undefined ? {} : { cropX: patch.cropX }),
            ...(patch.cropY === undefined ? {} : { cropY: patch.cropY }),
            ...(patch.zoom === undefined ? {} : { zoom: patch.zoom }),
            ...(patch.subtitleX === undefined
              ? {}
              : { subtitleX: patch.subtitleX }),
            ...(patch.subtitleY === undefined
              ? {}
              : { subtitleY: patch.subtitleY }),
            ...(patch.subtitleScale === undefined
              ? {}
              : { subtitleScale: patch.subtitleScale }),
            ...(patch.subtitleAlign === undefined
              ? {}
              : { subtitleAlign: patch.subtitleAlign }),
            ...(patch.image === undefined &&
            patch.cropX === undefined &&
            patch.cropY === undefined &&
            patch.zoom === undefined
              ? {}
              : {
                  imageSettingsJson: JSON.stringify(nextImage),
                  cropX: nextImage.positionX,
                  cropY: nextImage.positionY,
                  zoom: nextImage.zoom,
                }),
            ...(patch.audio === undefined
              ? {}
              : { audioSettingsJson: JSON.stringify(patch.audio) }),
            ...(patch.subtitleStyle === undefined
              ? {}
              : { subtitleStyleJson: JSON.stringify(patch.subtitleStyle) }),
            ...(patch.openingCaptionSettings === undefined
              ? {}
              : {
                  openingCaptionSettingsJson: JSON.stringify(
                    patch.openingCaptionSettings,
                  ),
                  openingCaption: patch.openingCaptionSettings.text,
                  openingCaptionEnabled: patch.openingCaptionSettings.enabled,
                }),
            ...(renderChanged
              ? {
                  renderStatus: "idle" as const,
                  renderProgress: 0,
                  renderError: null,
                  outputFileName: null,
                  renderedAt: null,
                }
              : {}),
            startSeconds: start,
            endSeconds: end,
            segmentIdsJson,
            updatedAt: new Date(),
          })
          .where(eq(clips.id, clipId))
          .returning()
          .all();
        if (renderChanged) {
          tx.update(projects)
            .set({ status: "reviewing_clips", updatedAt: new Date() })
            .where(eq(projects.id, projectId))
            .run();
        }
        let dtoRanges = tx
          .select()
          .from(clipRanges)
          .where(eq(clipRanges.clipId, clipId))
          .orderBy(asc(clipRanges.rangeOrder))
          .all();
        if (patch.start !== undefined || patch.end !== undefined) {
          if (dtoRanges.length !== 1)
            throw new HttpError(
              409,
              "Изменяйте multi-range clip через timeline editor.",
            );
          tx.update(clipRanges)
            .set({
              startSeconds: start,
              endSeconds: end,
              updatedAt: new Date(),
            })
            .where(eq(clipRanges.id, dtoRanges[0]!.id))
            .run();
          dtoRanges = tx
            .select()
            .from(clipRanges)
            .where(eq(clipRanges.clipId, clipId))
            .orderBy(asc(clipRanges.rangeOrder))
            .all();
        }
        const segments = tx
          .select({
            id: transcriptSegments.segmentIndex,
            start: transcriptSegments.startSeconds,
            end: transcriptSegments.endSeconds,
          })
          .from(transcriptSegments)
          .where(eq(transcriptSegments.projectId, projectId))
          .all();
        return toDto(
          updated!,
          dtoRanges.map((range) => ({
            id: range.id,
            rangeOrder: range.rangeOrder,
            start: range.startSeconds,
            end: range.endSeconds,
            transition: {
              type: range.transitionType,
              durationSeconds: range.transitionDurationSeconds,
            },
            segmentIds: segments
              .filter(
                (segment) =>
                  segment.end > range.startSeconds &&
                  segment.start < range.endSeconds,
              )
              .map((segment) => segment.id),
          })),
        );
      });
    },
  };
}

export type ClipsRepository = ReturnType<typeof createClipsRepository>;
