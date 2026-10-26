CREATE TABLE `recipe_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_slug` text NOT NULL,
	`version` integer NOT NULL,
	`dose` real NOT NULL,
	`yield_g` real NOT NULL,
	`time_min` integer NOT NULL,
	`time_max` integer NOT NULL,
	`temp_min` integer NOT NULL,
	`temp_max` integer NOT NULL,
	`published_at` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_slug`) REFERENCES `recipes`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_versions_slug_version` ON `recipe_versions` (`recipe_slug`,`version`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`slug` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`roast` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`ts` integer NOT NULL,
	`method` text NOT NULL,
	`roast` text NOT NULL,
	`dose` real NOT NULL,
	`yield_g` real NOT NULL,
	`time` integer NOT NULL,
	`taste` text NOT NULL,
	`diag` text NOT NULL,
	`recipe_version_id` text,
	`imported_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_version_id`) REFERENCES `recipe_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_user_ts_idx` ON `reports` (`user_id`,`ts`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);--> statement-breakpoint
CREATE TABLE `working_recipes` (
	`user_id` text NOT NULL,
	`recipe_slug` text NOT NULL,
	`report_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `recipe_slug`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_slug`) REFERENCES `recipes`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`report_id`) REFERENCES `reports`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
