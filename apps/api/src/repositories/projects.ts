import { desc, eq } from "drizzle-orm";
import type { MediaInfo, ProjectDto, ProjectStatus } from "@studio/contracts";
import type { StudioDatabase } from "../db/client.js";
import { projects, type ProjectRow } from "../db/schema.js";

function toDto(row: ProjectRow): ProjectDto {
  const hasCompleteMediaInfo =
    row.durationSeconds !== null &&
    row.width !== null &&
    row.height !== null &&
    row.fps !== null &&
    row.fileSizeBytes !== null &&
    row.hasAudio !== null;

  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    status: row.status,
    sourceFileName: row.sourceFileName,
    sourceMimeType: row.sourceMimeType,
    language: row.language,
    mediaInfo: hasCompleteMediaInfo
      ? {
          durationSeconds: row.durationSeconds!,
          width: row.width!,
          height: row.height!,
          fps: row.fps!,
          fileSizeBytes: row.fileSizeBytes!,
          hasAudio: row.hasAudio!,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    errorMessage: row.errorMessage,
  };
}

export function createProjectsRepository(db: StudioDatabase) {
  return {
    async create(input: { id: string; name: string }): Promise<ProjectDto> {
      const now = new Date();
      const [row] = await db
        .insert(projects)
        .values({
          id: input.id,
          name: input.name,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return toDto(row!);
    },

    async list(): Promise<ProjectDto[]> {
      const rows = await db
        .select()
        .from(projects)
        .orderBy(desc(projects.updatedAt));
      return rows.map(toDto);
    },

    async findById(id: string): Promise<ProjectDto | null> {
      const [row] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return row ? toDto(row) : null;
    },

    async hasSource(id: string): Promise<boolean> {
      const [row] = await db
        .select({ path: projects.sourceFilePath })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return Boolean(row?.path);
    },

    async setStatus(
      id: string,
      status: ProjectStatus,
      errorMessage: string | null = null,
    ) {
      await db
        .update(projects)
        .set({ status, errorMessage, updatedAt: new Date() })
        .where(eq(projects.id, id));
    },

    async attachSource(
      id: string,
      source: { relativePath: string; originalName: string; mimeType: string },
      mediaInfo: MediaInfo,
    ): Promise<ProjectDto> {
      const [row] = await db
        .update(projects)
        .set({
          status: "ready_for_transcription",
          sourceFilePath: source.relativePath,
          sourceFileName: source.originalName,
          sourceMimeType: source.mimeType,
          durationSeconds: mediaInfo.durationSeconds,
          width: mediaInfo.width,
          height: mediaInfo.height,
          fps: mediaInfo.fps,
          fileSizeBytes: mediaInfo.fileSizeBytes,
          hasAudio: mediaInfo.hasAudio,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();
      return toDto(row!);
    },
  };
}

export type ProjectsRepository = ReturnType<typeof createProjectsRepository>;
