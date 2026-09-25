CREATE TABLE `clip_ranges` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`range_order` integer NOT NULL,
	`start_seconds` real NOT NULL,
	`end_seconds` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clip_ranges_clip_order_unique` ON `clip_ranges` (`clip_id`,`range_order`);--> statement-breakpoint
CREATE INDEX `clip_ranges_clip_id_idx` ON `clip_ranges` (`clip_id`);
--> statement-breakpoint
INSERT INTO `clip_ranges`
  (`id`, `clip_id`, `range_order`, `start_seconds`, `end_seconds`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-a' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  `id`, 0, `start_seconds`, `end_seconds`, `created_at`, `updated_at`
FROM `clips`
WHERE NOT EXISTS (
  SELECT 1 FROM `clip_ranges` WHERE `clip_ranges`.`clip_id` = `clips`.`id`
);
