CREATE TABLE `transcript_words` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`segment_index` integer NOT NULL,
	`word_index` integer NOT NULL,
	`start_seconds` real NOT NULL,
	`end_seconds` real NOT NULL,
	`text` text NOT NULL,
	`probability` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcript_words_project_segment_word_unique` ON `transcript_words` (`project_id`,`segment_index`,`word_index`);--> statement-breakpoint
CREATE INDEX `transcript_words_project_time_idx` ON `transcript_words` (`project_id`,`start_seconds`);