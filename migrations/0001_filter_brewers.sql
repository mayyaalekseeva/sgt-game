-- Filter recipes per brewer: recipes and reports get a brewer, and roast becomes optional (espresso still
-- sets it; filter will take its roast from the coffee lot). SQLite cannot drop NOT NULL in place, so both
-- tables are rebuilt. Written by hand from drizzle-kit's output, because D1 keeps foreign keys on:
--  1. copy the child rows aside and empty the child tables, so dropping a parent breaks no reference
--     (and ON DELETE CASCADE on working_recipes has nothing to delete)
--  2. rebuild recipes and reports, add grind and steps to recipe_versions
--  3. put the child rows back; brewer starts NULL everywhere
CREATE TABLE `__saved_working_recipes` AS SELECT * FROM `working_recipes`;--> statement-breakpoint
CREATE TABLE `__saved_reports` AS SELECT * FROM `reports`;--> statement-breakpoint
CREATE TABLE `__saved_recipe_versions` AS SELECT * FROM `recipe_versions`;--> statement-breakpoint
DELETE FROM `working_recipes`;--> statement-breakpoint
DELETE FROM `reports`;--> statement-breakpoint
DELETE FROM `recipe_versions`;--> statement-breakpoint
CREATE TABLE `__new_recipes` (
	`slug` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`roast` text,
	`brewer` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_recipes`("slug", "method", "roast", "brewer", "status", "created_at", "updated_at") SELECT "slug", "method", "roast", NULL, "status", "created_at", "updated_at" FROM `recipes`;--> statement-breakpoint
DROP TABLE `recipes`;--> statement-breakpoint
ALTER TABLE `__new_recipes` RENAME TO `recipes`;--> statement-breakpoint
CREATE TABLE `__new_reports` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`ts` integer NOT NULL,
	`method` text NOT NULL,
	`roast` text,
	`brewer` text,
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
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `__new_reports` RENAME TO `reports`;--> statement-breakpoint
CREATE INDEX `reports_user_ts_idx` ON `reports` (`user_id`,`ts`);--> statement-breakpoint
ALTER TABLE `recipe_versions` ADD `grind` text;--> statement-breakpoint
ALTER TABLE `recipe_versions` ADD `steps` text;--> statement-breakpoint
INSERT INTO `recipe_versions`("id", "recipe_slug", "version", "dose", "yield_g", "time_min", "time_max", "temp_min", "temp_max", "published_at", "created_at") SELECT "id", "recipe_slug", "version", "dose", "yield_g", "time_min", "time_max", "temp_min", "temp_max", "published_at", "created_at" FROM `__saved_recipe_versions`;--> statement-breakpoint
INSERT INTO `reports`("user_id", "id", "ts", "method", "roast", "brewer", "dose", "yield_g", "time", "taste", "diag", "recipe_version_id", "imported_at", "created_at") SELECT "user_id", "id", "ts", "method", "roast", NULL, "dose", "yield_g", "time", "taste", "diag", "recipe_version_id", "imported_at", "created_at" FROM `__saved_reports`;--> statement-breakpoint
INSERT INTO `working_recipes`("user_id", "recipe_slug", "report_id", "updated_at") SELECT "user_id", "recipe_slug", "report_id", "updated_at" FROM `__saved_working_recipes`;--> statement-breakpoint
DROP TABLE `__saved_working_recipes`;--> statement-breakpoint
DROP TABLE `__saved_reports`;--> statement-breakpoint
DROP TABLE `__saved_recipe_versions`;
