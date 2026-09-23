import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JobStatus, ProjectMode, ProjectStatus } from "@studio/contracts";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode")
    .$type<ProjectMode>()
    .notNull()
    .default("long_video_to_shorts"),
  status: text("status").$type<ProjectStatus>().notNull().default("created"),
  sourceFilePath: text("source_file_path"),
  sourceFileName: text("source_file_name"),
  sourceMimeType: text("source_mime_type"),
  language: text("language"),
  durationSeconds: real("duration_seconds"),
  width: integer("width"),
  height: integer("height"),
  fps: real("fps"),
  fileSizeBytes: integer("file_size_bytes"),
  hasAudio: integer("has_audio", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  errorMessage: text("error_message"),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").$type<"transcription" | "render_clips">().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    errorMessage: text("error_message"),
    payloadJson: text("payload_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("jobs_project_id_idx").on(table.projectId),
    uniqueIndex("jobs_one_active_transcription_idx")
      .on(table.projectId, table.type)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

export const transcriptSegments = sqliteTable(
  "transcript_segments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    uniqueIndex("transcript_segments_project_index_unique").on(
      table.projectId,
      table.segmentIndex,
    ),
  ],
);

export const clips = sqliteTable(
  "clips",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    hookScore: integer("hook_score").notNull(),
    reason: text("reason").notNull(),
    openingCaption: text("opening_caption").notNull(),
    segmentIdsJson: text("segment_ids_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    cropMode: text("crop_mode")
      .$type<"fill" | "fit">()
      .notNull()
      .default("fill"),
    cropX: real("crop_x").notNull().default(50),
    cropY: real("crop_y").notNull().default(50),
    zoom: real("zoom").notNull().default(1),
    subtitleX: real("subtitle_x").notNull().default(50),
    subtitleY: real("subtitle_y").notNull().default(72),
    subtitleScale: real("subtitle_scale").notNull().default(1),
    subtitleAlign: text("subtitle_align")
      .$type<"left" | "center" | "right">()
      .notNull()
      .default("center"),
    renderStatus: text("render_status")
      .$type<"idle" | "queued" | "rendering" | "completed" | "failed">()
      .notNull()
      .default("idle"),
    renderProgress: integer("render_progress").notNull().default(0),
    renderError: text("render_error"),
    outputFileName: text("output_file_name"),
    renderedAt: integer("rendered_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("clips_project_id_idx").on(table.projectId)],
);

export type ProjectRow = typeof projects.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type ClipRow = typeof clips.$inferSelect;
