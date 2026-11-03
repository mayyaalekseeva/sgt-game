CREATE TABLE `cupping_samples` (
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`lot` text,
	`code` text,
	`form_id` text NOT NULL,
	`cup_count` integer NOT NULL,
	`scores` text NOT NULL,
	`cups` text NOT NULL,
	`defects` text NOT NULL,
	`flavors` text,
	`notes` text,
	PRIMARY KEY(`user_id`, `session_id`, `id`),
	FOREIGN KEY (`user_id`,`session_id`) REFERENCES `cupping_sessions`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cupping_sessions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`day` text NOT NULL,
	`place` text,
	`protocol` text,
	`blind` integer DEFAULT false NOT NULL,
	`revealed` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
