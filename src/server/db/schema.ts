import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  primaryKey,
  sqliteTable,
} from "drizzle-orm/sqlite-core";

// Better Auth core tables
export const user = sqliteTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  email: d.text({ length: 255 }).notNull().unique(),
  emailVerified: d.integer({ mode: "boolean" }).default(false),
  image: d.text({ length: 255 }),
  // "user" | "admin"
  role: d.text({ length: 32 }).notNull().default("user"),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
}));

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  posts: many(post),
}));

export const account = sqliteTable(
  "account",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    accountId: d.text({ length: 255 }).notNull(),
    providerId: d.text({ length: 255 }).notNull(),
    accessToken: d.text(),
    refreshToken: d.text(),
    accessTokenExpiresAt: d.integer({ mode: "timestamp" }),
    refreshTokenExpiresAt: d.integer({ mode: "timestamp" }),
    scope: d.text({ length: 255 }),
    idToken: d.text(),
    password: d.text(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const session = sqliteTable(
  "session",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    token: d.text({ length: 255 }).notNull().unique(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    ipAddress: d.text({ length: 255 }),
    userAgent: d.text({ length: 255 }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const verification = sqliteTable(
  "verification",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: d.text({ length: 255 }).notNull(),
    value: d.text({ length: 255 }).notNull(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Content tables
//
// `post` covers both blog posts and standalone pages, distinguished by `type`.
// `source` is "mdx" for posts imported from the original WordPress export
// (rendered as raw MDX, treated as read-only archive) or "tiptap" for posts
// authored in the new admin editor (markdown produced by tiptap-markdown).
export const post = sqliteTable(
  "post",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    slug: d.text({ length: 255 }).notNull().unique(),
    type: d.text({ length: 16 }).notNull().default("post"),
    source: d.text({ length: 16 }).notNull().default("tiptap"),
    title: d.text({ length: 512 }).notNull(),
    body: d.text().notNull().default(""),
    excerpt: d.text(),
    cover: d.text({ length: 1024 }),
    status: d.text({ length: 16 }).notNull().default("draft"),
    sticky: d.integer({ mode: "boolean" }).notNull().default(false),
    wpId: d.text({ length: 64 }),
    authorId: d
      .text({ length: 255 })
      .references(() => user.id, { onDelete: "set null" }),
    publishedAt: d.integer({ mode: "timestamp" }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    index("post_status_idx").on(t.status),
    index("post_type_idx").on(t.type),
    index("post_published_at_idx").on(t.publishedAt),
    index("post_author_id_idx").on(t.authorId),
  ],
);

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
  categories: many(postCategory),
  oldSlugs: many(postOldSlug),
}));

export const category = sqliteTable("category", (d) => ({
  slug: d.text({ length: 255 }).notNull().primaryKey(),
  name: d.text({ length: 255 }).notNull(),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  posts: many(postCategory),
}));

export const postCategory = sqliteTable(
  "post_category",
  (d) => ({
    postId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    categorySlug: d
      .text({ length: 255 })
      .notNull()
      .references(() => category.slug, { onDelete: "cascade" }),
  }),
  (t) => [
    primaryKey({ columns: [t.postId, t.categorySlug] }),
    index("post_category_category_idx").on(t.categorySlug),
  ],
);

export const postCategoryRelations = relations(postCategory, ({ one }) => ({
  post: one(post, { fields: [postCategory.postId], references: [post.id] }),
  category: one(category, {
    fields: [postCategory.categorySlug],
    references: [category.slug],
  }),
}));

export const postOldSlug = sqliteTable(
  "post_old_slug",
  (d) => ({
    slug: d.text({ length: 255 }).notNull().primaryKey(),
    postId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
  }),
  (t) => [index("post_old_slug_post_id_idx").on(t.postId)],
);

export const postOldSlugRelations = relations(postOldSlug, ({ one }) => ({
  post: one(post, { fields: [postOldSlug.postId], references: [post.id] }),
}));

// Reader comments on posts. A comment is authored either by a signed-in user
// (`userId` set) or anonymously (`guestName`/`guestEmail` set). `status` drives
// moderation: comments that clear the spam pipeline are "approved" and shown
// publicly; flagged ones are held as "spam" (or "pending") for admin review.
export const comment = sqliteTable(
  "comment",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    postId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    // Self-reference for threaded replies. Needs an explicit return type so
    // TypeScript can resolve the circular reference.
    parentId: d
      .integer({ mode: "number" })
      .references((): AnySQLiteColumn => comment.id, { onDelete: "cascade" }),
    // Set when the author is signed in; null for anonymous comments.
    userId: d
      .text({ length: 255 })
      .references(() => user.id, { onDelete: "set null" }),
    // Set when the author is anonymous; null for signed-in comments.
    guestName: d.text({ length: 80 }),
    guestEmail: d.text({ length: 255 }),
    body: d.text().notNull(),
    // "approved" | "pending" | "spam"
    status: d.text({ length: 16 }).notNull().default("pending"),
    // Audit trail for why a comment was held, if it was.
    spamReason: d.text({ length: 255 }),
    // SHA-256 of the submitter IP (never store raw IPs) for rate limiting.
    ipHash: d.text({ length: 64 }),
    userAgent: d.text({ length: 512 }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("comment_post_status_idx").on(t.postId, t.status),
    index("comment_parent_idx").on(t.parentId),
    index("comment_user_idx").on(t.userId),
    index("comment_created_idx").on(t.createdAt),
  ],
);

export const commentRelations = relations(comment, ({ one, many }) => ({
  post: one(post, { fields: [comment.postId], references: [post.id] }),
  user: one(user, { fields: [comment.userId], references: [user.id] }),
  parent: one(comment, {
    fields: [comment.parentId],
    references: [comment.id],
    relationName: "comment_replies",
  }),
  replies: many(comment, { relationName: "comment_replies" }),
}));
