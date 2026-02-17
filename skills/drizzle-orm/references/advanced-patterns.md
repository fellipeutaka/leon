# Advanced Patterns

## Table of Contents
- [Read Replicas](#read-replicas)
- [Custom Column Types](#custom-column-types)
- [Caching](#caching)
- [Performance Tips](#performance-tips)
- [Common Gotchas](#common-gotchas)
- [ESLint Plugin](#eslint-plugin)
- [drizzle-graphql](#drizzle-graphql)

## Read Replicas

Route reads to replicas, writes to primary:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm";

const primaryDb = drizzle(process.env.PRIMARY_URL!);
const replica1 = drizzle(process.env.REPLICA_1_URL!);
const replica2 = drizzle(process.env.REPLICA_2_URL!);

const db = withReplicas(primaryDb, [replica1, replica2]);

// Reads automatically go to a random replica
await db.select().from(users);

// Writes always go to primary
await db.insert(users).values({ name: "Dan" });

// Force read from primary
await db.$primary.select().from(users);
```

## Custom Column Types

Define custom column types for unsupported or specialized types:

```ts
import { customType } from "drizzle-orm/pg-core";

// Example: citext (case-insensitive text)
const citext = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "citext";
  },
});

// Example: PostGIS geometry
const geometry = customType<{
  data: { lat: number; lng: number };
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    // parse WKT or GeoJSON
    const match = value.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    return { lng: parseFloat(match![1]), lat: parseFloat(match![2]) };
  },
});

// Usage
const locations = pgTable("locations", {
  id: serial().primaryKey(),
  name: citext().notNull(),
  point: geometry().notNull(),
});
```

### Custom Type API

```ts
customType<{
  data: TData;               // TypeScript type for application code
  driverData: TDriverData;   // type sent to/from driver
  config: TConfig;           // optional config passed at column creation
}>({
  dataType(config?) {         // returns SQL type string
    return "my_type";
  },
  toDriver(value) {           // transform app value -> driver value (optional)
    return transform(value);
  },
  fromDriver(value) {         // transform driver value -> app value (optional)
    return parse(value);
  },
});
```

## Caching

### Explicit (Opt-in)

```ts
const db = drizzle(process.env.DATABASE_URL!, {
  cache: new UpstashCache(redis),
});

// Cache this specific query
const users = await db.select().from(usersTable).$withCache();

// Custom TTL
const users = await db.select().from(usersTable).$withCache({ ttl: 60 }); // 60 seconds

// Force bypass cache
const users = await db.select().from(usersTable).$withCache({ force: true });
```

### Global (All queries cached)

```ts
const db = drizzle(process.env.DATABASE_URL!, {
  cache: new UpstashCache(redis, { global: true }),
});

// All selects cached by default
const users = await db.select().from(usersTable);

// Opt out for specific query
const freshUsers = await db.select().from(usersTable).$withCache(false);
```

### Upstash Integration

```bash
npm i @upstash/redis drizzle-orm/cache
```

```ts
import { UpstashCache } from "drizzle-orm/cache/upstash";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const db = drizzle(process.env.DATABASE_URL!, {
  cache: new UpstashCache(redis),
});
```

### Custom Cache Adapter

```ts
import type { Cache } from "drizzle-orm";

class MyCache implements Cache {
  async get(key: string): Promise<any[] | undefined> {
    // return cached result or undefined
  }
  async put(key: string, value: any[], ttl?: number): Promise<void> {
    // store result
  }
  async invalidate(tags: string[]): Promise<void> {
    // invalidate by tags
  }
}

const db = drizzle(process.env.DATABASE_URL!, { cache: new MyCache() });
```

### Cache Limitations
- Only works with `db.select()` and `db.query.*` (relational queries)
- Does not cache: raw SQL (`sql`), batch operations, transactions
- Cache key based on query SQL + parameters

## Performance Tips

### Select Only Needed Columns

```ts
// Bad — selects all columns
await db.select().from(users);

// Good — selects only needed columns
await db.select({ id: users.id, name: users.name }).from(users);
```

### Use Indexes

Ensure columns used in `.where()`, `.orderBy()`, and join conditions have indexes.

### Connection Pooling (Serverless)

For serverless/edge environments:
- Use HTTP-based drivers: Neon HTTP, PlanetScale, Turso
- These don't maintain persistent TCP connections
- For PG with serverless: use `@neondatabase/serverless` or connection pooler (PgBouncer, Supabase pooler)

### Prepared Statements

```ts
// Prepare once, execute many times
const getUser = db.select().from(users).where(eq(users.id, sql.placeholder("id"))).prepare("get_user");

// Execute
const user = await getUser.execute({ id: 1 });
const anotherUser = await getUser.execute({ id: 2 });
```

## Common Gotchas

### Importing from Correct Dialect
Always import table/column builders from the correct dialect:
```ts
// PostgreSQL
import { pgTable, serial, text } from "drizzle-orm/pg-core";
// MySQL
import { mysqlTable, int, varchar } from "drizzle-orm/mysql-core";
// SQLite
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
```

Operators and utilities come from `drizzle-orm`:
```ts
import { eq, and, or, sql, relations } from "drizzle-orm";
```

### `.returning()` Availability
- PostgreSQL: supported on INSERT/UPDATE/DELETE
- SQLite: supported on INSERT/UPDATE/DELETE
- MySQL: **not supported** — use `insertId` from result
- MSSQL: use `.output()` instead

### BigInt Mode
`bigint` columns require explicit `mode`:
```ts
bigint({ mode: "number" })   // JavaScript number (loses precision >2^53)
bigint({ mode: "bigint" })   // JavaScript BigInt (safe, but not JSON-serializable)
```

### JSON Columns Have No Runtime Validation
`json()` and `jsonb()` accept any value at runtime. Use `.$type<T>()` for compile-time safety and combine with drizzle-zod for runtime validation.

### Schema Must Be Passed for Relational Queries
```ts
// This won't work — no db.query available
const db = drizzle(url);

// Pass schema to enable db.query
const db = drizzle(url, { schema });
```

## ESLint Plugin

Catch common Drizzle mistakes at lint time:

```bash
npm i -D eslint-plugin-drizzle
```

```js
// eslint.config.js
import drizzle from "eslint-plugin-drizzle";

export default [
  {
    plugins: { drizzle },
    rules: {
      // Enforce .where() on delete/update to prevent accidental full-table operations
      "drizzle/enforce-delete-with-where": "error",
      "drizzle/enforce-update-with-where": "error",
    },
  },
];
```

## drizzle-graphql

Auto-generate a GraphQL server from a Drizzle schema with `drizzle-graphql`.

```bash
npm i drizzle-graphql @apollo/server graphql
```

```ts
import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/...";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import * as dbSchema from "./schema";

const db = drizzle({ client, schema: dbSchema });

const { schema } = buildSchema(db);

const server = new ApolloServer({ schema });
const { url } = await startStandaloneServer(server);
```

Also works with GraphQL Yoga (`graphql-yoga`). Use `entities` from `buildSchema(db)` to customize queries/mutations:

```ts
const { entities } = buildSchema(db);
// entities.queries, entities.mutations, entities.types, entities.inputs
```
