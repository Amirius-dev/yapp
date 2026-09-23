import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/client.js";
import { createProjectsRepository } from "../src/repositories/projects.js";
import { projectDirectory } from "../src/services/project-deletion.js";

const id = "11111111-1111-4111-8111-111111111111";

describe("project deletion", () => {
  let database: ReturnType<typeof createDatabase>;
  beforeEach(() => {
    database = createDatabase(":memory:");
    database.sqlite.pragma("foreign_keys = ON");
    database.sqlite.exec(`
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
        source_file_path TEXT, source_file_name TEXT, source_mime_type TEXT, language TEXT, duration_seconds REAL,
        width INTEGER, height INTEGER, fps REAL, file_size_bytes INTEGER, has_audio INTEGER,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error_message TEXT);
      CREATE TABLE jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL, status TEXT NOT NULL, progress INTEGER NOT NULL, error_message TEXT, payload_json TEXT,
        created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER);
      CREATE TABLE transcript_segments (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        segment_index INTEGER NOT NULL, start_seconds REAL NOT NULL, end_seconds REAL NOT NULL, text TEXT NOT NULL);
      CREATE TABLE clips (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE);
    `);
    database.sqlite
      .prepare(
        "INSERT INTO projects (id,name,mode,status,created_at,updated_at) VALUES (?,'Delete me','long_video_to_shorts','reviewing_clips',1,1)",
      )
      .run(id);
  });
  afterEach(() => database.sqlite.close());

  it("cascades related rows", () => {
    database.sqlite
      .prepare(
        "INSERT INTO jobs (id,project_id,type,status,progress,created_at) VALUES ('j',?,'render_clips','completed',100,1)",
      )
      .run(id);
    database.sqlite
      .prepare("INSERT INTO transcript_segments VALUES ('s',?,0,0,1,'text')")
      .run(id);
    database.sqlite.prepare("INSERT INTO clips VALUES ('c',?)").run(id);
    createProjectsRepository(database.db).delete(id);
    expect(
      database.sqlite.prepare("SELECT count(*) count FROM jobs").get(),
    ).toEqual({ count: 0 });
    expect(
      database.sqlite
        .prepare("SELECT count(*) count FROM transcript_segments")
        .get(),
    ).toEqual({ count: 0 });
    expect(
      database.sqlite.prepare("SELECT count(*) count FROM clips").get(),
    ).toEqual({ count: 0 });
  });

  it("rejects deletion while a job is active", () => {
    database.sqlite
      .prepare(
        "INSERT INTO jobs (id,project_id,type,status,progress,created_at) VALUES ('j',?,'render_clips','running',20,1)",
      )
      .run(id);
    expect(() => createProjectsRepository(database.db).delete(id)).toThrow(
      "Нельзя удалить проект",
    );
  });

  it("rejects a path traversal project directory", () => {
    expect(() => projectDirectory("../outside")).toThrow(
      "Некорректный идентификатор",
    );
  });
});
