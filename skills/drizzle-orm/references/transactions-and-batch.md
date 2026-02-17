# Transactions & Batch API

## Table of Contents
- [Basic Transaction](#basic-transaction)
- [Return Values](#return-values)
- [Rollback](#rollback)
- [Dialect-Specific Config](#dialect-specific-config)
- [Nested Transactions (Savepoints)](#nested-transactions-savepoints)
- [Batch API](#batch-api)

## Basic Transaction

```ts
await db.transaction(async (tx) => {
  await tx.insert(accounts).values({ balance: 100 });
  await tx.update(accounts).set({ balance: 0 }).where(eq(accounts.id, 1));
});
```

## Return Values

```ts
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ name: "Dan" }).returning();
  const [account] = await tx.insert(accounts).values({ userId: user.id, balance: 0 }).returning();
  return { user, account };
});
// result.user, result.account
```

## Rollback

```ts
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ name: "Dan" }).returning();

  const hasEnoughCredits = await checkCredits(user.id);
  if (!hasEnoughCredits) {
    tx.rollback();
    // code after rollback() is unreachable — it throws
  }

  await tx.insert(orders).values({ userId: user.id, amount: 100 });
});
```

## Dialect-Specific Config

### PostgreSQL

```ts
await db.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: "read committed",      // "read uncommitted" | "read committed" | "repeatable read" | "serializable"
  accessMode: "read write",              // "read only" | "read write"
  deferrable: true,                      // boolean (only with serializable + read only)
});
```

### MySQL

```ts
await db.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: "repeatable read",     // "read uncommitted" | "read committed" | "repeatable read" | "serializable"
  accessMode: "read write",             // "read only" | "read write"
  withConsistentSnapshot: true,          // boolean
});
```

### SQLite

```ts
await db.transaction(async (tx) => {
  // ...
}, {
  behavior: "deferred",                 // "deferred" | "immediate" | "exclusive"
});
```

### MSSQL

```ts
await db.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: "read committed",     // "read uncommitted" | "read committed" | "repeatable read" | "serializable" | "snapshot"
});
```

## Nested Transactions (Savepoints)

Nested `tx.transaction()` calls create savepoints:

```ts
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: "Dan" });

  // creates SAVEPOINT
  await tx.transaction(async (nested) => {
    await nested.insert(accounts).values({ userId: 1, balance: 100 });
    // nested.rollback() rolls back to savepoint, not entire transaction
  });
});
```

## Batch API

Execute multiple queries in a single roundtrip. Available for LibSQL, Neon, and Cloudflare D1.

### LibSQL / Turso

```ts
import { drizzle } from "drizzle-orm/libsql";

const db = drizzle(/* ... */);

const results = await db.batch([
  db.insert(users).values({ name: "Dan" }),
  db.select().from(users),
  db.update(users).set({ name: "Daniel" }).where(eq(users.id, 1)),
  db.delete(users).where(eq(users.id, 2)),
]);
// results is a tuple matching the input array types
// [ResultSet, User[], ResultSet, ResultSet]
```

### Neon HTTP

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const results = await db.batch([
  db.insert(users).values({ name: "Dan" }),
  db.select().from(users).where(eq(users.id, 1)),
]);
```

### Cloudflare D1

```ts
import { drizzle } from "drizzle-orm/d1";

const db = drizzle(env.DB);

const results = await db.batch([
  db.insert(users).values({ name: "Dan" }),
  db.select().from(users),
]);
```

### Batch Notes
- Batch runs all queries in an implicit transaction
- Type-safe: return tuple matches input query types
- Relational queries (`db.query.*`) and raw `sql` queries work in batch
- Not available for node-postgres, mysql2, better-sqlite3 (use transactions instead)
