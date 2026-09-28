CREATE TABLE `editor_documents` (
	`clip_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 2 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`document_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `editor_media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`clip_id` text,
	`kind` text NOT NULL,
	`stored_file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`duration_seconds` real,
	`width` integer,
	`height` integer,
	`file_size_bytes` integer NOT NULL,
	`waveform_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `editor_media_assets_project_idx` ON `editor_media_assets` (`project_id`);--> statement-breakpoint
CREATE INDEX `editor_media_assets_clip_idx` ON `editor_media_assets` (`clip_id`);--> statement-breakpoint
ALTER TABLE `clip_ranges` ADD `transition_easing` text DEFAULT 'ease-in-out' NOT NULL;