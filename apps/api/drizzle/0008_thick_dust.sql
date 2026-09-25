CREATE TABLE `crop_keyframes` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`range_id` text NOT NULL,
	`source_time_seconds` real NOT NULL,
	`crop_x` real NOT NULL,
	`crop_y` real NOT NULL,
	`zoom` real NOT NULL,
	`easing` text DEFAULT 'linear' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`range_id`) REFERENCES `clip_ranges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `crop_keyframes_clip_range_idx` ON `crop_keyframes` (`clip_id`,`range_id`);--> statement-breakpoint
CREATE TABLE `subtitle_keyframes` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`range_id` text NOT NULL,
	`source_time_seconds` real NOT NULL,
	`subtitle_x` real NOT NULL,
	`subtitle_y` real NOT NULL,
	`subtitle_scale` real NOT NULL,
	`subtitle_align` text NOT NULL,
	`transition` text DEFAULT 'hold' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`range_id`) REFERENCES `clip_ranges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subtitle_keyframes_clip_range_idx` ON `subtitle_keyframes` (`clip_id`,`range_id`);--> statement-breakpoint
ALTER TABLE `clips` ADD `template_id` text DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `accent_color` text DEFAULT '#8f7cff' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `captions_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `opening_caption_enabled` integer DEFAULT true NOT NULL;
--> statement-breakpoint
INSERT INTO `crop_keyframes`
  (`id`, `clip_id`, `range_id`, `source_time_seconds`, `crop_x`, `crop_y`, `zoom`, `easing`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-a' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  `clips`.`id`, `clip_ranges`.`id`, `clip_ranges`.`start_seconds`,
  `clips`.`crop_x`, `clips`.`crop_y`, `clips`.`zoom`, 'linear',
  `clips`.`created_at`, `clips`.`updated_at`
FROM `clips`
JOIN `clip_ranges` ON `clip_ranges`.`clip_id` = `clips`.`id`
WHERE NOT EXISTS (
  SELECT 1 FROM `crop_keyframes`
  WHERE `crop_keyframes`.`range_id` = `clip_ranges`.`id`
);
