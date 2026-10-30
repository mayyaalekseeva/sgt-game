CREATE TABLE `deleted_reports` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`deleted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `reports` ADD `edited_at` integer;