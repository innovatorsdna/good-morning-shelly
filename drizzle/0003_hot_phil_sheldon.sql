CREATE TABLE `diary_post` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authorId` text(255),
	`image` text(1024) NOT NULL,
	`caption` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `diary_post_created_idx` ON `diary_post` (`createdAt`);--> statement-breakpoint
CREATE INDEX `diary_post_author_idx` ON `diary_post` (`authorId`);