CREATE TABLE `account` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`accountId` text(255) NOT NULL,
	`providerId` text(255) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text(255),
	`idToken` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `category` (
	`slug` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(255) NOT NULL,
	`type` text(16) DEFAULT 'post' NOT NULL,
	`source` text(16) DEFAULT 'tiptap' NOT NULL,
	`title` text(512) NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`excerpt` text,
	`cover` text(1024),
	`status` text(16) DEFAULT 'draft' NOT NULL,
	`sticky` integer DEFAULT false NOT NULL,
	`wpId` text(64),
	`authorId` text(255),
	`publishedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_status_idx` ON `post` (`status`);--> statement-breakpoint
CREATE INDEX `post_type_idx` ON `post` (`type`);--> statement-breakpoint
CREATE INDEX `post_published_at_idx` ON `post` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `post_author_id_idx` ON `post` (`authorId`);--> statement-breakpoint
CREATE TABLE `post_category` (
	`postId` integer NOT NULL,
	`categorySlug` text(255) NOT NULL,
	PRIMARY KEY(`postId`, `categorySlug`),
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categorySlug`) REFERENCES `category`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_category_category_idx` ON `post_category` (`categorySlug`);--> statement-breakpoint
CREATE TABLE `post_old_slug` (
	`slug` text(255) PRIMARY KEY NOT NULL,
	`postId` integer NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_old_slug_post_id_idx` ON `post_old_slug` (`postId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text(255),
	`userAgent` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`emailVerified` integer DEFAULT false,
	`image` text(255),
	`role` text(32) DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`identifier` text(255) NOT NULL,
	`value` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);