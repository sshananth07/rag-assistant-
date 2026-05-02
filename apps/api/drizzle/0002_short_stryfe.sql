CREATE TABLE `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`chunks` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_state` (
	`session_id` text PRIMARY KEY NOT NULL,
	`selected_paper_ids` text DEFAULT '[]' NOT NULL,
	`socratic_mode` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL
);
