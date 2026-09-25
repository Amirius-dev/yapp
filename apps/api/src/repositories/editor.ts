import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  editorPresetSettingsSchema,
  templateOptions,
  timelineDuration,
  type EditorPreset,
  type EditorPresetCreateInput,
  type EditorSaveInput,
  type EditorState,
} from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import {
  clipRanges,
  clips,
  cropKeyframes,
  editorPresets,
  projects,
  subtitleKeyframes,
  transcriptSegments,
  transcriptWords,
} from "../db/schema.js";
import { HttpError } from "../lib/http-error.js";
import type { ClipsRepository } from "./clips.js";

export function createEditorRepository(
  db: StudioDatabase,
  clipsRepository: ClipsRepository,
) {
  async function getState(
    projectId: string,
    clipId: string,
  ): Promise<EditorState> {
    const [project] = await db
      .select({ duration: projects.durationSeconds })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) throw new HttpError(404, "Проект не найден.");
    if (!project.duration)
      throw new HttpError(409, "У проекта отсутствует длительность видео.");
    const clip = (await clipsRepository.list(projectId)).find(
      (item) => item.id === clipId,
    );
    if (!clip) throw new HttpError(404, "Clip не найден.");
    const cropRows = await db
      .select()
      .from(cropKeyframes)
      .where(eq(cropKeyframes.clipId, clipId))
      .orderBy(asc(cropKeyframes.sourceTimeSeconds));
    const subtitleRows = await db
      .select()
      .from(subtitleKeyframes)
      .where(eq(subtitleKeyframes.clipId, clipId))
      .orderBy(asc(subtitleKeyframes.sourceTimeSeconds));
    const words = await db
      .select()
      .from(transcriptWords)
      .where(eq(transcriptWords.projectId, projectId))
      .orderBy(
        asc(transcriptWords.segmentIndex),
        asc(transcriptWords.wordIndex),
      );
    const relevantWords = words.filter((word) =>
      clip.ranges.some(
        (range) =>
          word.endSeconds > range.start && word.startSeconds < range.end,
      ),
    );
    const segmentRows = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.projectId, projectId))
      .orderBy(asc(transcriptSegments.segmentIndex));
    const presetRows = await db
      .select()
      .from(editorPresets)
      .orderBy(asc(editorPresets.createdAt));
    return {
      clip,
      sourceDurationSeconds: project.duration,
      ranges: clip.ranges.map(({ id, start, end, transition }) => ({
        id,
        start,
        end,
        transition,
      })),
      cropKeyframes: cropRows.map((row) => ({
        id: row.id,
        rangeId: row.rangeId,
        sourceTimeSeconds: row.sourceTimeSeconds,
        cropX: row.cropX,
        cropY: row.cropY,
        zoom: row.zoom,
        easing: row.easing,
      })),
      subtitleKeyframes: subtitleRows.map((row) => ({
        id: row.id,
        rangeId: row.rangeId,
        sourceTimeSeconds: row.sourceTimeSeconds,
        subtitleX: row.subtitleX,
        subtitleY: row.subtitleY,
        subtitleScale: row.subtitleScale,
        subtitleAlign: row.subtitleAlign,
        transition: row.transition,
      })),
      frameMode: clip.cropMode,
      subtitleX: clip.subtitleX,
      subtitleY: clip.subtitleY,
      subtitleScale: clip.subtitleScale,
      subtitleAlign: clip.subtitleAlign,
      templateId: clip.templateId,
      accentColor: clip.accentColor,
      captionsEnabled: clip.captionsEnabled,
      openingCaptionEnabled: clip.openingCaptionEnabled,
      image: clip.image,
      audio: clip.audio,
      subtitleStyle: clip.subtitleStyle,
      openingCaption: clip.openingCaptionSettings,
      words: relevantWords.map((word) => ({
        id: word.id,
        segmentIndex: word.segmentIndex,
        wordIndex: word.wordIndex,
        startSeconds: word.startSeconds,
        endSeconds: word.endSeconds,
        text: word.text,
        probability: word.probability,
      })),
      segments: segmentRows
        .filter((segment) =>
          clip.ranges.some(
            (range) =>
              segment.endSeconds > range.start &&
              segment.startSeconds < range.end,
          ),
        )
        .map((segment) => ({
          id: segment.id,
          segmentIndex: segment.segmentIndex,
          startSeconds: segment.startSeconds,
          endSeconds: segment.endSeconds,
          text: segment.text,
        })),
      hasWordTimestamps: words.length > 0,
      templates: templateOptions,
      presets: presetRows.map((row) => ({
        id: row.id,
        name: row.name,
        settings: editorPresetSettingsSchema.parse(
          JSON.parse(row.settingsJson),
        ),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      warnings: [],
    };
  }

  async function save(
    projectId: string,
    clipId: string,
    input: EditorSaveInput,
  ): Promise<EditorState> {
    const warnings: string[] = [];
    db.transaction((tx) => {
      const project = tx
        .select({ duration: projects.durationSeconds })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();
      const clip = tx.select().from(clips).where(eq(clips.id, clipId)).get();
      if (!project || !clip || clip.projectId !== projectId)
        throw new HttpError(404, "Clip не найден.");
      if (!project.duration)
        throw new HttpError(409, "У проекта отсутствует длительность видео.");

      const duplicateRanges = new Set<string>();
      for (const range of input.ranges) {
        if (
          range.end <= range.start ||
          range.end - range.start < 1 ||
          range.end > project.duration
        )
          throw new HttpError(
            400,
            "Каждый range должен находиться внутри видео и длиться минимум 1 секунду.",
          );
        const key = `${range.start}:${range.end}`;
        if (duplicateRanges.has(key))
          throw new HttpError(400, "Одинаковые ranges запрещены.");
        duplicateRanges.add(key);
      }
      const duration = timelineDuration(input.ranges);
      if (duration < 15 || duration > 90)
        throw new HttpError(
          400,
          "Суммарная длительность clip должна быть от 15 до 90 секунд.",
        );
      const rangeById = new Map(input.ranges.map((range) => [range.id, range]));
      const clampTime = (rangeId: string, value: number) => {
        const range = rangeById.get(rangeId);
        if (!range)
          throw new HttpError(400, "Keyframe ссылается на неизвестный range.");
        const clamped = Math.max(range.start, Math.min(range.end, value));
        if (clamped !== value)
          warnings.push(
            "Keyframe за границей range был безопасно перемещён к его границе.",
          );
        return clamped;
      };

      const cropFrames = input.cropKeyframes.map((frame) => ({
        ...frame,
        sourceTimeSeconds: clampTime(frame.rangeId, frame.sourceTimeSeconds),
      }));
      for (const range of input.ranges) {
        if (
          !cropFrames.some(
            (frame) =>
              frame.rangeId === range.id &&
              Math.abs(frame.sourceTimeSeconds - range.start) < 0.001,
          )
        ) {
          cropFrames.push({
            id: randomUUID(),
            rangeId: range.id,
            sourceTimeSeconds: range.start,
            cropX: clip.cropX,
            cropY: clip.cropY,
            zoom: clip.zoom,
            easing: "linear",
          });
        }
      }
      const subtitleFrames = input.subtitleKeyframes.map((frame) => ({
        ...frame,
        sourceTimeSeconds: clampTime(frame.rangeId, frame.sourceTimeSeconds),
      }));
      const segments = tx
        .select({
          id: transcriptSegments.segmentIndex,
          start: transcriptSegments.startSeconds,
          end: transcriptSegments.endSeconds,
        })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.projectId, projectId))
        .all();
      const segmentIds = [
        ...new Set(
          input.ranges.flatMap((range) =>
            segments
              .filter(
                (segment) =>
                  segment.end > range.start && segment.start < range.end,
              )
              .map((segment) => segment.id),
          ),
        ),
      ];
      if (!segmentIds.length)
        throw new HttpError(400, "Ranges не пересекаются с транскриптом.");

      tx.delete(clipRanges).where(eq(clipRanges.clipId, clipId)).run();
      const now = new Date();
      input.ranges.forEach((range, rangeOrder) =>
        tx
          .insert(clipRanges)
          .values({
            id: range.id,
            clipId,
            rangeOrder,
            startSeconds: range.start,
            endSeconds: range.end,
            transitionType: range.transition.type,
            transitionDurationSeconds: range.transition.durationSeconds,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      );
      cropFrames.forEach((frame) =>
        tx
          .insert(cropKeyframes)
          .values({
            ...frame,
            clipId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      );
      subtitleFrames.forEach((frame) =>
        tx
          .insert(subtitleKeyframes)
          .values({
            ...frame,
            clipId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      );
      tx.update(clips)
        .set({
          startSeconds: Math.min(...input.ranges.map((range) => range.start)),
          endSeconds: Math.max(...input.ranges.map((range) => range.end)),
          segmentIdsJson: JSON.stringify(segmentIds),
          subtitleX: input.subtitleX,
          subtitleY: input.subtitleY,
          subtitleScale: input.subtitleScale,
          subtitleAlign: input.subtitleAlign,
          templateId: input.templateId,
          accentColor: input.accentColor,
          captionsEnabled: input.captionsEnabled,
          openingCaptionEnabled: input.openingCaptionEnabled,
          imageSettingsJson: JSON.stringify(input.image),
          audioSettingsJson: JSON.stringify(input.audio),
          subtitleStyleJson: JSON.stringify(input.subtitleStyle),
          openingCaptionSettingsJson: JSON.stringify(input.openingCaption),
          openingCaption: input.openingCaption.text,
          cropMode: input.frameMode,
          cropX: input.image.positionX,
          cropY: input.image.positionY,
          zoom: input.image.zoom,
          renderStatus: "idle",
          renderProgress: 0,
          renderError: null,
          outputFileName: null,
          renderedAt: null,
          updatedAt: now,
        })
        .where(eq(clips.id, clipId))
        .run();
      tx.update(projects)
        .set({ status: "reviewing_clips", updatedAt: now })
        .where(eq(projects.id, projectId))
        .run();
    });
    const state = await getState(projectId, clipId);
    return { ...state, warnings };
  }

  async function listPresets(): Promise<EditorPreset[]> {
    const rows = await db
      .select()
      .from(editorPresets)
      .orderBy(asc(editorPresets.createdAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      settings: editorPresetSettingsSchema.parse(JSON.parse(row.settingsJson)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async function createPreset(
    input: EditorPresetCreateInput,
  ): Promise<EditorPreset> {
    const now = new Date();
    const [row] = await db
      .insert(editorPresets)
      .values({
        id: randomUUID(),
        name: input.name,
        settingsJson: JSON.stringify(input.settings),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return {
      id: row!.id,
      name: row!.name,
      settings: editorPresetSettingsSchema.parse(JSON.parse(row!.settingsJson)),
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  async function deletePreset(id: string) {
    const deleted = await db
      .delete(editorPresets)
      .where(eq(editorPresets.id, id))
      .returning({ id: editorPresets.id });
    if (!deleted.length) throw new HttpError(404, "Preset не найден.");
  }

  return { getState, save, listPresets, createPreset, deletePreset };
}

export type EditorRepository = ReturnType<typeof createEditorRepository>;
