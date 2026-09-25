import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import type {
  AudioSettings,
  ImageAdjustments,
  OpeningCaptionSettings,
  SubtitleStyle,
  TranscriptSegmentDto,
  TranscriptWordDto,
} from "@studio/contracts";
import {
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  imageAdjustmentsSchema,
  openingCaptionSettingsSchema,
  subtitleStyleSchema,
} from "@studio/contracts";
import { z, type ZodType } from "zod";
import { dataRoot, databasePath } from "./config.js";

export type ClaimedTranscriptionJob = {
  id: string;
  projectId: string;
  type: "transcription";
  sourcePath: string;
};

export type ClaimedRenderJob = {
  id: string;
  projectId: string;
  type: "render_clips";
  sourcePath: string;
  sourceHasAudio: boolean;
  clipIds: string[];
};

export type ClaimedJob = ClaimedTranscriptionJob | ClaimedRenderJob;

const renderPayloadSchema = z.object({
  projectId: z.string().min(1),
  clipIds: z.array(z.string().min(1)).min(1),
});

function parseRenderPayload(value: string | null) {
  try {
    return renderPayloadSchema.safeParse(value ? JSON.parse(value) : null);
  } catch {
    return renderPayloadSchema.safeParse(null);
  }
}

export function openWorkerDatabase(path = databasePath) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function recoverInterruptedJobs(db: Database.Database) {
  const transcriptionRows = db
    .prepare(
      "SELECT id, project_id FROM jobs WHERE type = 'transcription' AND status = 'running'",
    )
    .all() as Array<{ id: string; project_id: string }>;
  const now = Date.now();
  const message =
    "Worker был остановлен во время транскрипции. Запустите задачу повторно.";
  const renderRows = db
    .prepare(
      "SELECT id, project_id, payload_json FROM jobs WHERE type = 'render_clips' AND status = 'running'",
    )
    .all() as Array<{
    id: string;
    project_id: string;
    payload_json: string | null;
  }>;
  const recover = db.transaction(() => {
    for (const row of transcriptionRows) {
      db.prepare(
        "UPDATE jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?",
      ).run(message, now, row.id);
      const hasPublishedTranscript = Boolean(
        db
          .prepare(
            "SELECT 1 FROM transcript_segments WHERE project_id = ? LIMIT 1",
          )
          .get(row.project_id),
      );
      db.prepare(
        "UPDATE projects SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
      ).run(
        hasPublishedTranscript ? "ready_for_ai" : "failed",
        message,
        now,
        row.project_id,
      );
    }
    for (const row of renderRows) {
      const renderMessage =
        "Worker был остановлен во время рендера. Повторите failed clips.";
      db.prepare(
        "UPDATE jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?",
      ).run(renderMessage, now, row.id);
      const payload = parseRenderPayload(row.payload_json);
      if (payload.success) {
        const update = db.prepare(
          "UPDATE clips SET render_status = 'failed', render_error = ?, render_progress = 0 WHERE id = ? AND render_status IN ('queued', 'rendering')",
        );
        for (const clipId of payload.data.clipIds)
          update.run(renderMessage, clipId);
      }
      db.prepare(
        "UPDATE projects SET status = 'reviewing_clips', error_message = ?, updated_at = ? WHERE id = ?",
      ).run(renderMessage, now, row.project_id);
    }
  });
  recover.immediate();
  return transcriptionRows.length + renderRows.length;
}

