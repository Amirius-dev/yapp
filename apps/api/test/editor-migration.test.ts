import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
} from "@studio/contracts";

describe("stage 7 editor migration", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE clips (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
        start_seconds REAL NOT NULL, end_seconds REAL NOT NULL,
        hook_score INTEGER NOT NULL, reason TEXT NOT NULL,
        opening_caption TEXT NOT NULL, segment_ids_json TEXT NOT NULL,
        enabled INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE clip_ranges (
        id TEXT PRIMARY KEY, clip_id TEXT NOT NULL, range_order INTEGER NOT NULL,
        start_seconds REAL NOT NULL, end_seconds REAL NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      INSERT INTO clips VALUES (
        'old-clip', 'project', 'Old clip', 10, 30, 8, 'Reason', 'Hook', '[1]', 1, 1, 1
      );
      INSERT INTO clip_ranges VALUES ('old-range', 'old-clip', 0, 10, 30, 1, 1);
    `);
  });

  afterEach(() => sqlite.close());

  it("adds safe defaults without deleting an existing clip", () => {
    const sql = readFileSync(
      join(process.cwd(), "drizzle", "0009_tough_lizard.sql"),
      "utf8",
    );
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
    const clip = sqlite
      .prepare(
        `SELECT image_settings_json, audio_settings_json,
                subtitle_style_json, opening_caption_settings_json
         FROM clips WHERE id = 'old-clip'`,
      )
      .get() as Record<string, string>;
    expect(JSON.parse(clip.image_settings_json!)).toEqual(
      DEFAULT_IMAGE_ADJUSTMENTS,
    );
    expect(JSON.parse(clip.audio_settings_json!)).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(JSON.parse(clip.subtitle_style_json!)).toEqual(
      DEFAULT_SUBTITLE_STYLE,
    );
    expect(JSON.parse(clip.opening_caption_settings_json!)).toEqual(
      DEFAULT_OPENING_CAPTION_SETTINGS,
    );
    expect(
      sqlite
        .prepare(
          "SELECT transition_type, transition_duration_seconds FROM clip_ranges WHERE id = 'old-range'",
        )
        .get(),
    ).toEqual({
      transition_type: "hard-cut",
      transition_duration_seconds: 0,
    });
  });
});
