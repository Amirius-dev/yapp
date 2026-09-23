import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ProjectMode, ProjectStatus } from "@studio/contracts";

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

export type ProjectRow = typeof projects.$inferSelect;
