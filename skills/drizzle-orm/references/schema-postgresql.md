# Drizzle ORM — PostgreSQL Schema Reference

## Table of Contents

- [Column Types](#column-types)
  - [Integer Types](#integer-types)
  - [Serial Types](#serial-types)
  - [Boolean](#boolean)
  - [Text Types](#text-types)
  - [Numeric / Decimal](#numeric--decimal)
  - [Float Types](#float-types)
  - [JSON Types](#json-types)
  - [UUID](#uuid)
  - [Date / Time Types](#date--time-types)
  - [Interval](#interval)
  - [Bytea](#bytea)
  - [Bit Types](#bit-types)
  - [Array Types](#array-types)
  - [Vector Type](#vector-type)
- [Enums](#enums)
- [Schemas](#schemas)
- [Identity Columns](#identity-columns)
- [Generated Columns](#generated-columns)
- [Indexes & Constraints](#indexes--constraints)
  - [Indexes](#indexes)
  - [Composite Primary Keys](#composite-primary-keys)
  - [Foreign Keys](#foreign-keys)
  - [Check Constraints](#check-constraints)
- [Views](#views)
- [Sequences](#sequences)
- [Row-Level Security](#row-level-security)

---

## Column Types

All column builders imported from `"drizzle-orm/pg-core"`.

### Integer Types

```ts
import { integer, smallint, bigint, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  int: integer(),                              // 4-byte integer
  sm: smallint(),                              // 2-byte integer
  smDef: smallint().default(10),
  big: bigint({ mode: "number" }),             // 8-byte, JS number
  bigBI: bigint({ mode: "bigint" }),           // 8-byte, JS BigInt
  bigDef: bigint({ mode: "number" }).default(100),
});
```

### Serial Types

Auto-incrementing integers. Not real types — shorthand for `integer + sequence`.

```ts
import { serial, smallserial, bigserial, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  id: serial().primaryKey(),                   // 4-byte auto-inc
  sm: smallserial(),                           // 2-byte auto-inc
  big: bigserial({ mode: "number" }),          // 8-byte auto-inc, JS number
  bigBI: bigserial({ mode: "bigint" }),        // 8-byte auto-inc, JS BigInt
});
```

### Boolean

```ts
import { boolean, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  active: boolean().default(true),
});
```

### Text Types

```ts
import { text, varchar, char, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  t: text(),
  tEnum: text({ enum: ["a", "b", "c"] }),     // TS-level enum constraint
  vc: varchar({ length: 256 }),
  vcEnum: varchar({ enum: ["x", "y"] }),
  ch: char({ length: 10 }),
});
```

### Numeric / Decimal

Returns `string` by default to avoid JS precision loss.

```ts
import { numeric, decimal, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  n: numeric(),
  n2: numeric({ precision: 7 }),
  n3: numeric({ precision: 7, scale: 2 }),
  nDef: numeric().default("100.50"),
  d: decimal({ precision: 100, scale: 2 }),    // alias for numeric
});
```

### Float Types

```ts
import { real, doublePrecision, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  r: real(),                                   // 4-byte float
  rDef: real().default(100.0),
  dp: doublePrecision(),                       // 8-byte float
  dpDef: doublePrecision().default(100.0),
});
```

### JSON Types

```ts
import { json, jsonb, pgTable } from "drizzle-orm/pg-core";

type Data = { foo: string; bar: number };

const table = pgTable("table", {
  j: json(),
  jTyped: json().$type<Data>(),                // compile-time type
  jDef: json().default({ foo: "bar" }),
  jb: jsonb(),
  jbTyped: jsonb().$type<Data>(),
  jbDef: jsonb().default({ foo: "bar" }),
});
```

### UUID

```ts
import { uuid, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  id: uuid().primaryKey().defaultRandom(),     // gen_random_uuid()
  ref: uuid(),
});
```

### Date / Time Types

```ts
import { timestamp, date, time, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  // timestamp
  ts: timestamp(),                                          // mode: 'string' (default)
  tsDate: timestamp({ mode: "date" }),                      // JS Date object
  tsTz: timestamp({ withTimezone: true }),
  tsPrecision: timestamp({ precision: 6, withTimezone: true }),
  tsNow: timestamp().defaultNow(),

  // date
  d: date(),                                                // string by default
  dDate: date({ mode: "date" }),                            // JS Date object
  dNow: date().defaultNow(),

  // time
  t: time(),
  tTz: time({ withTimezone: true }),
  tPrecision: time({ precision: 6 }),
  tNow: time().defaultNow(),
});
```

### Interval

```ts
import { interval, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  i: interval(),
  iDef: interval().default("10 days"),
  iFields: interval({ fields: "day to hour" }),
  iPrecision: interval({ precision: 6 }),
});
```

### Bytea

```ts
import { bytea, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  data: bytea(),
});
```

### Bit Types

```ts
import { bit, varbit, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  b: bit({ length: 8 }),
  vb: varbit({ length: 64 }),
});
```

### Array Types

Call `.array()` on any column builder. Optionally pass a size.

```ts
import { integer, text, pgTable } from "drizzle-orm/pg-core";

const table = pgTable("table", {
  tags: text().array(),
  scores: integer().array(),
  matrix: integer().array().array(),           // 2D array
  fixed: integer().array(10),                  // array with size hint
});
```

### Vector Type

Requires `pgVector` extension / `drizzle-orm/pg-core`.

```ts
import { vector, pgTable, uuid } from "drizzle-orm/pg-core";

const items = pgTable("items", {
  id: uuid().primaryKey().defaultRandom(),
  embedding: vector({ dimensions: 1536 }),
});
```

---

## Enums

```ts
import { pgEnum, pgTable } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["guest", "user", "admin"]);

export const users = pgTable("users", {
  role: roleEnum().default("guest"),
});
```

Generates: `CREATE TYPE "role" AS ENUM ('guest', 'user', 'admin');`

---

## Schemas

Use `pgSchema` for non-public schemas.

```ts
import { pgSchema, integer, text } from "drizzle-orm/pg-core";

export const mySchema = pgSchema("my_schema");

export const users = mySchema.table("users", {
  id: integer().primaryKey(),
  name: text(),
});
```

---

## Identity Columns

Preferred over serial. Uses SQL standard `GENERATED ... AS IDENTITY`.

```ts
import { integer, pgTable, text } from "drizzle-orm/pg-core";

// GENERATED ALWAYS — DB always generates, manual insert requires OVERRIDING SYSTEM VALUE
const t1 = pgTable("t1", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text(),
});

// with sequence options
const t2 = pgTable("t2", {
  id: integer().primaryKey().generatedAlwaysAsIdentity({
    startWith: 1000,
    increment: 1,
    minValue: 1000,
    maxValue: 2147483647,
    cache: 10,
    cycle: false,
  }),
});

// GENERATED BY DEFAULT — allows manual override
const t3 = pgTable("t3", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
});
```

---

## Generated Columns

Stored computed columns using `generatedAlwaysAs`.

```ts
import { integer, text, pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const products = pgTable("products", {
  price: integer(),
  quantity: integer(),
  totalPrice: integer().generatedAlwaysAs(sql`price * quantity`),
  fullName: text().generatedAlwaysAs(sql`first_name || ' ' || last_name`),
});
```

Generated columns cannot be written to — only read.

---

## Indexes & Constraints

### Indexes

Defined in the third argument of `pgTable` (returns array).

```ts
import { pgTable, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const posts = pgTable("posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 256 }),
  slug: varchar(),
  ownerId: integer("owner_id"),
}, (table) => [
  index("title_idx").on(table.title),
  uniqueIndex("slug_idx").on(table.slug),
  // composite index
  index("owner_title_idx").on(table.ownerId, table.title),
  // expression index
  index("lower_title_idx").on(sql`lower(${table.title})`),
  // partial index
  index("active_idx").on(table.ownerId).where(sql`${table.ownerId} IS NOT NULL`),
]);
```

### Composite Primary Keys

```ts
import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";

const userRoles = pgTable("user_roles", {
  userId: integer("user_id"),
  roleId: integer("role_id"),
  extra: text(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);
```

### Foreign Keys

Inline `.references()`:

```ts
import { pgTable, integer, serial, text, AnyPgColumn } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: serial().primaryKey(),
  name: text(),
});

const posts = pgTable("posts", {
  id: serial().primaryKey(),
  ownerId: integer("owner_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "no action",
  }),
});

// Self-referencing — use AnyPgColumn
const categories = pgTable("categories", {
  id: serial().primaryKey(),
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
});
```

Standalone `foreignKey()` — required for multi-column FKs:

```ts
import { pgTable, serial, text, foreignKey, primaryKey } from "drizzle-orm/pg-core";

const user = pgTable("user", {
  firstName: text("first_name"),
  lastName: text("last_name"),
}, (table) => [
  primaryKey({ columns: [table.firstName, table.lastName] }),
]);

const profile = pgTable("profile", {
  id: serial().primaryKey(),
  userFirstName: text("user_first_name"),
  userLastName: text("user_last_name"),
}, (table) => [
  foreignKey({
    columns: [table.userFirstName, table.userLastName],
    foreignColumns: [user.firstName, user.lastName],
    name: "custom_fk",
  }).onDelete("cascade").onUpdate("no action"),
]);
```

`onDelete` / `onUpdate` options: `"cascade"`, `"restrict"`, `"no action"`, `"set null"`, `"set default"`.

### Check Constraints

```ts
import { pgTable, integer, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const products = pgTable("products", {
  id: integer().primaryKey(),
  price: integer(),
}, (table) => [
  check("price_positive", sql`${table.price} > 0`),
]);
```

---

## Views

### Regular View

```ts
import { pgView } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";

const activeUsers = pgView("active_users").as((qb) =>
  qb.select().from(users).where(sql`${users.active} = true`)
);

// with options
const secureView = pgView("secure_view")
  .with({
    checkOption: "cascaded",
    securityBarrier: true,
    securityInvoker: true,
  })
  .as((qb) => qb.select().from(users));
```

### Materialized View

```ts
import { pgMaterializedView } from "drizzle-orm/pg-core";

const userStats = pgMaterializedView("user_stats")
  .with({
    fillfactor: 90,
    autovacuum_enabled: true,
  })
  .tablespace("fast_ssd")
  .withNoData()
  .as((qb) =>
    qb.select({
      id: users.id,
      postCount: sql`count(${posts.id})`.as("post_count"),
    }).from(users).leftJoin(posts, eq(posts.ownerId, users.id)).groupBy(users.id)
  );
```

Refresh with `await db.refreshMaterializedView(userStats)`.

---

## Sequences

```ts
import { pgSequence } from "drizzle-orm/pg-core";

export const idSeq = pgSequence("id_seq", {
  startWith: 1,
  increment: 1,
  minValue: 1,
  maxValue: 9999999,
  cache: 10,
  cycle: true,
});
```

Use in columns: `integer().default(sql`nextval('id_seq')`)`.

---

## Row-Level Security

### Enable RLS on a table

```ts
import { integer, pgTable } from "drizzle-orm/pg-core";

// withRLS enables RLS with default-deny when no policies defined
export const users = pgTable.withRLS("users", {
  id: integer(),
});
```

### Define policies

```ts
import { sql } from "drizzle-orm";
import { integer, pgPolicy, pgRole, pgTable } from "drizzle-orm/pg-core";

export const admin = pgRole("admin");

export const users = pgTable("users", {
  id: integer(),
}, (t) => [
  pgPolicy("admin_delete", {
    as: "permissive",              // "permissive" | "restrictive"
    to: admin,                     // role (or array of roles)
    for: "delete",                 // "all" | "select" | "insert" | "update" | "delete"
    using: sql`true`,              // existing rows filter
    withCheck: sql`true`,          // new rows filter
  }),
  pgPolicy("read_own", {
    for: "select",
    to: "public",
    using: sql`${t.id} = current_setting('app.user_id')::int`,
  }),
]);
```

### Views with RLS

```ts
import { pgView } from "drizzle-orm/pg-core";

const secureView = pgView("secure_view")
  .with({ securityInvoker: true })
  .as((qb) => qb.select().from(users));
```

`securityInvoker: true` enforces RLS policies of underlying tables against the calling user.