export function claimNextJob(db: Database.Database): ClaimedJob | null {
  const claim = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT jobs.id, jobs.project_id, jobs.type, jobs.payload_json,
                projects.source_file_path, projects.has_audio
         FROM jobs JOIN projects ON projects.id = jobs.project_id
         WHERE jobs.status = 'queued'
         ORDER BY jobs.created_at ASC LIMIT 1`,
      )
      .get() as
      | {
          id: string;
          project_id: string;
          type: "transcription" | "render_clips";
          payload_json: string | null;
          source_file_path: string | null;
          has_audio: number | null;
        }
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
      "UPDATE projects SET status = ?, error_message = NULL, updated_at = ? WHERE id = ?",
    ).run(
      row.type === "transcription" ? "transcribing" : "rendering",
      now,
      row.project_id,
    );

    const absolutePath = resolve(dataRoot, row.source_file_path);
    if (!absolutePath.startsWith(`${dataRoot}${sep}`)) {
      throw new Error(
        "Путь исходного файла выходит за пределы data directory.",
      );
    }
    if (row.type === "transcription") {
      return {
        id: row.id,
        projectId: row.project_id,
        type: "transcription" as const,
        sourcePath: absolutePath,
      };
    }
    const payload = parseRenderPayload(row.payload_json);
    if (!payload.success || payload.data.projectId !== row.project_id)
      throw new Error("Render job содержит некорректный payload.");
    return {
      id: row.id,
      projectId: row.project_id,
      type: "render_clips" as const,
      sourcePath: absolutePath,
      sourceHasAudio: Boolean(row.has_audio),
      clipIds: payload.data.clipIds,
    };
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
  job: ClaimedTranscriptionJob,
  language: string,
  segments: Omit<TranscriptSegmentDto, "id">[],
  words: Omit<TranscriptWordDto, "id">[],
) {
  const complete = db.transaction(() => {
    db.prepare("DELETE FROM transcript_segments WHERE project_id = ?").run(
      job.projectId,
    );
    db.prepare("DELETE FROM transcript_words WHERE project_id = ?").run(
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
    const insertWord = db.prepare(
      `INSERT INTO transcript_words
       (id, project_id, segment_index, word_index, start_seconds, end_seconds, text, probability)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const word of words) {
      insertWord.run(
        randomUUID(),
        job.projectId,
        word.segmentIndex,
        word.wordIndex,
        word.startSeconds,
        word.endSeconds,
        word.text,
        word.probability,
      );
    }
    const now = Date.now();
    db.prepare(
      "UPDATE jobs SET status = 'completed', progress = 100, finished_at = ?, error_message = NULL WHERE id = ?",
    ).run(now, job.id);
    db.prepare(
      "UPDATE projects SET status = 'ready_for_ai', language = ?, error_message = NULL, updated_at = ? WHERE id = ?",
    ).run(language, now, job.projectId);
    db.prepare(
      `UPDATE clips SET render_status = 'idle', render_progress = 0,
       render_error = NULL, output_file_name = NULL, rendered_at = NULL,
       updated_at = ? WHERE project_id = ?`,
    ).run(now, job.projectId);
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
    const hasTranscript = Boolean(
      db
        .prepare(
          "SELECT 1 FROM transcript_segments WHERE project_id = ? LIMIT 1",
        )
        .get(job.projectId),
    );
    db.prepare(
      "UPDATE projects SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
    ).run(
      hasTranscript ? "ready_for_ai" : "failed",
      message,
      now,
      job.projectId,
    );
  });
  fail.immediate();
}

export type RenderClipData = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  openingCaption: string;
  cropMode: "fill" | "fit";
  cropX: number;
  cropY: number;
  zoom: number;
  subtitleX: number;
  subtitleY: number;
  subtitleScale: number;
  subtitleAlign: "left" | "center" | "right";
  templateId: "clean" | "motivational" | "podcast";
  accentColor: string;
  captionsEnabled: boolean;
  openingCaptionEnabled: boolean;
  image: ImageAdjustments;
  audio: AudioSettings;
  subtitleStyle: SubtitleStyle;
  openingCaptionSettings: OpeningCaptionSettings;
  ranges: Array<{
    id: string;
    start: number;
    end: number;
    transition: {
      type: "hard-cut" | "crossfade" | "dip-to-black";
      durationSeconds: number;
    };
  }>;
  cropKeyframes: Array<{
    rangeId: string;
    sourceTimeSeconds: number;
    cropX: number;
    cropY: number;
    zoom: number;
    easing: "linear" | "ease-in-out" | "hold";
  }>;
  subtitleKeyframes: Array<{
    rangeId: string;
    sourceTimeSeconds: number;
    subtitleX: number;
    subtitleY: number;
    subtitleScale: number;
    subtitleAlign: "left" | "center" | "right";
    transition: "hold" | "smooth";
  }>;
  segments: Array<{ startSeconds: number; endSeconds: number; text: string }>;
  words: Array<{ startSeconds: number; endSeconds: number; text: string }>;
};

