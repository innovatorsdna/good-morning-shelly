CREATE TABLE `comment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`postId` integer NOT NULL,
	`parentId` integer,
	`userId` text(255),
	`guestName` text(80),
	`guestEmail` text(255),
	`body` text NOT NULL,
	`status` text(16) DEFAULT 'pending' NOT NULL,
	`spamReason` text(255),
	`ipHash` text(64),
	`userAgent` text(512),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comment_post_status_idx` ON `comment` (`postId`,`status`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parentId`);--> statement-breakpoint
CREATE INDEX `comment_user_idx` ON `comment` (`userId`);--> statement-breakpoint
CREATE INDEX `comment_created_idx` ON `comment` (`createdAt`);