import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import {
  claimNextJob,
  completeJob,
  finalizeRenderJob,
  getRenderClip,
  recoverInterruptedJobs,
} from "../src/db.js";

function createTestDatabase() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      source_file_path TEXT,
      has_audio INTEGER,
      language TEXT,
      error_message TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER
      ,payload_json TEXT
    );
    CREATE TABLE transcript_segments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      start_seconds REAL NOT NULL,
      end_seconds REAL NOT NULL,
      text TEXT NOT NULL,
      UNIQUE(project_id, segment_index)
    );
    CREATE TABLE clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      start_seconds REAL DEFAULT 0,
      end_seconds REAL DEFAULT 20,
      opening_caption TEXT DEFAULT '',
      crop_mode TEXT NOT NULL DEFAULT 'fill',
      crop_x REAL NOT NULL DEFAULT 50,
      crop_y REAL NOT NULL DEFAULT 50,
      zoom REAL NOT NULL DEFAULT 1,
      subtitle_x REAL NOT NULL DEFAULT 50,
      subtitle_y REAL NOT NULL DEFAULT 72,
      subtitle_scale REAL NOT NULL DEFAULT 1,
      subtitle_align TEXT NOT NULL DEFAULT 'center',
      render_status TEXT NOT NULL DEFAULT 'idle',
      render_progress INTEGER NOT NULL DEFAULT 0,
      render_error TEXT,
      output_file_name TEXT,
      rendered_at INTEGER
    );
  `);
  return db;
}

describe("worker persistence", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    db.prepare(
      "INSERT INTO projects (id, status, source_file_path, updated_at) VALUES (?, ?, ?, ?)",
    ).run(
      "project-1",
      "transcribing",
      "projects/project-1/source/video.mp4",
      1,
    );
  });

  it("marks interrupted running jobs as retryable failures", () => {
    db.prepare(
      "INSERT INTO jobs (id, project_id, type, status, progress, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("job-1", "project-1", "transcription", "running", 40, 1);

    expect(recoverInterruptedJobs(db)).toBe(1);
    expect(
      db.prepare("SELECT status, error_message FROM jobs").get(),
    ).toMatchObject({
      status: "failed",
      error_message: expect.stringContaining("Запустите задачу повторно"),
    });
    expect(db.prepare("SELECT status FROM projects").get()).toEqual({
      status: "failed",
    });
  });

  it("claims one queued job and publishes segments atomically", () => {
    db.prepare(
      "INSERT INTO jobs (id, project_id, type, status, progress, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("job-1", "project-1", "transcription", "queued", 0, 1);

    const job = claimNextJob(db);
    expect(job?.id).toBe("job-1");
    expect(claimNextJob(db)).toBeNull();
    if (!job || job.type !== "transcription")
      throw new Error("Expected transcription job");
    completeJob(db, job!, "ru", [
      { segmentIndex: 0, startSeconds: 0, endSeconds: 1.5, text: "Привет" },
    ]);

    expect(db.prepare("SELECT status, progress FROM jobs").get()).toEqual({
      status: "completed",
      progress: 100,
    });
    expect(db.prepare("SELECT status, language FROM projects").get()).toEqual({
      status: "ready_for_ai",
      language: "ru",
    });
    expect(
      db.prepare("SELECT segment_index, text FROM transcript_segments").get(),
    ).toEqual({
      segment_index: 0,
      text: "Привет",
    });
  });

  it("recovers interrupted render clips as retryable failures", () => {
    db.prepare(
      "INSERT INTO clips (id, project_id, render_status) VALUES (?, ?, ?)",
    ).run("clip-1", "project-1", "rendering");
    db.prepare(
      "INSERT INTO jobs (id, project_id, type, status, progress, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "job-render",
      "project-1",
      "render_clips",
      "running",
      40,
      JSON.stringify({ projectId: "project-1", clipIds: ["clip-1"] }),
      1,
    );

    expect(recoverInterruptedJobs(db)).toBe(1);
    expect(db.prepare("SELECT render_status FROM clips").get()).toEqual({
      render_status: "failed",
    });
    expect(db.prepare("SELECT status FROM projects").get()).toEqual({
      status: "reviewing_clips",
    });
  });

  it("keeps successful clips when a render job partially fails", () => {
    db.prepare(
      "INSERT INTO clips (id, project_id, render_status) VALUES (?, ?, ?), (?, ?, ?)",
    ).run("clip-1", "project-1", "completed", "clip-2", "project-1", "failed");
    db.prepare(
      "INSERT INTO jobs (id, project_id, type, status, progress, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("job-render", "project-1", "render_clips", "running", 90, "{}", 1);
    const result = finalizeRenderJob(db, {
      id: "job-render",
      projectId: "project-1",
      type: "render_clips",
      sourcePath: "/tmp/source.mp4",
      sourceHasAudio: true,
      clipIds: ["clip-1", "clip-2"],
    });
    expect(result.status).toBe("completed_with_errors");
    expect(db.prepare("SELECT status FROM projects").get()).toEqual({
      status: "reviewing_clips",
    });
  });

  it("passes persisted subtitle positioning to the renderer", () => {
    db.prepare(
      `INSERT INTO clips
       (id, project_id, start_seconds, end_seconds, opening_caption,
        subtitle_x, subtitle_y, subtitle_scale, subtitle_align)
       VALUES (?, ?, 0, 20, 'Hook', 32, 28, 1.2, 'left')`,
    ).run("clip-1", "project-1");
    db.prepare(
      `INSERT INTO transcript_segments
       (id, project_id, segment_index, start_seconds, end_seconds, text)
       VALUES ('segment-1', 'project-1', 0, 0, 10, 'Text')`,
    ).run();

    expect(getRenderClip(db, "project-1", "clip-1")).toMatchObject({
      subtitleX: 32,
      subtitleY: 28,
      subtitleScale: 1.2,
      subtitleAlign: "left",
    });
  });
});
