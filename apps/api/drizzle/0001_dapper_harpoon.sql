CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`answer` text NOT NULL,
	`chunks` text NOT NULL,
	`paper_ids` text NOT NULL,
	`question` text NOT NULL,
	`created_at` integer NOT NULL
);
