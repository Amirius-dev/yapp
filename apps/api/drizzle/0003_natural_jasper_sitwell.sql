ALTER TABLE `clips` ADD `render_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `render_progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `render_error` text;--> statement-breakpoint
ALTER TABLE `clips` ADD `output_file_name` text;--> statement-breakpoint
ALTER TABLE `clips` ADD `rendered_at` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `payload_json` text;