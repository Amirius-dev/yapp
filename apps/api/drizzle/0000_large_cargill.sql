CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text DEFAULT 'long_video_to_shorts' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`source_file_path` text,
	`source_file_name` text,
	`source_mime_type` text,
	`duration_seconds` real,
	`width` integer,
	`height` integer,
	`fps` real,
	`file_size_bytes` integer,
	`has_audio` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`error_message` text
);
