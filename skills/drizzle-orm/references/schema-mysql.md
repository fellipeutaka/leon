# Drizzle ORM — MySQL Schema Reference

All imports from `drizzle-orm/mysql-core` unless noted.

## Table of Contents

- [Column Types](#column-types)
- [Column Modifiers](#column-modifiers)
- [Indexes & Constraints](#indexes--constraints)
- [Views](#views)
- [Generated Columns](#generated-columns)

## Column Types

### Integer Types

```ts
import { int, tinyint, smallint, mediumint, bigint, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  int: int(),
  intUnsigned: int({ unsigned: true }),
  tinyint: tinyint(),
  tinyintUnsigned: tinyint({ unsigned: true }),
  smallint: smallint(),
  smallintUnsigned: smallint({ unsigned: true }),
  mediumint: mediumint(),
  mediumintUnsigned: mediumint({ unsigned: true }),
  bigint: bigint({ mode: "number" }),
  bigintUnsigned: bigint({ mode: "number", unsigned: true }),
});
```

`bigint` mode: `"number"` | `"bigint"`. Use `"number"` unless values exceed `2^53-1`.

### Serial

```ts
import { serial, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  id: serial(),
});
```

Equivalent to `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`.

### Float / Double / Real / Decimal

```ts
import { float, double, real, decimal, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  float: float(),
  double: double(),
  real: real(),
  decimal: decimal({ precision: 10, scale: 2 }),
  decimalAsNumber: decimal({ precision: 10, scale: 2, mode: "number" }),
});
```

`decimal` mode: `"string"` (default) | `"number"`.

### String Types

```ts
import { char, varchar, text, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  char: char({ length: 10 }),
  varchar: varchar({ length: 255 }),
  varcharEnum: varchar({ length: 6, enum: ["value1", "value2"] }),
  text: text(),
  textEnum: text({ enum: ["value1", "value2"] }),
});
```

`varchar` requires `length`. The `enum` option adds TypeScript type inference only, no runtime validation.

### Binary Types

```ts
import { binary, varbinary, blob, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  binary: binary({ length: 16 }),
  varbinary: varbinary({ length: 255 }),
  blob: blob(),
});
```

Additional blob types: `tinyblob`, `mediumblob`, `longblob` — same usage pattern.

### Boolean

```ts
import { boolean, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  isActive: boolean(),
});
```

Maps to `TINYINT(1)`.

### Date & Time

```ts
import { date, datetime, time, year, timestamp, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  date: date(),
  dateAsDate: date({ mode: "date" }),
  datetime: datetime({ fsp: 3 }),
  datetimeAsDate: datetime({ mode: "date", fsp: 3 }),
  time: time({ fsp: 3 }),
  year: year(),
  timestamp: timestamp({ mode: "date", fsp: 3 }),
  timestampDefault: timestamp().defaultNow(),
  timestampOnUpdate: timestamp().defaultNow().onUpdateNow(),
});
```

`mode`: `"string"` (default) | `"date"`. `fsp`: fractional seconds precision (0-6).

### JSON

```ts
import { json, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  json: json(),
  typedJson: json().$type<{ name: string; age: number }>(),
});
```

Use `.$type<T>()` to type the JSON column.

### Enum

```ts
import { mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable("table", {
  role: mysqlEnum(["admin", "user", "guest"]),
});
```

Creates a native MySQL `ENUM` type.

## Column Modifiers

```ts
import { int, varchar, text, mysqlTable } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const table = mysqlTable("table", {
  // NOT NULL
  name: varchar({ length: 255 }).notNull(),

  // DEFAULT (static value)
  age: int().default(0),

  // DEFAULT (SQL expression)
  createdAt: timestamp().default(sql`(now())`),

  // $defaultFn — runtime default, called on INSERT when no value given
  id: varchar({ length: 128 }).$defaultFn(() => createId()),

  // $onUpdate — runtime value on UPDATE
  updatedAt: text().$onUpdate(() => new Date().toISOString()),

  // PRIMARY KEY
  pk: int().primaryKey(),

  // AUTO_INCREMENT
  serial: int().autoincrement(),

  // UNIQUE
  email: varchar({ length: 255 }).unique(),
  namedUnique: varchar({ length: 255 }).unique("custom_unique_name"),

  // INLINE REFERENCES (foreign key)
  userId: int().references(() => users.id),
  userIdCascade: int().references(() => users.id, { onDelete: "cascade" }),

  // $type — override TypeScript type
  jsonField: text().$type<{ foo: string }>(),
});
```

## Indexes & Constraints

### Indexes

```ts
import { int, text, index, uniqueIndex, mysqlTable } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: int().primaryKey().autoincrement(),
  name: text(),
  email: text(),
}, (table) => [
  index("name_idx").on(table.name),
  uniqueIndex("email_idx").on(table.email),
]);
```

### Composite Index

```ts
import { int, varchar, index, mysqlTable } from "drizzle-orm/mysql-core";

export const table = mysqlTable("table", {
  a: int(),
  b: varchar({ length: 255 }),
}, (table) => [
  index("ab_idx").on(table.a, table.b),
]);
```

### Composite Primary Key

```ts
import { int, primaryKey, mysqlTable } from "drizzle-orm/mysql-core";

export const booksToAuthors = mysqlTable("books_to_authors", {
  authorId: int("author_id"),
  bookId: int("book_id"),
}, (table) => [
  primaryKey({ columns: [table.bookId, table.authorId] }),
  // with custom name:
  primaryKey({ name: "custom_pk", columns: [table.bookId, table.authorId] }),
]);
```

### Composite Unique

```ts
import { int, varchar, unique, mysqlTable } from "drizzle-orm/mysql-core";

export const table = mysqlTable("composite_example", {
  id: int(),
  name: varchar({ length: 256 }),
}, (t) => [
  unique().on(t.id, t.name),
  unique("custom_name").on(t.id, t.name),
]);
```

### Foreign Keys

```ts
import { int, text, foreignKey, primaryKey, mysqlTable } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  firstName: text("first_name"),
  lastName: text("last_name"),
}, (table) => [
  primaryKey({ columns: [table.firstName, table.lastName] }),
]);

export const profile = mysqlTable("profile", {
  id: int().autoincrement().primaryKey(),
  userFirstName: text("user_first_name"),
  userLastName: text("user_last_name"),
}, (table) => [
  foreignKey({
    columns: [table.userFirstName, table.userLastName],
    foreignColumns: [user.firstName, user.lastName],
    name: "custom_fk",
  })
    .onDelete("cascade")
    .onUpdate("no action"),
]);
```

`onDelete`/`onUpdate` actions: `"cascade"` | `"restrict"` | `"no action"` | `"set null"` | `"set default"`.

## Views

```ts
import { int, text, mysqlView, mysqlTable } from "drizzle-orm/mysql-core";
import { eq } from "drizzle-orm";

export const user = mysqlTable("user", {
  id: int().primaryKey().autoincrement(),
  name: text(),
  role: text(),
});

// Infer columns from query
export const adminView = mysqlView("admin_view").as((qb) =>
  qb.select().from(user).where(eq(user.role, "admin"))
);

// Explicit shape
export const customView = mysqlView("custom_view", {
  id: int(),
  name: text(),
}).as(sql`SELECT id, name FROM user WHERE role = 'admin'`);
```

## Generated Columns

Use `generatedAlwaysAs()` with `mode: "virtual"` or `mode: "stored"`.

```ts
import { int, text, mysqlTable } from "drizzle-orm/mysql-core";
import { SQL, sql } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int().primaryKey().autoincrement(),
  name: text(),
  // STORED — computed on write, persisted to disk
  storedGen: text("stored_gen").generatedAlwaysAs(
    (): SQL => sql`concat(${users.name}, ' ', 'hello')`,
    { mode: "stored" },
  ),
  // VIRTUAL — computed on read, not persisted
  virtualGen: text("virtual_gen").generatedAlwaysAs(
    (): SQL => sql`concat(${users.name}, ' ', 'hello')`,
    { mode: "virtual" },
  ),
});
```

Virtual columns cannot be inserted or updated. Stored columns are persisted and can be indexed.
