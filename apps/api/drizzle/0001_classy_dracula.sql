CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_project_id_idx` ON `jobs` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_one_active_transcription_idx` ON `jobs` (`project_id`,`type`) WHERE "jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`segment_index` integer NOT NULL,
	`start_seconds` real NOT NULL,
	`end_seconds` real NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcript_segments_project_index_unique` ON `transcript_segments` (`project_id`,`segment_index`);--> statement-breakpoint
ALTER TABLE `projects` ADD `language` text;