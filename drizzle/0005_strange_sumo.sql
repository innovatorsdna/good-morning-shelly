DROP INDEX "account_user_id_idx";--> statement-breakpoint
DROP INDEX "comment_post_status_idx";--> statement-breakpoint
DROP INDEX "comment_parent_idx";--> statement-breakpoint
DROP INDEX "comment_user_idx";--> statement-breakpoint
DROP INDEX "comment_created_idx";--> statement-breakpoint
DROP INDEX "diary_comment_post_idx";--> statement-breakpoint
DROP INDEX "diary_post_created_idx";--> statement-breakpoint
DROP INDEX "diary_post_author_idx";--> statement-breakpoint
DROP INDEX "post_slug_unique";--> statement-breakpoint
DROP INDEX "post_status_idx";--> statement-breakpoint
DROP INDEX "post_type_idx";--> statement-breakpoint
DROP INDEX "post_published_at_idx";--> statement-breakpoint
DROP INDEX "post_author_id_idx";--> statement-breakpoint
DROP INDEX "post_category_category_idx";--> statement-breakpoint
DROP INDEX "post_old_slug_post_id_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_user_id_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `diary_post` ALTER COLUMN "image" TO "image" text(1024);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `comment_post_status_idx` ON `comment` (`postId`,`status`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parentId`);--> statement-breakpoint
CREATE INDEX `comment_user_idx` ON `comment` (`userId`);--> statement-breakpoint
CREATE INDEX `comment_created_idx` ON `comment` (`createdAt`);--> statement-breakpoint
CREATE INDEX `diary_comment_post_idx` ON `diary_comment` (`postId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `diary_post_created_idx` ON `diary_post` (`createdAt`);--> statement-breakpoint
CREATE INDEX `diary_post_author_idx` ON `diary_post` (`authorId`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_status_idx` ON `post` (`status`);--> statement-breakpoint
CREATE INDEX `post_type_idx` ON `post` (`type`);--> statement-breakpoint
CREATE INDEX `post_published_at_idx` ON `post` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `post_author_id_idx` ON `post` (`authorId`);--> statement-breakpoint
CREATE INDEX `post_category_category_idx` ON `post_category` (`categorySlug`);--> statement-breakpoint
CREATE INDEX `post_old_slug_post_id_idx` ON `post_old_slug` (`postId`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);