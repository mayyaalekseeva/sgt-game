CREATE TABLE `drill_passes` (
	`user_id` text NOT NULL,
	`drill_id` text NOT NULL,
	`passed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `drill_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
