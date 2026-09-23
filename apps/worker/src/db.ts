import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import type { TranscriptSegmentDto } from "@studio/contracts";
import { dataRoot, databasePath } from "./config.js";

export type ClaimedJob = {
  id: string;
  projectId: string;
  sourcePath: string;
};

export function openWorkerDatabase(path = databasePath) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function recoverInterruptedJobs(db: Database.Database) {
  const rows = db
    .prepare(
      "SELECT id, project_id FROM jobs WHERE type = 'transcription' AND status = 'running'",
    )
    .all() as Array<{ id: string; project_id: string }>;
  const now = Date.now();
  const message =
    "Worker был остановлен во время транскрипции. Запустите задачу повторно.";
  const recover = db.transaction(() => {
    for (const row of rows) {
      db.prepare(
        "UPDATE jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?",
      ).run(message, now, row.id);
      db.prepare(
        "UPDATE projects SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
      ).run(message, now, row.project_id);
    }
  });
  recover.immediate();
  return rows.length;
}

export function claimNextJob(db: Database.Database): ClaimedJob | null {
  const claim = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT jobs.id, jobs.project_id, projects.source_file_path
         FROM jobs JOIN projects ON projects.id = jobs.project_id
         WHERE jobs.type = 'transcription' AND jobs.status = 'queued'
         ORDER BY jobs.created_at ASC LIMIT 1`,
      )
      .get() as
      | { id: string; project_id: string; source_file_path: string | null }
      | undefined;
    if (!row) return null;
    if (!row.source_file_path) {
      throw new Error("У проекта отсутствует исходный видеофайл.");
    }
    const now = Date.now();
    const changed = db
      .prepare(
        "UPDATE jobs SET status = 'running', progress = 1, started_at = ?, error_message = NULL WHERE id = ? AND status = 'queued'",
      )
      .run(now, row.id).changes;
    if (changed !== 1) return null;
    db.prepare(
      "UPDATE projects SET status = 'transcribing', error_message = NULL, updated_at = ? WHERE id = ?",
    ).run(now, row.project_id);

    const absolutePath = resolve(dataRoot, row.source_file_path);
    if (!absolutePath.startsWith(`${dataRoot}${sep}`)) {
      throw new Error(
        "Путь исходного файла выходит за пределы data directory.",
      );
    }
    return { id: row.id, projectId: row.project_id, sourcePath: absolutePath };
  });
  return claim.immediate();
}

export function updateProgress(
  db: Database.Database,
  jobId: string,
  progress: number,
) {
  db.prepare(
    "UPDATE jobs SET progress = ? WHERE id = ? AND status = 'running'",
  ).run(Math.max(1, Math.min(99, Math.round(progress))), jobId);
}

export function completeJob(
  db: Database.Database,
  job: ClaimedJob,
  language: string,
  segments: Omit<TranscriptSegmentDto, "id">[],
) {
  const complete = db.transaction(() => {
    db.prepare("DELETE FROM transcript_segments WHERE project_id = ?").run(
      job.projectId,
    );
    const insert = db.prepare(
      `INSERT INTO transcript_segments
       (id, project_id, segment_index, start_seconds, end_seconds, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const segment of segments) {
      insert.run(
        randomUUID(),
        job.projectId,
        segment.segmentIndex,
        segment.startSeconds,
        segment.endSeconds,
        segment.text,
      );
    }
    const now = Date.now();
    db.prepare(
      "UPDATE jobs SET status = 'completed', progress = 100, finished_at = ?, error_message = NULL WHERE id = ?",
    ).run(now, job.id);
    db.prepare(
      "UPDATE projects SET status = 'ready_for_ai', language = ?, error_message = NULL, updated_at = ? WHERE id = ?",
    ).run(language, now, job.projectId);
  });
  complete.immediate();
}

export function failJob(
  db: Database.Database,
  job: ClaimedJob,
  message: string,
) {
  const fail = db.transaction(() => {
    const now = Date.now();
    db.prepare(
      "UPDATE jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?",
    ).run(message, now, job.id);
    db.prepare(
      "UPDATE projects SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
    ).run(message, now, job.projectId);
  });
  fail.immediate();
}
