# Prisma Schema Reference

## Table of Contents

- [Datasource Block](#datasource-block)
- [Generator Block](#generator-block)
- [Model Definition](#model-definition)
- [Scalar Types](#scalar-types)
- [Field-Level Attributes](#field-level-attributes)
- [Block-Level Attributes](#block-level-attributes)
- [Native Type Mapping](#native-type-mapping)
- [Enums](#enums)
- [Composite Types (MongoDB)](#composite-types-mongodb)
- [Views](#views)
- [Multi-Schema Support](#multi-schema-support)
- [Table Inheritance](#table-inheritance)
- [Unsupported Type](#unsupported-type)
- [PostgreSQL Extensions](#postgresql-extensions)
- [Introspection (db pull)](#introspection-db-pull)
- [Externally Managed Tables](#externally-managed-tables)

## Datasource Block

One per schema. Providers: `postgresql`, `mysql`, `sqlite`, `sqlserver`, `mongodb`, `cockroachdb`.

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["base", "shop"]  // optional, multi-schema (PostgreSQL/SQL Server/CockroachDB)
}
```

Connection URL is configured in `prisma.config.ts`, not in the schema.

## Generator Block

```prisma
generator client {
  provider = "prisma-client"           // required
  output   = "../src/generated/prisma" // required
}
```

| Option                   | Default  | Values |
| ------------------------ | -------- | ------ |
| `runtime`                | `nodejs` | `nodejs`, `deno`, `bun`, `workerd`, `vercel-edge`, `react-native` |
| `moduleFormat`           | inferred | `esm`, `cjs` |
| `generatedFileExtension` | `ts`    | `ts`, `mts`, `cts` |
| `previewFeatures`        |          | `["views", "fullTextIndex"]` etc. |

Import paths from generated output:

```ts
import { PrismaClient } from "./generated/prisma/client";      // server
import { Role } from "./generated/prisma/enums";                // enums
import { UserModel } from "./generated/prisma/models";          // model types
import { Prisma, type Post } from "./generated/prisma/browser"; // frontend-safe
```

## Model Definition

```prisma
model User {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?            // optional (nullable)
  tags      String[]           // list (requires DB support)
  role      Role     @default(USER)
  posts     Post[]             // relation list
  profile   Profile?           // optional relation
}
```

MongoDB requires `@map("_id")` on the ID field:

```prisma
model User {
  id String @id @default(auto()) @map("_id") @db.ObjectId
}
```

Type modifiers: `?` = optional, `[]` = list. Cannot combine them.

## Scalar Types

| Prisma     | PostgreSQL         | MySQL            | SQLite    |
| ---------- | ------------------ | ---------------- | --------- |
| `String`   | `text`             | `varchar(191)`   | `TEXT`    |
| `Boolean`  | `boolean`          | `tinyint(1)`     | n/a (int) |
| `Int`      | `integer`          | `int`            | `INTEGER` |
| `BigInt`   | `bigint`           | `bigint`         | `INTEGER` |
| `Float`    | `double precision` | `double`         | `REAL`    |
| `Decimal`  | `decimal(65,30)`   | `decimal(65,30)` | `REAL`    |
| `DateTime` | `timestamp(3)`     | `datetime(3)`    | `NUMERIC` |
| `Json`     | `jsonb`            | `json`           | n/a       |
| `Bytes`    | `bytea`            | `longblob`       | n/a       |

## Field-Level Attributes

### @id, @default, @unique

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  uuid      String   @default(uuid())
  published Boolean  @default(false)
  email     String   @unique
}
```

`dbgenerated()` for native DB functions:

```prisma
model User {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
}
```

Default values: static (`5`, `"Hello"`, `false`), lists (`[5, 6]`), functions (`now()`, `uuid()`, `cuid()`, `autoincrement()`, `auto()`).

### @map

Maps field to a different column name: `content String @map("comment_text")`

### @relation

```prisma
model Post {
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}
```

Disambiguate with name: `@relation("PostAuthor", fields: [authorId], references: [id])`

### @updatedAt

Auto-stores last update time: `updatedAt DateTime @updatedAt`

### @ignore

Excludes field from Prisma Client.

### @db.*

Native type attributes (PascalCase, `@db` prefix):

```prisma
model Post {
  title   String @db.VarChar(200)
  content String @db.Text
}
```

## Block-Level Attributes

### @@id -- composite primary key

```prisma
@@id([firstName, lastName])
@@id(name: "fullName", fields: [firstName, lastName])  // custom client name
```

### @@unique -- composite unique

```prisma
@@unique([authorId, title])
```

### @@index

```prisma
@@index([title, content])
```

PostgreSQL index types (`type` arg): `BTree` (default), `Hash`, `Gist`, `Gin`, `SpGist`, `Brin`:

```prisma
@@index([value], type: Hash)
@@index([data(ops: JsonbPathOps)], type: Gin)
```

Sort order and length (MySQL): `@@index([title(length: 100, sort: Desc)])`

Full-text (preview): `@@fulltext([title, content])`

### @@map -- map model to table name

```prisma
@@map("comments")
```

### @@ignore -- exclude model from Prisma Client

### @@schema -- assign to database schema (multi-schema)

```prisma
@@schema("shop")
```

## Native Type Mapping

### PostgreSQL

| Prisma     | `@db.*` types |
| ---------- | ------------- |
| `String`   | `Text`, `VarChar(n)`, `Char(n)`, `Bit(n)`, `VarBit`, `Uuid`, `Xml`, `Inet`, `Citext` |
| `Boolean`  | `Boolean` |
| `Int`      | `Integer`, `SmallInt`, `Oid` |
| `BigInt`   | `BigInt` |
| `Float`    | `DoublePrecision`, `Real` |
| `Decimal`  | `Decimal(p,s)`, `Money` |
| `DateTime` | `Timestamp(n)`, `Timestamptz(n)`, `Date`, `Time(n)`, `Timetz(n)` |
| `Json`     | `Json`, `JsonB` |
| `Bytes`    | `ByteA` |

### MySQL

| Prisma     | `@db.*` types |
| ---------- | ------------- |
| `String`   | `VarChar(n)`, `Text`, `Char(n)`, `TinyText`, `MediumText`, `LongText` |
| `Boolean`  | `TinyInt(1)` |
| `Int`      | `Int`, `SmallInt`, `MediumInt`, `TinyInt`, `Year` |
| `BigInt`   | `BigInt` |
| `Float`    | `Float`, `Double` |
| `Decimal`  | `Decimal(p,s)` |
| `DateTime` | `DateTime(n)`, `Date`, `Time(n)`, `Timestamp(n)` |
| `Json`     | `Json` |
| `Bytes`    | `Blob`, `TinyBlob`, `MediumBlob`, `LongBlob`, `Binary`, `VarBinary` |

### SQLite

No `@db.*` attributes. Maps to: `TEXT`, `INTEGER`, `REAL`, `NUMERIC`, `BLOB`.

## Enums

```prisma
enum Role {
  USER
  ADMIN
}
```

Map names/values to DB: `@map("pending")` on values, `@@map("status_enum")` on enum block.

In generated TS, `Status.PENDING` = `"PENDING"` (not the mapped value). Mapping is DB-level only.

## Composite Types (MongoDB)

Only MongoDB. Embedded documents:

```prisma
type Photo {
  height Int
  width  Int
  url    String
}

model Product {
  id     String  @id @default(auto()) @map("_id") @db.ObjectId
  photos Photo[]
}
```

Supported: `@default`, `@map`, `@db.*`. Not supported: `@unique`, `@id`, `@relation`, `@ignore`, `@updatedAt`.

## Views

Preview feature. Read-only.

```prisma
generator client {
  provider        = "prisma-client"
  output          = "./generated"
  previewFeatures = ["views"]
}

view UserInfo {
  id    Int    @unique   // enables findUnique; not enforced
  email String
  name  String
  bio   String
}
```

Create in DB manually or via `migrate dev --create-only`:

```sql
CREATE VIEW "UserInfo" AS
  SELECT u.id, email, name, bio
  FROM "User" u LEFT JOIN "Profile" p ON u.id = p."userId";
```

Limitations: no `@id`/`@@id`, no `@@index`, `@unique` not enforced, no write operations.

## Multi-Schema Support

PostgreSQL, CockroachDB, SQL Server only.

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["base", "shop"]
}

model User {
  id Int @id
  @@schema("base")
}

model Order {
  id     Int  @id
  user   User @relation(fields: [userId], references: [id])
  userId Int
  @@schema("shop")
}
```

Same-name tables across schemas -- disambiguate with `@@map`:

```prisma
model BaseConfig {
  id Int @id
  @@map("Config")
  @@schema("base")
}
```

## Table Inheritance

### Single-Table Inheritance (STI)

One table, discriminator column, model-specific fields optional:

```prisma
model Activity {
  id       Int          @id
  url      String       @unique
  duration Int?                   // video-only
  body     String?                // article-only
  type     ActivityType           // discriminator
}
enum ActivityType { Video; Article }
```

### Multi-Table Inheritance (MTI)

Separate tables, 1-1 relations to base:

```prisma
model Activity {
  id   Int          @id @default(autoincrement())
  url  String
  type ActivityType
  video   Video?
  article Article?
}
model Video {
  id         Int      @id @default(autoincrement())
  duration   Int
  activityId Int      @unique
  activity   Activity @relation(fields: [activityId], references: [id])
}
```

STI: simpler queries, wide rows with NULLs, weaker typing.
MTI: cleaner data, requires JOINs, better typing.

## Unsupported Type

For DB types without a Prisma equivalent. Excluded from Prisma Client.

```prisma
model Star {
  id       Int                    @id @default(autoincrement())
  position Unsupported("circle")? @default(dbgenerated("'<(10,4),11>'::circle"))
}
```

Access via raw queries only. Not available on MongoDB.

## PostgreSQL Extensions

Activate via migration (`npx prisma migrate dev --create-only`), add SQL:

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Then `npx prisma migrate deploy`. Use extension types via `Unsupported` if needed.

## Introspection (db pull)

Generates/updates Prisma schema from existing database.

```bash
npx prisma db pull           # merge with existing schema
npx prisma db pull --force   # overwrite entirely
```

| Database           | Prisma Schema          |
| ------------------ | ---------------------- |
| Tables/Collections | `model` blocks         |
| Columns/Fields     | Fields                 |
| Indexes            | `@@index`              |
| Primary keys       | `@id` / `@@id`        |
| Foreign keys       | `@relation`            |
| Unique constraints | `@unique` / `@@unique` |
| Enums              | `enum` blocks          |
| Views              | `view` blocks          |

Preserved on re-introspection: model/enum order, comments, `@map`/`@@map`, `@updatedAt`, `@default(cuid())`, `@default(uuid())`, custom `@relation` names. Invalid characters sanitized via `@map`/`@@map`.

## Externally Managed Tables

Tables queryable via Prisma Client but ignored by Prisma Migrate. In `prisma.config.ts`:

```ts
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
  experimental: { externalTables: true },
  tables: { external: ["public.users"] },
  enums:  { external: ["public.role"] },
  migrations: {
    path: "prisma/migrations",
    initShadowDb: `CREATE TABLE public.users (id SERIAL PRIMARY KEY);`,
  },
});
```

Workflow: declare in config, `db pull` or manually add models, `prisma generate`, query normally.
