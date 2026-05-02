CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`title` text,
	`chunk_count` integer NOT NULL,
	`created_at` integer NOT NULL
);
