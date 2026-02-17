# Raw SQL in Prisma Client

## Table of Contents

- [queryRaw](#queryraw)
- [executeRaw](#executeraw)
- [queryRawUnsafe and executeRawUnsafe](#queryrawunsafe-and-executerawunsafe)
- [Parameterized Queries](#parameterized-queries)
- [Tagged Template Helpers](#tagged-template-helpers)
- [Raw Query Type Mapping](#raw-query-type-mapping)
- [TypedSQL](#typedsql)
- [TypedSQL Arguments](#typedsql-arguments)
- [TypedSQL Limitations](#typedsql-limitations)

## $queryRaw

Returns database records. Uses tagged template literals for SQL injection safety.

```ts
// Basic query
const users = await prisma.$queryRaw`SELECT * FROM "User"`;

// With parameterized variable (safe from SQL injection)
const email = "alice@prisma.io";
const result = await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${email}`;

// Using Prisma.sql helper
const result = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM "User" WHERE email = ${email}`
);
```

### Typing results

Pass a generic to get typed return values:

```ts
import { User } from "@prisma/client";

const result = await prisma.$queryRaw<User[]>`SELECT * FROM "User"`;
// result is typed as User[]
```

Without a type parameter, `$queryRaw` defaults to `unknown`.

### Constraints

- Template variables can only be used for **data values**, not identifiers (table names, column names) or SQL keywords.
- Variables cannot be used inside SQL string literals.
- Only **one** query per call (no `SELECT 1; SELECT 2;`).

```ts
// WRONG - cannot interpolate table names
const table = "User";
await prisma.$queryRaw`SELECT * FROM ${table}`;

// WRONG - cannot interpolate inside string literals
const name = "Bob";
await prisma.$queryRaw`SELECT 'My name is ${name}'`;

// OK - use concatenation operator instead
await prisma.$queryRaw`SELECT 'My name is ' || ${name}`;
```

## $executeRaw

Returns the **number of affected rows** (not records). Use for INSERT, UPDATE, DELETE.

```ts
const count: number =
  await prisma.$executeRaw`UPDATE "User" SET active = true WHERE "emailValidated" = true`;

// With parameters
const active = true;
const emailValidated = true;
const count: number =
  await prisma.$executeRaw`UPDATE "User" SET active = ${active} WHERE "emailValidated" = ${emailValidated}`;
```

Same constraints as `$queryRaw`: template variables for data values only, one query per call, no `ALTER` on PostgreSQL (use `$executeRawUnsafe` for that).

## $queryRawUnsafe and $executeRawUnsafe

Accept raw strings instead of tagged templates. Use when you need dynamic table/column names.

> **WARNING**: Significant SQL injection risk when concatenating user input. Prefer `$queryRaw`/`$executeRaw` whenever possible.

```ts
// Dynamic table name (not possible with tagged templates)
const table = "User";
const result = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);

// $executeRawUnsafe returns affected row count
const count = await prisma.$executeRawUnsafe(
  `UPDATE "User" SET active = true WHERE email = $1`,
  "alice@prisma.io"
);
```

Always prefer parameterized form over string concatenation:

```ts
// SAFE - parameterized
const result = await prisma.$queryRawUnsafe(
  'SELECT * FROM "User" WHERE email = $1',
  "alice@prisma.io"
);

// UNSAFE - string concatenation with user input
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM "User" WHERE email = '${userInput}'`
);
```

## Parameterized Queries

Use positional placeholders when working with `$queryRawUnsafe`/`$executeRawUnsafe`:

```ts
// PostgreSQL: $1, $2, ...
const result = await prisma.$queryRawUnsafe(
  'SELECT * FROM "User" WHERE (name = $1 OR email = $2)',
  userName,
  email
);

// MySQL: ?
const result = await prisma.$queryRawUnsafe(
  "SELECT * FROM User WHERE (name = ? OR email = ?)",
  userName,
  email
);
```

PostgreSQL ILIKE with wildcard -- put `%` in the variable, not the query:

```ts
await prisma.$queryRawUnsafe(
  'SELECT * FROM "User" WHERE email ILIKE $1',
  `%${emailFragment}`
);
```

## Tagged Template Helpers

Available via `Prisma.sql`, `Prisma.join`, `Prisma.empty`, `Prisma.raw`:

```ts
import { Prisma } from "@prisma/client";

// Prisma.join - pass a list of values for IN clause
const ids = [1, 3, 5, 10];
const result = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE id IN (${Prisma.join(ids)})
`;

// Prisma.sql - compose query fragments
const userName = "";
const result = await prisma.$queryRaw`
  SELECT * FROM "User" ${
    userName
      ? Prisma.sql`WHERE name = ${userName}`
      : Prisma.empty
  }
`;

// Prisma.sql with segments (building queries in parts)
const query1 = `SELECT id, name FROM "User" WHERE name = `;
const query2 = ` OR name = `;
const query = Prisma.sql([query1, query2, ""], inputString1, inputString2);
const result = await prisma.$queryRaw(query);
```

> **Note**: `Prisma.raw()` does NOT escape variables. Avoid using it with untrusted input.

## Raw Query Type Mapping

Database types are mapped to JavaScript types:

| Database type           | JavaScript type |
| ----------------------- | --------------- |
| Text                    | `String`        |
| 32-bit integer          | `Number`        |
| 32-bit unsigned integer | `BigInt`        |
| Floating point          | `Number`        |
| Double precision        | `Number`        |
| 64-bit integer          | `BigInt`        |
| Decimal / numeric       | `Decimal`       |
| Bytes                   | `Uint8Array`    |
| Json                    | `Object`        |
| DateTime                | `Date`          |
| Date                    | `Date`          |
| Time                    | `Date`          |
| Uuid                    | `String`        |
| Xml                     | `String`        |

**Caveat**: Raw queries do NOT standardize return types across databases. For example, a `Boolean` field returns `true`/`false` on PostgreSQL but `1`/`0` on MySQL.

**Typecasting**: Prisma does not do implicit casts. You may need explicit casts:

```ts
// ERROR: function length(integer) does not exist
await prisma.$queryRaw`SELECT LENGTH(${42})`;

// FIX: explicit cast
await prisma.$queryRaw`SELECT LENGTH(${42}::text)`;
```

**Note**: Prisma sends JavaScript integers to PostgreSQL as `INT8`. If your functions expect `INT4`, cast with `::int4`.

## TypedSQL

Write `.sql` files and get fully type-safe query functions.

### Setup

1. Enable the preview feature:

```prisma
generator client {
  provider        = "prisma-client"
  previewFeatures = ["typedSql"]
  output          = "../src/generated/prisma"
}
```

2. Create `prisma/sql/` directory and add `.sql` files:

```sql
-- prisma/sql/getUsersWithPosts.sql
SELECT u.id, u.name, COUNT(p.id) as "postCount"
FROM "User" u
LEFT JOIN "Post" p ON u.id = p."authorId"
GROUP BY u.id, u.name
```

3. Generate with `--sql` flag (requires an active database connection):

```bash
prisma generate --sql
# Or with watch mode:
prisma generate --sql --watch
```

4. Import and use:

```ts
import { PrismaClient } from "./generated/prisma/client";
import { getUsersWithPosts } from "./generated/prisma/sql";

const prisma = new PrismaClient();
const results = await prisma.$queryRawTyped(getUsersWithPosts());
```

## TypedSQL Arguments

Use database-specific placeholders:

```sql
-- PostgreSQL: $1, $2, ...
-- prisma/sql/getUsersByAge.sql
SELECT id, name, age FROM users WHERE age > $1 AND age < $2
```

```sql
-- MySQL: ?
SELECT id, name, age FROM users WHERE age > ? AND age < ?
```

```ts
import { getUsersByAge } from "./generated/prisma/sql";

const users = await prisma.$queryRawTyped(getUsersByAge(18, 30));
```

### Defining argument types explicitly

Use comments for type hints when inference is unavailable (MySQL < 8.0, SQLite):

```sql
-- @param {Int} $1:minAge
-- @param {Int} $2:maxAge
SELECT id, name, age FROM users WHERE age > $1 AND age < $2
```

Nullable parameter -- add `?` after alias:

```sql
-- @param {String} $1:name? The name (optional)
```

Accepted types: `Int`, `BigInt`, `Float`, `Boolean`, `String`, `DateTime`, `Json`, `Bytes`, `null`, `Decimal`.

### Array arguments (PostgreSQL only)

```sql
-- prisma/sql/getUsersByIds.sql
SELECT id, name, email FROM users WHERE id = ANY($1)
```

```ts
const users = await prisma.$queryRawTyped(getUsersByIds([1, 2, 3]));
```

## TypedSQL Limitations

- Requires an **active database connection** during `prisma generate --sql`.
- Does **not** support MongoDB.
- Does not support dynamic column selection -- use `$queryRaw` for that.
- MySQL < 8.0 and all SQLite versions require manual `@param` type annotations.
- SQL file names must be valid JS identifiers and cannot start with `$`.
