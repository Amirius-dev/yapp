ALTER TABLE `clips` ADD `crop_mode` text DEFAULT 'fill' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `crop_x` real DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `crop_y` real DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `zoom` real DEFAULT 1 NOT NULL;