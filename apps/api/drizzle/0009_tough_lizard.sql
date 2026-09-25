CREATE TABLE `editor_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clip_ranges` ADD `transition_type` text DEFAULT 'hard-cut' NOT NULL;--> statement-breakpoint
ALTER TABLE `clip_ranges` ADD `transition_duration_seconds` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `image_settings_json` text DEFAULT '{"brightness":100,"exposure":0,"contrast":100,"saturation":100,"temperature":0,"tint":0,"sharpness":0,"blur":0,"vignette":0,"opacity":100,"rotation":0,"flipHorizontal":false,"zoom":1,"positionX":50,"positionY":50,"backgroundBlur":42,"backgroundDim":0.28,"backgroundSaturation":0.78}' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `audio_settings_json` text DEFAULT '{"volume":1,"muted":false,"fadeInSeconds":0,"fadeOutSeconds":0,"normalize":false,"noiseReduction":false,"music":null}' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `subtitle_style_json` text DEFAULT '{"fontFamily":"Arial","fontWeight":900,"textColor":"#ffffff","activeWordColor":"#ff6b00","backgroundColor":"#000000","backgroundOpacity":0,"outlineColor":"#000000","outlineWidth":4,"shadow":true,"borderRadius":10,"paddingHorizontal":20,"paddingVertical":10,"maxWords":6,"maxLines":2,"animation":"minimal","uppercase":false}' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `opening_caption_settings_json` text DEFAULT '{"enabled":false,"text":"","x":50,"y":22,"scale":1,"color":"#ffffff","backgroundColor":"#000000","backgroundOpacity":0.55,"durationSeconds":3,"animation":"fade"}' NOT NULL;