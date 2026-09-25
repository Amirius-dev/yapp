import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  JobStatus,
  ProjectMode,
  ProjectStatus,
  TemplateId,
} from "@studio/contracts";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  type RangeTransition,
} from "@studio/contracts";

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

export const transcriptWords = sqliteTable(
  "transcript_words",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    wordIndex: integer("word_index").notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    text: text("text").notNull(),
    probability: real("probability").notNull(),
  },
  (table) => [
    uniqueIndex("transcript_words_project_segment_word_unique").on(
      table.projectId,
      table.segmentIndex,
      table.wordIndex,
    ),
    index("transcript_words_project_time_idx").on(
      table.projectId,
      table.startSeconds,
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
    templateId: text("template_id")
      .$type<TemplateId>()
      .notNull()
      .default("clean"),
    accentColor: text("accent_color").notNull().default("#8f7cff"),
    captionsEnabled: integer("captions_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    openingCaptionEnabled: integer("opening_caption_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    imageSettingsJson: text("image_settings_json")
      .notNull()
      .default(JSON.stringify(DEFAULT_IMAGE_ADJUSTMENTS)),
    audioSettingsJson: text("audio_settings_json")
      .notNull()
      .default(JSON.stringify(DEFAULT_AUDIO_SETTINGS)),
    subtitleStyleJson: text("subtitle_style_json")
      .notNull()
      .default(JSON.stringify(DEFAULT_SUBTITLE_STYLE)),
    openingCaptionSettingsJson: text("opening_caption_settings_json")
      .notNull()
      .default(JSON.stringify(DEFAULT_OPENING_CAPTION_SETTINGS)),
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

export const clipRanges = sqliteTable(
  "clip_ranges",
  {
    id: text("id").primaryKey(),
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    rangeOrder: integer("range_order").notNull(),
    startSeconds: real("start_seconds").notNull(),
    endSeconds: real("end_seconds").notNull(),
    transitionType: text("transition_type")
      .$type<RangeTransition["type"]>()
      .notNull()
      .default("hard-cut"),
    transitionDurationSeconds: real("transition_duration_seconds")
      .notNull()
      .default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("clip_ranges_clip_order_unique").on(
      table.clipId,
      table.rangeOrder,
    ),
    index("clip_ranges_clip_id_idx").on(table.clipId),
  ],
);

export const editorPresets = sqliteTable("editor_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  settingsJson: text("settings_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const cropKeyframes = sqliteTable(
  "crop_keyframes",
  {
    id: text("id").primaryKey(),
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    rangeId: text("range_id")
      .notNull()
      .references(() => clipRanges.id, { onDelete: "cascade" }),
    sourceTimeSeconds: real("source_time_seconds").notNull(),
    cropX: real("crop_x").notNull(),
    cropY: real("crop_y").notNull(),
    zoom: real("zoom").notNull(),
    easing: text("easing")
      .$type<"linear" | "ease-in-out" | "hold">()
      .notNull()
      .default("linear"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("crop_keyframes_clip_range_idx").on(table.clipId, table.rangeId),
  ],
);

export const subtitleKeyframes = sqliteTable(
  "subtitle_keyframes",
  {
    id: text("id").primaryKey(),
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    rangeId: text("range_id")
      .notNull()
      .references(() => clipRanges.id, { onDelete: "cascade" }),
    sourceTimeSeconds: real("source_time_seconds").notNull(),
    subtitleX: real("subtitle_x").notNull(),
    subtitleY: real("subtitle_y").notNull(),
    subtitleScale: real("subtitle_scale").notNull(),
    subtitleAlign: text("subtitle_align")
      .$type<"left" | "center" | "right">()
      .notNull(),
    transition: text("transition")
      .$type<"hold" | "smooth">()
      .notNull()
      .default("hold"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("subtitle_keyframes_clip_range_idx").on(table.clipId, table.rangeId),
  ],
);

export type ProjectRow = typeof projects.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type ClipRow = typeof clips.$inferSelect;
export type ClipRangeRow = typeof clipRanges.$inferSelect;