function parseSettings<T>(schema: ZodType<T>, value: string, fallback: T) {
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function getRenderClip(
  db: Database.Database,
  projectId: string,
  clipId: string,
): RenderClipData {
  const clip = db
    .prepare(
      `SELECT id, start_seconds, end_seconds, opening_caption,
              crop_mode, crop_x, crop_y, zoom,
              subtitle_x, subtitle_y, subtitle_scale, subtitle_align,
              template_id, accent_color, captions_enabled, opening_caption_enabled,
              image_settings_json, audio_settings_json, subtitle_style_json,
              opening_caption_settings_json
       FROM clips WHERE id = ? AND project_id = ?`,
    )
    .get(clipId, projectId) as
    | {
        id: string;
        start_seconds: number;
        end_seconds: number;
        opening_caption: string;
        crop_mode: "fill" | "fit";
        crop_x: number;
        crop_y: number;
        zoom: number;
        subtitle_x: number;
        subtitle_y: number;
        subtitle_scale: number;
        subtitle_align: "left" | "center" | "right";
        template_id: "clean" | "motivational" | "podcast";
        accent_color: string;
        captions_enabled: number;
        opening_caption_enabled: number;
        image_settings_json: string;
        audio_settings_json: string;
        subtitle_style_json: string;
        opening_caption_settings_json: string;
      }
    | undefined;
  if (!clip) throw new Error("Clip не найден в render job.");
  const rangeRows = db
    .prepare(
      `SELECT id, start_seconds, end_seconds, transition_type, transition_duration_seconds FROM clip_ranges
     WHERE clip_id = ? ORDER BY range_order`,
    )
    .all(clipId) as Array<{
    id: string;
    start_seconds: number;
    end_seconds: number;
    transition_type: "hard-cut" | "crossfade" | "dip-to-black";
    transition_duration_seconds: number;
  }>;
  const ranges = rangeRows.length
    ? rangeRows.map((range) => ({
        id: range.id,
        start: range.start_seconds,
        end: range.end_seconds,
        transition: {
          type: range.transition_type,
          durationSeconds: range.transition_duration_seconds,
        },
      }))
    : [
        {
          id: clip.id,
          start: clip.start_seconds,
          end: clip.end_seconds,
          transition: { type: "hard-cut" as const, durationSeconds: 0 },
        },
      ];
  const segments = db
    .prepare(
      `SELECT start_seconds, end_seconds, text FROM transcript_segments
       WHERE project_id = ? AND end_seconds > ? AND start_seconds < ?
       ORDER BY segment_index`,
    )
    .all(projectId, clip.start_seconds, clip.end_seconds) as Array<{
    start_seconds: number;
    end_seconds: number;
    text: string;
  }>;
  const words = db
    .prepare(
      `SELECT start_seconds, end_seconds, text FROM transcript_words
     WHERE project_id = ? AND end_seconds > ? AND start_seconds < ?
     ORDER BY start_seconds`,
    )
    .all(projectId, clip.start_seconds, clip.end_seconds) as Array<{
    start_seconds: number;
    end_seconds: number;
    text: string;
  }>;
  const cropFrames = db
    .prepare(
      `SELECT range_id, source_time_seconds, crop_x, crop_y, zoom, easing
     FROM crop_keyframes WHERE clip_id = ? ORDER BY source_time_seconds`,
    )
    .all(clipId) as Array<{
    range_id: string;
    source_time_seconds: number;
    crop_x: number;
    crop_y: number;
    zoom: number;
    easing: "linear" | "ease-in-out" | "hold";
  }>;
  const subtitleFrames = db
    .prepare(
      `SELECT range_id, source_time_seconds, subtitle_x, subtitle_y, subtitle_scale, subtitle_align, transition
     FROM subtitle_keyframes WHERE clip_id = ? ORDER BY source_time_seconds`,
    )
    .all(clipId) as Array<{
    range_id: string;
    source_time_seconds: number;
    subtitle_x: number;
    subtitle_y: number;
    subtitle_scale: number;
    subtitle_align: "left" | "center" | "right";
    transition: "hold" | "smooth";
  }>;
  return {
    id: clip.id,
    startSeconds: clip.start_seconds,
    endSeconds: clip.end_seconds,
    openingCaption: clip.opening_caption,
    cropMode: clip.crop_mode,
    cropX: clip.crop_x,
    cropY: clip.crop_y,
    zoom: clip.zoom,
    subtitleX: clip.subtitle_x,
    subtitleY: clip.subtitle_y,
    subtitleScale: clip.subtitle_scale,
    subtitleAlign: clip.subtitle_align,
    templateId: clip.template_id,
    accentColor: clip.accent_color,
    captionsEnabled: Boolean(clip.captions_enabled),
    openingCaptionEnabled: Boolean(clip.opening_caption_enabled),
    image: parseSettings(
      imageAdjustmentsSchema,
      clip.image_settings_json,
      DEFAULT_IMAGE_ADJUSTMENTS,
    ),
    audio: parseSettings(
      audioSettingsSchema,
      clip.audio_settings_json,
      DEFAULT_AUDIO_SETTINGS,
    ),
    subtitleStyle: parseSettings(
      subtitleStyleSchema,
      clip.subtitle_style_json,
      DEFAULT_SUBTITLE_STYLE,
    ),
    openingCaptionSettings: parseSettings(
      openingCaptionSettingsSchema,
      clip.opening_caption_settings_json,
      { ...DEFAULT_OPENING_CAPTION_SETTINGS, text: clip.opening_caption },
    ),
    ranges,
    cropKeyframes: cropFrames.map((frame) => ({
      rangeId: frame.range_id,
      sourceTimeSeconds: frame.source_time_seconds,
      cropX: frame.crop_x,
      cropY: frame.crop_y,
      zoom: frame.zoom,
      easing: frame.easing,
    })),
    subtitleKeyframes: subtitleFrames.map((frame) => ({
      rangeId: frame.range_id,
      sourceTimeSeconds: frame.source_time_seconds,
      subtitleX: frame.subtitle_x,
      subtitleY: frame.subtitle_y,
      subtitleScale: frame.subtitle_scale,
      subtitleAlign: frame.subtitle_align,
      transition: frame.transition,
    })),
    segments: segments.map((segment) => ({
      startSeconds: segment.start_seconds,
      endSeconds: segment.end_seconds,
      text: segment.text,
    })),
    words: words.map((word) => ({
      startSeconds: word.start_seconds,
      endSeconds: word.end_seconds,
      text: word.text,
    })),
  };
}

export function startRenderClip(db: Database.Database, clipId: string) {
  db.prepare(
    "UPDATE clips SET render_status = 'rendering', render_progress = 1, render_error = NULL WHERE id = ?",
  ).run(clipId);
}

export function updateRenderProgress(
  db: Database.Database,
  job: ClaimedRenderJob,
  clipId: string,
  clipIndex: number,
  clipProgress: number,
) {
  const bounded = Math.max(1, Math.min(99, Math.round(clipProgress)));
  db.prepare("UPDATE clips SET render_progress = ? WHERE id = ?").run(
    bounded,
    clipId,
  );
  const total = Math.round(
    ((clipIndex + bounded / 100) / job.clipIds.length) * 99,
  );
  updateProgress(db, job.id, total);
}

export function completeRenderClip(
  db: Database.Database,
  clipId: string,
  outputFileName: string,
) {
  db.prepare(
    `UPDATE clips SET render_status = 'completed', render_progress = 100,
     render_error = NULL, output_file_name = ?, rendered_at = ? WHERE id = ?`,
  ).run(outputFileName, Date.now(), clipId);
}

export function failRenderClip(
  db: Database.Database,
  clipId: string,
  message: string,
) {
  db.prepare(
    "UPDATE clips SET render_status = 'failed', render_progress = 0, render_error = ? WHERE id = ?",
  ).run(message, clipId);
}

export function finalizeRenderJob(
  db: Database.Database,
  job: ClaimedRenderJob,
) {
  const placeholders = job.clipIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT render_status FROM clips WHERE id IN (${placeholders})`)
    .all(...job.clipIds) as Array<{ render_status: string }>;
  const completed = rows.filter(
    (row) => row.render_status === "completed",
  ).length;
  const failed = rows.filter((row) => row.render_status === "failed").length;
  const status =
    failed === 0
      ? "completed"
      : completed > 0
        ? "completed_with_errors"
        : "failed";
  const projectStatus = failed === 0 ? "completed" : "reviewing_clips";
  const message = failed
    ? `${failed} из ${rows.length} clips завершились с ошибкой.`
    : null;
  const now = Date.now();
  const finish = db.transaction(() => {
    db.prepare(
      "UPDATE jobs SET status = ?, progress = 100, error_message = ?, finished_at = ? WHERE id = ?",
    ).run(status, message, now, job.id);
    db.prepare(
      "UPDATE projects SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
    ).run(projectStatus, message, now, job.projectId);
  });
  finish.immediate();
  return { status, completed, failed };
}
