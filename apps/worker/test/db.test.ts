import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import {
  claimNextJob,
  completeJob,
  recoverInterruptedJobs,
} from "../src/db.js";

function createTestDatabase() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      source_file_path TEXT,
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
});
