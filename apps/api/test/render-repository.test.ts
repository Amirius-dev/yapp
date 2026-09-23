import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/client.js";
import { createRenderRepository } from "../src/repositories/render.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const clipIds = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

describe("render repository", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    database = createDatabase(":memory:");
    database.sqlite.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
        source_file_path TEXT, source_file_name TEXT, source_mime_type TEXT, language TEXT,
        duration_seconds REAL, width INTEGER, height INTEGER, fps REAL, file_size_bytes INTEGER,
        has_audio INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error_message TEXT
      );
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
        progress INTEGER NOT NULL, error_message TEXT, created_at INTEGER NOT NULL,
        started_at INTEGER, finished_at INTEGER, payload_json TEXT
      );
      CREATE TABLE clips (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
        start_seconds REAL NOT NULL, end_seconds REAL NOT NULL, hook_score INTEGER NOT NULL,
        reason TEXT NOT NULL, opening_caption TEXT NOT NULL, segment_ids_json TEXT NOT NULL,
        enabled INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        crop_mode TEXT NOT NULL DEFAULT 'fill', crop_x REAL NOT NULL DEFAULT 50,
        crop_y REAL NOT NULL DEFAULT 50, zoom REAL NOT NULL DEFAULT 1,
        subtitle_x REAL NOT NULL DEFAULT 50, subtitle_y REAL NOT NULL DEFAULT 72,
        subtitle_scale REAL NOT NULL DEFAULT 1, subtitle_align TEXT NOT NULL DEFAULT 'center',
        render_status TEXT NOT NULL DEFAULT 'idle', render_progress INTEGER NOT NULL DEFAULT 0,
        render_error TEXT, output_file_name TEXT, rendered_at INTEGER
      );
    `);
    database.sqlite
      .prepare(
        `INSERT INTO projects (id, name, mode, status, source_file_path, created_at, updated_at)
       VALUES (?, 'Test', 'long_video_to_shorts', 'reviewing_clips', 'projects/source.mp4', 1, 1)`,
      )
      .run(projectId);
    const insert = database.sqlite.prepare(
      `INSERT INTO clips (id, project_id, title, start_seconds, end_seconds, hook_score,
       reason, opening_caption, segment_ids_json, enabled, created_at, updated_at, render_status)
       VALUES (?, ?, ?, 0, 20, 8, 'Reason', 'Hook', '[0]', ?, 1, 1, ?)`,
    );
    insert.run(clipIds[0], projectId, "Enabled", 1, "idle");
    insert.run(clipIds[1], projectId, "Disabled", 0, "idle");
  });

  afterEach(() => database.sqlite.close());

  it("queues only enabled clips and returns an active job on duplicate start", () => {
    const repository = createRenderRepository(database.db);
    const first = repository.enqueue(projectId, {});
    const duplicate = repository.enqueue(projectId, {});
    expect(duplicate.id).toBe(first.id);
    const payload = database.sqlite
      .prepare("SELECT payload_json FROM jobs")
      .get() as { payload_json: string };
    expect(JSON.parse(payload.payload_json).clipIds).toEqual([clipIds[0]]);
  });

  it("retries a failed clip without overwriting completed output", () => {
    database.sqlite
      .prepare(
        "UPDATE clips SET enabled = 1, render_status = 'failed' WHERE id = ?",
      )
      .run(clipIds[0]);
    database.sqlite
      .prepare(
        "UPDATE clips SET enabled = 1, render_status = 'completed' WHERE id = ?",
      )
      .run(clipIds[1]);
    const repository = createRenderRepository(database.db);
    repository.enqueue(projectId, {});
    const payload = database.sqlite
      .prepare("SELECT payload_json FROM jobs")
      .get() as { payload_json: string };
    expect(JSON.parse(payload.payload_json).clipIds).toEqual([clipIds[0]]);
  });

  it("rejects an explicitly selected disabled clip", () => {
    const repository = createRenderRepository(database.db);
    expect(() =>
      repository.enqueue(projectId, { clipIds: [clipIds[1]!] }),
    ).toThrow("disabled");
  });

  it("allows an explicit forced rerender of a completed clip", () => {
    database.sqlite
      .prepare("UPDATE clips SET render_status = 'completed' WHERE id = ?")
      .run(clipIds[0]);
    const repository = createRenderRepository(database.db);
    const job = repository.enqueue(projectId, {
      clipIds: [clipIds[0]!],
      force: true,
    });
    expect(job.status).toBe("queued");
  });
});
