# SQLite Schema Reference

## Table of Contents
- [Column Types](#column-types)
- [Column Modifiers](#column-modifiers)
- [Enums (Workaround)](#enums-workaround)
- [Indexes & Constraints](#indexes--constraints)
- [Views](#views)
- [Generated Columns](#generated-columns)
- [Differences from PG/MySQL](#differences-from-pgmysql)

## Column Types

### Integer

```ts
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  // standard integer
  id: integer().primaryKey({ autoIncrement: true }),
  count: integer(),

  // mode: 'boolean' — stores 0/1, maps to boolean
  isActive: integer({ mode: "boolean" }),

  // mode: 'timestamp' — stores unix epoch seconds, maps to Date
  createdAt: integer({ mode: "timestamp" }),

  // mode: 'timestamp_ms' — stores unix epoch milliseconds, maps to Date
  updatedAt: integer({ mode: "timestamp_ms" }),

  // mode: 'number' (default) — standard number
  age: integer({ mode: "number" }),
});
```

### Real

```ts
import { real, sqliteTable } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  score: real(),
});
```

### Text

```ts
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  name: text(),

  // with enum for type inference (no runtime check)
  role: text({ enum: ["admin", "user", "guest"] }),

  // mode: 'json' — stores JSON string, maps to object
  metadata: text({ mode: "json" }).$type<{ key: string }>(),
});
```

### Blob

```ts
import { blob, sqliteTable } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  // default — Uint8Array
  data: blob(),

  // mode: 'buffer' — Buffer
  file: blob({ mode: "buffer" }),

  // mode: 'json' — stored as text, parsed as JSON
  config: blob({ mode: "json" }).$type<{ setting: boolean }>(),

  // mode: 'bigint' — stored as blob, maps to bigint
  bigVal: blob({ mode: "bigint" }),
});
```

### Numeric

```ts
import { numeric, sqliteTable } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  amount: numeric(),
});
```

## Column Modifiers

```ts
import { integer, text, sqliteTable, sql } from "drizzle-orm/sqlite-core";

const table = sqliteTable("table", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  role: text().default("user"),
  slug: text().unique(),
  createdAt: integer({ mode: "timestamp" }).default(sql`(unixepoch())`),

  // runtime default
  cuid: text().$defaultFn(() => createId()),

  // update callback
  updatedAt: integer({ mode: "timestamp" }).$onUpdate(() => new Date()),

  // custom type branding
  userId: integer().$type<UserId>(),

  // foreign key inline
  postId: integer().references(() => posts.id, { onDelete: "cascade" }),
});
```

## Enums (Workaround)

SQLite has no native enum type. Use `text` with `enum` option for type inference:

```ts
const users = sqliteTable("users", {
  role: text({ enum: ["admin", "user", "guest"] }).notNull(),
});
// typeof users.role.$inferSelect -> "admin" | "user" | "guest"
```

For runtime validation, combine with Zod/Valibot via drizzle-zod/drizzle-valibot.

## Indexes & Constraints

```ts
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, foreignKey } from "drizzle-orm/sqlite-core";

const posts = sqliteTable("posts", {
  id: integer().primaryKey({ autoIncrement: true }),
  slug: text().notNull(),
  authorId: integer().notNull(),
  categoryId: integer().notNull(),
}, (table) => [
  index("slug_idx").on(table.slug),
  uniqueIndex("unique_slug").on(table.slug),
  // composite index
  index("author_category_idx").on(table.authorId, table.categoryId),
]);

// composite primary key
const usersToGroups = sqliteTable("users_to_groups", {
  userId: integer().notNull().references(() => users.id),
  groupId: integer().notNull().references(() => groups.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);

// standalone foreign key (for composite FKs)
const table = sqliteTable("table", {
  a: integer(),
  b: integer(),
}, (table) => [
  foreignKey({
    columns: [table.a, table.b],
    foreignColumns: [otherTable.x, otherTable.y],
  }).onDelete("cascade"),
]);
```

## Views

```ts
import { sqliteView, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";

// inferred from query
const activeUsers = sqliteView("active_users").as((qb) =>
  qb.select().from(users).where(eq(users.isActive, true))
);

// explicit schema (standalone)
const view = sqliteView("view", {
  id: integer(),
  name: text(),
}).as(sql`SELECT id, name FROM users WHERE active = 1`);

// use in queries
await db.select().from(activeUsers);
```

## Generated Columns

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const products = sqliteTable("products", {
  price: integer().notNull(),
  quantity: integer().notNull(),
  total: integer().generatedAlwaysAs(sql`price * quantity`, { mode: "stored" }),
  // SQLite supports only STORED generated columns (not VIRTUAL in all cases)
});
```

## Differences from PG/MySQL

| Feature | SQLite | PG/MySQL |
|---------|--------|----------|
| Enums | text with `enum` option (type-only) | pgEnum / mysqlEnum |
| Auto increment | `integer().primaryKey({ autoIncrement: true })` | serial / .autoincrement() |
| Boolean | `integer({ mode: "boolean" })` (0/1) | Native boolean |
| Timestamp | `integer({ mode: "timestamp" })` (unix epoch) | Native timestamp type |
| JSON | `text({ mode: "json" })` | Native json/jsonb |
| ALTER TABLE | Very limited (no DROP COLUMN before 3.35.0) | Full support |
| Schemas | Not supported | pgSchema / mysqlSchema |
| `.returning()` | Supported | PG: yes, MySQL: no |
| Array types | Not supported | PG: `.array()` |
