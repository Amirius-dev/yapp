ALTER TABLE `clips` ADD `subtitle_x` real DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `subtitle_y` real DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `subtitle_scale` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `subtitle_align` text DEFAULT 'center' NOT NULL;