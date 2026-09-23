import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/client.js";
import { createTranscriptionRepository } from "../src/repositories/transcription.js";

describe("transcription repository", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    database = createDatabase(":memory:");
    database.sqlite.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'long_video_to_shorts',
        status TEXT NOT NULL DEFAULT 'created',
        source_file_path TEXT,
        source_file_name TEXT,
        source_mime_type TEXT,
        language TEXT,
        duration_seconds REAL,
        width INTEGER,
        height INTEGER,
        fps REAL,
        file_size_bytes INTEGER,
        has_audio INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        error_message TEXT
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
        finished_at INTEGER, payload_json TEXT
      );
      CREATE UNIQUE INDEX jobs_one_active_transcription_idx
        ON jobs(project_id, type) WHERE status IN ('queued', 'running');
      CREATE TABLE transcript_segments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        segment_index INTEGER NOT NULL,
        start_seconds REAL NOT NULL,
        end_seconds REAL NOT NULL,
        text TEXT NOT NULL
      );
    `);
  });

  afterEach(() => database.sqlite.close());

  it("returns the existing active job instead of creating a duplicate", async () => {
    const projectId = randomUUID();
    const now = Date.now();
    database.sqlite
      .prepare(
        `INSERT INTO projects
         (id, name, status, source_file_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectId,
        "Test",
        "ready_for_transcription",
        "projects/test/source/a.mp4",
        now,
        now,
      );
    const repository = createTranscriptionRepository(database.db, "tiny");

    const first = await repository.enqueue(projectId);
    const second = await repository.enqueue(projectId);

    expect(first.created).toBe(true);
    expect(second).toMatchObject({ created: false, job: { id: first.job.id } });
    expect(
      database.sqlite.prepare("SELECT COUNT(*) AS count FROM jobs").get(),
    ).toEqual({ count: 1 });
  });
});
