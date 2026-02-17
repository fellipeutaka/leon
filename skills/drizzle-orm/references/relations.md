# Drizzle ORM Relations

## Table of Contents

- [V1 Relations (Stable)](#v1-relations-stable)
  - [Defining Relations](#defining-relations)
  - [One-to-One](#one-to-one)
  - [One-to-Many](#one-to-many)
  - [Many-to-Many (Junction Table)](#many-to-many-junction-table)
  - [Self-Relations](#self-relations)
  - [Disambiguating with relationName](#disambiguating-with-relationname)
  - [Relational Queries (db.query API)](#relational-queries-dbquery-api)
- [V2 Relations (Beta)](#v2-relations-beta)
  - [defineRelations API](#definerelations-api)
  - [One-to-Many (V2)](#one-to-many-v2)
  - [Many-to-Many with .through()](#many-to-many-with-through)
  - [Key Differences from V1](#key-differences-from-v1)
  - [Migration from V1 to V2](#migration-from-v1-to-v2)

---

## V1 Relations (Stable)

### Defining Relations

```ts
import { relations } from "drizzle-orm";
```

Relations are declarative and do NOT affect the database schema or migrations. They exist only for the relational query builder (`db.query`).

Define relations per-table using `relations()`. Use `one()` for one-to-one / many-to-one. Use `many()` for one-to-many. Specify `fields` (local columns) and `references` (target columns) on the `one()` side.

### One-to-One

```ts
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  bio: text("bio"),
  userId: integer("user_id"),
});

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));
```

### One-to-Many

```ts
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content"),
  authorId: integer("author_id"),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

`many()` does not take `fields`/`references` -- the FK mapping is on the `one()` side.

### Many-to-Many (Junction Table)

Drizzle V1 has no built-in many-to-many. Use a junction table with relations on all three tables.

```ts
import { pgTable, integer, primaryKey, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  name: text("name"),
});

export const groups = pgTable("groups", {
  id: integer("id").primaryKey(),
  name: text("name"),
});

export const usersToGroups = pgTable(
  "users_to_groups",
  {
    userId: integer("user_id").notNull().references(() => users.id),
    groupId: integer("group_id").notNull().references(() => groups.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  user: one(users, {
    fields: [usersToGroups.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [usersToGroups.groupId],
    references: [groups.id],
  }),
}));
```

Querying many-to-many in V1 requires traversing the junction:

```ts
const result = await db.query.users.findMany({
  with: {
    usersToGroups: {
      columns: {},
      with: {
        group: true,
      },
    },
  },
});
```

### Self-Relations

```ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  invitedById: integer("invited_by_id"),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  invitedBy: one(users, {
    fields: [users.invitedById],
    references: [users.id],
    relationName: "invitedUsers",
  }),
  invitedUsers: many(users, { relationName: "invitedUsers" }),
}));
```

### Disambiguating with relationName

When a table has multiple relations to the same target table, use `relationName` to disambiguate.

```ts
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id"),
  reviewerId: integer("reviewer_id"),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
    relationName: "author",
  }),
  reviewer: one(users, {
    fields: [posts.reviewerId],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  authoredPosts: many(posts, { relationName: "author" }),
  reviewedPosts: many(posts, { relationName: "reviewer" }),
}));
```

### Relational Queries (db.query API)

Initialize drizzle with schema to enable `db.query`:

```ts
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle({ schema });
```

#### findMany

```ts
const users = await db.query.users.findMany({
  columns: { id: true, name: true },
  with: {
    posts: true,
  },
  where: (users, { eq }) => eq(users.id, 1),
  orderBy: (users, { asc }) => asc(users.name),
  limit: 10,
  offset: 0,
});
```

#### findFirst

```ts
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, 1),
  with: { posts: true },
});
```

#### Nested with

```ts
const posts = await db.query.posts.findMany({
  with: {
    comments: {
      with: {
        user: true,
      },
    },
    author: {
      columns: { name: true },
    },
  },
});
```

#### Column selection and exclusion

```ts
// Include specific columns
await db.query.posts.findMany({
  columns: { id: true, title: true },
});

// Exclude specific columns
await db.query.posts.findMany({
  columns: { content: false },
});

// Columns in nested relations
await db.query.posts.findMany({
  columns: { id: true },
  with: {
    comments: {
      columns: { userId: false, postId: false },
    },
    user: true,
  },
});
```

#### extras (computed/virtual fields)

```ts
import { sql } from "drizzle-orm";

const users = await db.query.users.findMany({
  extras: {
    fullName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`.as("full_name"),
  },
});
```

Using `db.$count` in extras:

```ts
const users = await db.query.users.findMany({
  extras: {
    postsCount: db.$count(posts, eq(posts.authorId, users.id)),
  },
});
```

#### where and orderBy callbacks

```ts
await db.query.users.findMany({
  where: (table, { eq, and, gt }) => and(eq(table.role, "admin"), gt(table.age, 18)),
  orderBy: (table, { desc }) => desc(table.createdAt),
});
```

`orderBy` also accepts an array for multiple sort fields:

```ts
orderBy: (table, { asc, desc }) => [asc(table.name), desc(table.createdAt)],
```

---

## V2 Relations (Beta)

> V2 relations API requires `drizzle-orm@latest` beta. The API may change.

### defineRelations API

Single `defineRelations` call replaces all per-table `relations()` calls.

```ts
import * as schema from "./schema";
import { defineRelations } from "drizzle-orm";

export const relations = defineRelations(schema, (r) => ({
  // keyed by table name
  users: {
    posts: r.many.posts(),
  },
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  },
}));
```

### One-to-Many (V2)

```ts
export const relations = defineRelations({ users, posts, comments }, (r) => ({
  users: {
    posts: r.many.posts(),
  },
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    comments: r.many.comments(),
  },
  comments: {
    post: r.one.posts({
      from: r.comments.postId,
      to: r.posts.id,
    }),
  },
}));
```

### Many-to-Many with .through()

V2 supports `.through()` natively -- no junction table boilerplate in queries.

```ts
export const relations = defineRelations({ users, groups, usersToGroups }, (r) => ({
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
  groups: {
    participants: r.many.users(),
  },
}));
```

Query becomes flat (no junction traversal):

```ts
const result = await db.query.users.findMany({
  with: {
    groups: true,
  },
});
```

### Key Differences from V1

| Aspect | V1 | V2 |
|---|---|---|
| Import | `relations` from `drizzle-orm` | `defineRelations` from `drizzle-orm` |
| Definition | Per-table `relations(table, cb)` calls | Single `defineRelations(schema, cb)` call |
| FK mapping | `fields` / `references` | `from` / `to` |
| Many-to-many | Manual junction table relations + nested `with` | `.through()` with flat queries |
| Schema input | Individual table reference | Pass entire schema object |

### Migration from V1 to V2

1. Replace all `relations()` imports with `defineRelations`
2. Merge all per-table relation definitions into one `defineRelations` call
3. Replace `fields: [table.col]` / `references: [target.col]` with `from: r.table.col` / `to: r.target.col`
4. For many-to-many, replace junction table relations with `.through()` syntax
5. Update queries: remove junction table traversal from `with` clauses
6. `orderBy` in V2 can use object syntax: `{ id: "asc" }` instead of callback
