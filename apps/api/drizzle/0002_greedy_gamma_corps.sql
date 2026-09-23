CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`start_seconds` real NOT NULL,
	`end_seconds` real NOT NULL,
	`hook_score` integer NOT NULL,
	`reason` text NOT NULL,
	`opening_caption` text NOT NULL,
	`segment_ids_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clips_project_id_idx` ON `clips` (`project_id`);