ALTER TABLE `post` ADD `isPrivate` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `post_visibility_idx` ON `post` (`status`,`isPrivate`);--> statement-breakpoint
-- Data backfill (added by hand; not produced by drizzle-kit):
-- New isPrivate column defaults to true, so every existing row is now
-- members-only. That is the intended launch state for posts. Override the
-- cases that should stay public or that used the retired `status = 'private'`.
--> statement-breakpoint
-- Standalone pages (About, etc.) are always public.
UPDATE `post` SET `isPrivate` = false WHERE `type` = 'page';--> statement-breakpoint
-- Retire the old `status = 'private'` value: it now lives as a published,
-- members-only post so it renders for signed-in members.
UPDATE `post` SET `status` = 'publish', `isPrivate` = true WHERE `status` = 'private';--> statement-breakpoint
-- Everyone who can sign in is a "member"; only admins keep their role.
UPDATE `user` SET `role` = 'member' WHERE `role` = 'user';