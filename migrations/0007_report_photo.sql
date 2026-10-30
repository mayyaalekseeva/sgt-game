ALTER TABLE `reports` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `visibility` text DEFAULT 'private' NOT NULL;