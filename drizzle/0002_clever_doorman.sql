CREATE TABLE `blocked_ip` (
	`ipHash` text(64) PRIMARY KEY NOT NULL,
	`note` text(255),
	`createdBy` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
