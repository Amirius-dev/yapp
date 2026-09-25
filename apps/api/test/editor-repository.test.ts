import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/client.js";
import { createClipsRepository } from "../src/repositories/clips.js";
import { createEditorRepository } from "../src/repositories/editor.js";

const projectId = "11111111-1111-4111-8111-111111111111";

describe("editor repository", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    database = createDatabase(":memory:");
    migrate(database.db, { migrationsFolder: join(process.cwd(), "drizzle") });
    database.sqlite
      .prepare(
        `INSERT INTO projects
         (id, name, mode, status, duration_seconds, created_at, updated_at)
         VALUES (?, 'Editor test', 'long_video_to_shorts', 'ready_for_ai', 180, 1, 1)`,
      )
      .run(projectId);
    const segment = database.sqlite.prepare(
      `INSERT INTO transcript_segments
       (id, project_id, segment_index, start_seconds, end_seconds, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    segment.run("segment-0", projectId, 0, 10, 25, "First sentence");
    segment.run("segment-1", projectId, 1, 100, 122, "Second sentence");
  });

  afterEach(() => database.sqlite.close());

  it("persists the atomic state and invalidates a completed render", async () => {
    const clips = createClipsRepository(database.db);
    const [clip] = clips.import(projectId, {
      schemaVersion: 2,
      projectId,
      clips: [
        {
          title: "Two moments",
          ranges: [
            { start: 10, end: 25, segmentIds: [0] },
            { start: 100, end: 122, segmentIds: [1] },
          ],
          hookScore: 9,
          reason: "A complete story",
          openingCaption: "Two moments",
        },
      ],
    });
    database.sqlite
      .prepare(
        `UPDATE clips SET render_status = 'completed', render_progress = 100,
         output_file_name = 'old.mp4', rendered_at = 10 WHERE id = ?`,
      )
      .run(clip!.id);

    const editor = createEditorRepository(database.db, clips);
    const state = await editor.getState(projectId, clip!.id);
    const saved = await editor.save(projectId, clip!.id, {
      ranges: state.ranges,
      cropKeyframes: state.cropKeyframes,
      subtitleKeyframes: state.subtitleKeyframes,
      frameMode: "fit",
      subtitleX: state.subtitleX,
      subtitleY: state.subtitleY,
      subtitleScale: state.subtitleScale,
      subtitleAlign: state.subtitleAlign,
      templateId: state.templateId,
      accentColor: state.accentColor,
      captionsEnabled: state.captionsEnabled,
      openingCaptionEnabled: false,
      image: { ...state.image, brightness: 118 },
      audio: { ...state.audio, fadeInSeconds: 0.8 },
      subtitleStyle: { ...state.subtitleStyle, maxWords: 5 },
      openingCaption: {
        ...state.openingCaption,
        enabled: false,
        text: "Optional opening",
      },
    });

    expect(saved).toMatchObject({
      frameMode: "fit",
      image: { brightness: 118 },
      audio: { fadeInSeconds: 0.8 },
      subtitleStyle: { maxWords: 5 },
      clip: {
        renderStatus: "idle",
        outputFileName: null,
      },
    });
    expect(saved.ranges).toHaveLength(2);
    expect(saved.cropKeyframes).toHaveLength(2);
    const persisted = database.sqlite
      .prepare(
        `SELECT crop_mode, render_status, output_file_name,
                image_settings_json, audio_settings_json
         FROM clips WHERE id = ?`,
      )
      .get(clip!.id) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      crop_mode: "fit",
      render_status: "idle",
      output_file_name: null,
    });
    expect(JSON.parse(String(persisted.image_settings_json))).toMatchObject({
      brightness: 118,
    });
  });
});
