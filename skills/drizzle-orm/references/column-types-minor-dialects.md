# Column Types — Minor Dialects

MSSQL, CockroachDB, and SingleStore dialect-specific types. Only covers differences from main PG/MySQL references.

## Table of Contents
- [MSSQL](#mssql)
- [CockroachDB](#cockroachdb)
- [SingleStore](#singlestore)

---

## MSSQL

Import from `drizzle-orm/mssql-core`.

### Integer Types

```ts
import { int, smallint, tinyint, bigint, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  id: int().primaryKey().identity(),        // IDENTITY(1,1) auto-increment
  small: smallint(),
  tiny: tinyint(),                          // 0-255, unsigned
  big: bigint({ mode: "number" }),
});
```

### Bit (Boolean)

```ts
import { bit, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  isActive: bit(),  // 0 or 1
});
```

### String Types

```ts
import { text, ntext, varchar, nvarchar, char, nchar, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  text: text(),                              // non-Unicode, deprecated
  ntext: ntext(),                            // Unicode, deprecated
  name: varchar({ length: 255 }),            // non-Unicode
  title: nvarchar({ length: 255 }),          // Unicode
  code: char({ length: 10 }),
  label: nchar({ length: 10 }),
  maxText: varchar({ length: "max" }),       // varchar(max)
  maxNText: nvarchar({ length: "max" }),     // nvarchar(max)
});
```

### Binary

```ts
import { binary, varbinary, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  bin: binary({ length: 16 }),
  varbin: varbinary({ length: "max" }),
});
```

### Numeric

```ts
import { numeric, decimal, real, float, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  price: decimal({ precision: 10, scale: 2 }),
  score: real(),
  value: float(),
});
```

### Temporal

```ts
import { time, date, datetime, datetime2, datetimeoffset, mssqlTable } from "drizzle-orm/mssql-core";

const table = mssqlTable("table", {
  time: time(),
  date: date(),
  dt: datetime(),                           // ~3.33ms precision
  dt2: datetime2({ precision: 7 }),          // 100ns precision
  dto: datetimeoffset({ precision: 7 }),     // with timezone
});
```

### Key MSSQL Differences
- **No `.returning()`** — use `.output()` instead for INSERT/UPDATE/DELETE
- **IDENTITY** instead of serial: `int().identity()` or `int().identity({ seed: 100, increment: 5 })`
- **No boolean** — use `bit()`
- **No json/jsonb** — use `nvarchar({ length: "max" })` and parse manually
- **Schemas**: `mssqlSchema("dbo")`

```ts
// .output() example
const inserted = await db.insert(users).values({ name: "Dan" }).output();
// equivalent to: INSERT INTO users (name) OUTPUT INSERTED.* VALUES ('Dan')
```

---

## CockroachDB

Import from `drizzle-orm/pg-core` — CockroachDB uses PostgreSQL wire protocol. Most PG types work directly.

### Key Differences from PostgreSQL

```ts
import { pgTable, integer, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";

// CockroachDB tables use pgTable
const users = pgTable("users", {
  // UUID is preferred for PKs (distributed-friendly)
  id: uuid().primaryKey().defaultRandom(),

  // SERIAL works but UUID is recommended for distributed setups
  legacyId: integer().generatedByDefaultAsIdentity(),

  name: text().notNull(),
  active: boolean().default(true),
  createdAt: timestamp().defaultNow(),
});
```

### CockroachDB-Specific Notes
- **Prefer UUID PKs** over serial/sequences for distributed tables
- **No `smallserial`** — use `integer().generatedByDefaultAsIdentity()`
- **Enum handling**: same `pgEnum` but ALTER TYPE ADD VALUE is non-transactional
- **`interval`**: supported but with CockroachDB-specific storage format
- **Bit types**: `bit` and `varbit` supported with same PG syntax
- **Hash-sharded indexes**: not directly in Drizzle, use `sql` for CREATE INDEX

### Config

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",   // uses postgresql dialect
  schema: "./src/schema.ts",
  dbCredentials: {
    url: process.env.COCKROACH_URL,
  },
});
```

---

## SingleStore

Import from `drizzle-orm/singlestore-core`.

### Table Declaration

```ts
import { singlestoreTable, int, varchar, text, datetime, json, boolean } from "drizzle-orm/singlestore-core";

const users = singlestoreTable("users", {
  id: int().primaryKey().autoincrement(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).unique(),
  bio: text(),
  metadata: json().$type<{ role: string }>(),
  isActive: boolean().default(true),
  createdAt: datetime().default(sql`NOW()`),
});
```

### Column Types
Similar to MySQL with these differences:
- `singlestoreTable` instead of `mysqlTable`
- `singlestoreEnum` instead of `mysqlEnum`
- `singlestoreView` instead of `mysqlView`
- Same numeric, string, temporal, and binary types as MySQL

### Enum

```ts
import { singlestoreTable, singlestoreEnum } from "drizzle-orm/singlestore-core";

const table = singlestoreTable("table", {
  status: singlestoreEnum(["active", "inactive", "pending"]),
});
```

### Key SingleStore Differences
- **Columnstore by default** — tables are columnstore unless specified
- **No foreign key enforcement** — FKs are parsed but not enforced
- **`.returning()` not supported** — similar to MySQL
- **Sort keys / shard keys**: not directly in Drizzle schema, use raw SQL

### Config

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "singlestore",
  schema: "./src/schema.ts",
  dbCredentials: {
    url: process.env.SINGLESTORE_URL,
  },
});
```
