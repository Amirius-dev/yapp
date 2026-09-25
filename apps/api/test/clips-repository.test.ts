import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clipUpdateSchema,
  subtitleSafeWidthPercent,
  type AiResponseV2,
} from "@studio/contracts";
import { createDatabase } from "../src/db/client.js";
import { createClipsRepository } from "../src/repositories/clips.js";

const projectId = "11111111-1111-4111-8111-111111111111";

function response(count: number): AiResponseV2 {
  return {
    schemaVersion: 2,
    projectId,
    clips: Array.from({ length: count }, (_, index) => ({
      title: `Clip ${index + 1}`,
      ranges: [
        {
          start: index * 40,
          end: index * 40 + 20,
          segmentIds: [index * 2],
        },
      ],
      hookScore: 8,
      reason: "Test reason",
      openingCaption: "Test hook",
    })),
  };
}

describe("clips repository", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    database = createDatabase(":memory:");
    database.sqlite.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL,
        status TEXT NOT NULL, source_file_path TEXT, source_file_name TEXT,
        source_mime_type TEXT, language TEXT, duration_seconds REAL,
        width INTEGER, height INTEGER, fps REAL, file_size_bytes INTEGER,
        has_audio INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        error_message TEXT
      );
      CREATE TABLE transcript_segments (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, segment_index INTEGER NOT NULL,
        start_seconds REAL NOT NULL, end_seconds REAL NOT NULL, text TEXT NOT NULL
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
        template_id TEXT NOT NULL DEFAULT 'clean', accent_color TEXT NOT NULL DEFAULT '#8f7cff',
        captions_enabled INTEGER NOT NULL DEFAULT 1, opening_caption_enabled INTEGER NOT NULL DEFAULT 1,
        image_settings_json TEXT NOT NULL DEFAULT '{"brightness":100,"exposure":0,"contrast":100,"saturation":100,"temperature":0,"tint":0,"sharpness":0,"blur":0,"vignette":0,"opacity":100,"rotation":0,"flipHorizontal":false,"zoom":1,"positionX":50,"positionY":50,"backgroundBlur":42,"backgroundDim":0.28,"backgroundSaturation":0.78}',
        audio_settings_json TEXT NOT NULL DEFAULT '{"volume":1,"muted":false,"fadeInSeconds":0,"fadeOutSeconds":0,"normalize":false,"noiseReduction":false,"music":null}',
        subtitle_style_json TEXT NOT NULL DEFAULT '{"fontFamily":"Arial","fontWeight":900,"textColor":"#ffffff","activeWordColor":"#ff6b00","backgroundColor":"#000000","backgroundOpacity":0,"outlineColor":"#000000","outlineWidth":4,"shadow":true,"borderRadius":10,"paddingHorizontal":20,"paddingVertical":10,"maxWords":6,"maxLines":2,"animation":"minimal","uppercase":false}',
        opening_caption_settings_json TEXT NOT NULL DEFAULT '{"enabled":false,"text":"","x":50,"y":22,"scale":1,"color":"#ffffff","backgroundColor":"#000000","backgroundOpacity":0.55,"durationSeconds":3,"animation":"fade"}',
        render_status TEXT NOT NULL DEFAULT 'idle', render_progress INTEGER NOT NULL DEFAULT 0,
        render_error TEXT, output_file_name TEXT, rendered_at INTEGER
      );
      CREATE TABLE clip_ranges (
        id TEXT PRIMARY KEY, clip_id TEXT NOT NULL, range_order INTEGER NOT NULL,
        start_seconds REAL NOT NULL, end_seconds REAL NOT NULL,
        transition_type TEXT NOT NULL DEFAULT 'hard-cut',
        transition_duration_seconds REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
    `);
    database.sqlite
      .prepare(
        `INSERT INTO projects
        (id, name, mode, status, duration_seconds, created_at, updated_at)
        VALUES (?, 'Test', 'long_video_to_shorts', 'ready_for_ai', 120, 1, 1)`,
      )
      .run(projectId);
    const insertSegment = database.sqlite.prepare(
      `INSERT INTO transcript_segments
       (id, project_id, segment_index, start_seconds, end_seconds, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (let index = 0; index < 6; index += 1) {
      insertSegment.run(
        `segment-${index}`,
        projectId,
        index,
        index * 20,
        index * 20 + 20,
        "Text",
      );
    }
  });

  afterEach(() => database.sqlite.close());

  it("atomically replaces an earlier imported set", async () => {
    const repository = createClipsRepository(database.db);
    repository.import(projectId, response(2));
    expect(await repository.list(projectId)).toHaveLength(2);

    repository.import(projectId, response(1));
    const clips = await repository.list(projectId);
    expect(clips).toHaveLength(1);
    expect(clips[0]?.title).toBe("Clip 1");
    expect(
      database.sqlite
        .prepare("SELECT status FROM projects WHERE id = ?")
        .get(projectId),
    ).toEqual({ status: "reviewing_clips" });
  });

  it("recalculates segmentIds after changing timestamps", async () => {
    const repository = createClipsRepository(database.db);
    const [clip] = repository.import(projectId, response(1));
    const updated = repository.update(projectId, clip!.id, {
      start: 20,
      end: 40,
    });
    expect(updated.segmentIds).toEqual([1]);
    expect((await repository.list(projectId))[0]?.segmentIds).toEqual([1]);
  });

  it("rejects a changed range without transcript segments", () => {
    const repository = createClipsRepository(database.db);
    const [clip] = repository.import(projectId, response(1));
    database.sqlite.prepare("DELETE FROM transcript_segments").run();
    expect(() =>
      repository.update(projectId, clip!.id, { start: 80, end: 100 }),
    ).toThrow("не пересекается ни с одним сегментом");
  });

  it("uses safe crop defaults and validates persisted crop settings", async () => {
    const repository = createClipsRepository(database.db);
    const [clip] = repository.import(projectId, response(1));
    expect(clip).toMatchObject({
      cropMode: "fill",
      cropX: 50,
      cropY: 50,
      zoom: 1,
      subtitleX: 50,
      subtitleY: 72,
      subtitleScale: 1,
      subtitleAlign: "center",
    });
    database.sqlite
      .prepare(
        "UPDATE clips SET render_status = 'completed', output_file_name = 'old.mp4' WHERE id = ?",
      )
      .run(clip!.id);
    const updated = repository.update(projectId, clip!.id, {
      cropMode: "fit",
      cropX: 15,
      cropY: 80,
      zoom: 1.25,
    });
    expect(updated).toMatchObject({
      cropMode: "fit",
      cropX: 15,
      cropY: 80,
      zoom: 1.25,
      renderStatus: "idle",
      outputFileName: null,
    });
  });

  it("validates and persists subtitle safe-zone settings", () => {
    expect(
      clipUpdateSchema.safeParse({ subtitleX: 14, subtitleY: 72 }).success,
    ).toBe(false);
    expect(
      clipUpdateSchema.safeParse({ subtitleX: 50, subtitleY: 85 }).success,
    ).toBe(false);
    expect(clipUpdateSchema.safeParse({ subtitleScale: 1.51 }).success).toBe(
      false,
    );
    expect(subtitleSafeWidthPercent(15, 1.5) * 1.5).toBe(20);
    expect(subtitleSafeWidthPercent(50, 1)).toBe(85);

    const repository = createClipsRepository(database.db);
    const [clip] = repository.import(projectId, response(1));
    const updated = repository.update(projectId, clip!.id, {
      subtitleX: 35,
      subtitleY: 28,
      subtitleScale: 1.2,
      subtitleAlign: "left",
    });
    expect(updated).toMatchObject({
      subtitleX: 35,
      subtitleY: 28,
      subtitleScale: 1.2,
      subtitleAlign: "left",
      renderStatus: "idle",
    });
  });
});
