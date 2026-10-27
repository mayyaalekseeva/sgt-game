-- Players' own coffees, and working recipes kept per recipe and coffee (lot joins the key; '' for the old ones).
-- Edited by hand from drizzle-kit's output: the old table has no lot column, so the copy writes ''. D1 keeps
-- foreign keys on, which is fine here: nothing references working_recipes, so dropping it breaks nothing.
CREATE TABLE `coffees` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`roaster` text NOT NULL,
	`origin` text NOT NULL,
	`process` text NOT NULL,
	`roast` text NOT NULL,
	`name` text,
	`archived` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `__new_working_recipes` (
	`user_id` text NOT NULL,
	`recipe_slug` text NOT NULL,
	`lot` text DEFAULT '' NOT NULL,
	`report_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `recipe_slug`, `lot`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_slug`) REFERENCES `recipes`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`report_id`) REFERENCES `reports`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_working_recipes`("user_id", "recipe_slug", "lot", "report_id", "updated_at") SELECT "user_id", "recipe_slug", '', "report_id", "updated_at" FROM `working_recipes`;--> statement-breakpoint
DROP TABLE `working_recipes`;--> statement-breakpoint
ALTER TABLE `__new_working_recipes` RENAME TO `working_recipes`;