# Drizzle ORM — Queries Reference

## Table of Contents

- [Operators Reference](#operators-reference)
- [Select](#select)
- [Insert](#insert)
- [Update](#update)
- [Delete](#delete)
- [Joins](#joins)
- [Set Operations](#set-operations)
- [Dynamic Query Building](#dynamic-query-building)
- [Prepared Statements](#prepared-statements)
- [Raw SQL](#raw-sql)
- [Common Patterns](#common-patterns)
  - [$count utility](#count-utility)

## Operators Reference

All operators imported from `'drizzle-orm'`:

```ts
import {
  eq, ne, gt, gte, lt, lte,
  isNull, isNotNull,
  inArray, notInArray,
  between,
  like, ilike, notLike, notIlike,
  and, or, not,
  exists,
  sql,
} from "drizzle-orm";
```

### Comparison

```ts
eq(users.id, 1)              // = 1
ne(users.status, "inactive")  // != 'inactive'
gt(users.age, 18)             // > 18
gte(users.age, 21)            // >= 21
lt(users.age, 65)             // < 65
lte(users.age, 100)           // <= 100
```

### Null checks

```ts
isNull(users.deletedAt)
isNotNull(users.email)
```

### Array membership

```ts
inArray(users.role, ["admin", "moderator"])
notInArray(users.status, ["banned", "suspended"])
```

### Pattern matching

```ts
like(users.name, "%Dan%")
ilike(users.email, "%@gmail.com")   // case-insensitive (PG)
notLike(users.name, "%bot%")
notIlike(users.email, "%@spam.com") // case-insensitive (PG)
```

### Range

```ts
between(users.age, 18, 65)
```

### Logical

```ts
and(eq(users.role, "admin"), gt(users.age, 18))
or(eq(users.role, "admin"), eq(users.role, "moderator"))
not(eq(users.status, "banned"))
```

### Exists

```ts
exists(db.select().from(orders).where(eq(orders.userId, users.id)))
```

## Select

### Basic select

```ts
const allUsers = await db.select().from(users);
```

### Partial select

```ts
const result = await db.select({
  id: users.id,
  name: users.name,
}).from(users);
```

### Computed columns

```ts
const result = await db.select({
  id: users.id,
  lowerName: sql<string>`lower(${users.name})`,
}).from(users);
```

### Where with operators

```ts
await db.select().from(users).where(eq(users.id, 42));
await db.select().from(users).where(
  and(gte(users.age, 18), eq(users.role, "admin"))
);
```

### orderBy

```ts
import { asc, desc } from "drizzle-orm";

await db.select().from(users).orderBy(asc(users.name));
await db.select().from(users).orderBy(desc(users.createdAt));
```

### limit / offset

```ts
await db.select().from(users).limit(10).offset(20);
```

### distinct / distinctOn

```ts
// distinct
await db.selectDistinct().from(users).orderBy(users.name);

// distinctOn (PG only)
await db.selectDistinctOn([users.name]).from(users);
```

### groupBy + having

```ts
import { count } from "drizzle-orm";

await db
  .select({ role: users.role, total: count() })
  .from(users)
  .groupBy(users.role)
  .having(gt(count(), 5));
```

### Aggregations

Use `sql` template for aggregate functions:

```ts
import { sql } from "drizzle-orm";

await db.select({
  totalPrice: sql<number>`cast(sum(${orderDetails.quantity} * ${products.unitPrice}) as float)`,
  totalQty: sql<number>`cast(sum(${orderDetails.quantity}) as int)`,
  productCount: sql<number>`cast(count(${orderDetails.productId}) as int)`,
}).from(orders)
  .leftJoin(orderDetails, eq(orderDetails.orderId, orders.id))
  .leftJoin(products, eq(products.id, orderDetails.productId))
  .groupBy(orders.id);
```

### Subqueries with .as()

```ts
const sq = db
  .select({ userId: orders.userId, total: sql<number>`count(*)`.as("total") })
  .from(orders)
  .groupBy(orders.userId)
  .as("order_counts");

await db
  .select({ name: users.name, orderCount: sq.total })
  .from(users)
  .leftJoin(sq, eq(users.id, sq.userId));
```

### CTEs with $with

```ts
const userCount = db.$with("user_count").as(
  db.select({ value: sql`count(*)`.as("value") }).from(users)
);

const result = await db.with(userCount)
  .select()
  .from(users)
  .where(sql`(select * from ${userCount}) > 0`);
```

## Insert

### Single row

```ts
await db.insert(users).values({ name: "Andrew", email: "andrew@example.com" });
```

### Bulk insert

```ts
await db.insert(users).values([
  { name: "Andrew", email: "andrew@example.com" },
  { name: "Dan", email: "dan@example.com" },
]);
```

### .returning() (PG/SQLite)

```ts
// all columns
const [inserted] = await db.insert(users)
  .values({ name: "Dan", email: "dan@example.com" })
  .returning();

// partial
const [{ id }] = await db.insert(users)
  .values({ name: "Dan", email: "dan@example.com" })
  .returning({ id: users.id });
```

### .onConflictDoNothing() (PG/SQLite)

```ts
await db.insert(users)
  .values({ id: 1, name: "John" })
  .onConflictDoNothing();

// with target
await db.insert(users)
  .values({ id: 1, name: "John" })
  .onConflictDoNothing({ target: users.id });
```

### .onConflictDoUpdate() — upsert (PG/SQLite)

```ts
await db.insert(users)
  .values({ id: 1, name: "Dan" })
  .onConflictDoUpdate({
    target: users.id,
    set: { name: "John" },
  });

// composite key target
await db.insert(inventory)
  .values({ warehouseId: 1, productId: 1, quantity: 100 })
  .onConflictDoUpdate({
    target: [inventory.warehouseId, inventory.productId],
    set: { quantity: sql`${inventory.quantity} + 100` },
  });

// preserve specific columns on conflict
await db.insert(users)
  .values({ id: 1, name: "John", email: "john@email.com", age: 29 })
  .onConflictDoUpdate({
    target: users.id,
    set: { name: "John", email: sql`${users.email}`, age: 29 }, // email stays unchanged
  });
```

### .onDuplicateKeyUpdate() (MySQL)

```ts
await db.insert(users)
  .values({ id: 1, name: "John", email: "john@example.com" })
  .onDuplicateKeyUpdate({ set: { name: "John" } });
```

### Insert from select

```ts
await db.insert(archivedUsers).select(
  db.select().from(users).where(lt(users.createdAt, cutoffDate))
);
```

### Insert with CTE

```ts
const userCount = db.$with("user_count").as(
  db.select({ value: sql`count(*)`.as("value") }).from(users)
);

await db.with(userCount)
  .insert(users)
  .values([
    { username: "user1", admin: sql`((select * from ${userCount}) = 0)` },
  ])
  .returning({ admin: users.admin });
```

## Update

### Basic update

```ts
await db.update(users)
  .set({ name: "Jane", updatedAt: new Date() })
  .where(eq(users.id, 1));
```

### .returning() (PG/SQLite)

```ts
const [updated] = await db.update(users)
  .set({ name: "Jane" })
  .where(eq(users.id, 1))
  .returning();
```

### Update with join (PG)

```ts
await db.update(orders)
  .set({ status: "shipped" })
  .from(users)
  .where(and(eq(orders.userId, users.id), eq(users.vip, true)));
```

### Update with join (SQLite)

```ts
await db.update(orders)
  .set({ status: "shipped" })
  .from(users)
  .where(and(eq(orders.userId, users.id), eq(users.vip, true)));
```

## Delete

### Basic delete

```ts
await db.delete(users).where(eq(users.id, 1));
```

### .returning() (PG/SQLite)

```ts
const [deleted] = await db.delete(users)
  .where(eq(users.id, 1))
  .returning();
```

## Joins

### Syntax

```ts
db.select()
  .from(tableA)
  .innerJoin(tableB, eq(tableA.id, tableB.aId))
  .leftJoin(tableC, eq(tableA.id, tableC.aId))
  .rightJoin(tableD, eq(tableA.id, tableD.aId))   // PG only
  .fullJoin(tableE, eq(tableA.id, tableE.aId));    // PG only
```

### Inner join

```ts
await db.select()
  .from(users)
  .innerJoin(orders, eq(users.id, orders.userId));
```

### Left join

```ts
await db.select()
  .from(users)
  .leftJoin(orders, eq(users.id, orders.userId));
```

### Self-join with alias

```ts
import { alias } from "drizzle-orm/pg-core"; // or mysql-core, sqlite-core

const parent = alias(users, "parent");

await db.select({
  user: users.name,
  manager: parent.name,
}).from(users)
  .leftJoin(parent, eq(users.managerId, parent.id));
```

### Many-to-many through junction table

```ts
await db.select({
  userId: users.id,
  groupId: groups.id,
  groupName: groups.name,
}).from(users)
  .innerJoin(usersToGroups, eq(users.id, usersToGroups.userId))
  .innerJoin(groups, eq(usersToGroups.groupId, groups.id));
```

## Set Operations

All set operations combine results of two or more queries. Column types must match.

```ts
// union — deduplicated
const result = await db.select().from(users)
  .union(db.select().from(archivedUsers));

// unionAll — keeps duplicates
await db.select().from(users)
  .unionAll(db.select().from(archivedUsers));

// intersect
await db.select().from(users)
  .intersect(db.select().from(premiumUsers));

// intersectAll
await db.select().from(users)
  .intersectAll(db.select().from(premiumUsers));

// except
await db.select().from(users)
  .except(db.select().from(bannedUsers));

// exceptAll
await db.select().from(users)
  .exceptAll(db.select().from(bannedUsers));
```

## Dynamic Query Building

Use `$dynamic()` for conditional where/orderBy/limit:

```ts
function withPagination<T extends PgSelect>(qb: T, page: number, size = 20) {
  return qb.limit(size).offset((page - 1) * size);
}

function withFilters<T extends PgSelect>(qb: T, filters: SQL[]) {
  return qb.where(and(...filters));
}

const query = db.select().from(users).$dynamic();
const filtered = withFilters(query, [eq(users.role, "admin")]);
const paginated = withPagination(filtered, 2);
const result = await paginated;
```

## Prepared Statements

```ts
import { sql } from "drizzle-orm";

// PG / MySQL
const prepared = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder("id")))
  .prepare("get_user");

await prepared.execute({ id: 10 });
await prepared.execute({ id: 12 });

// SQLite — uses .get() / .all()
const prepared = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder("id")))
  .prepare();

prepared.get({ id: 10 });
prepared.all({ id: 10 });
```

## Raw SQL

### sql tagged template

```ts
import { sql } from "drizzle-orm";

// inline expression
await db.select({
  lower: sql<string>`lower(${users.name})`,
}).from(users);

// full raw query
await db.execute(sql`SELECT * FROM ${users} WHERE ${users.id} = ${id}`);
```

### Typed sql

```ts
sql<number>`count(*)`;
sql<string>`lower(${users.name})`;
```

### sql.raw()

Use for trusted strings that should NOT be parameterized:

```ts
sql`ORDER BY ${sql.raw(columnName)} ASC`;
```

## Common Patterns

### Conditional filters

```ts
const filters: SQL[] = [];
if (name) filters.push(ilike(posts.title, `%${name}%`));
if (categories.length) filters.push(inArray(posts.category, categories));
if (minViews) filters.push(gt(posts.views, minViews));

await db.select().from(posts).where(and(...filters));
```

### Count rows

```ts
const [{ count }] = await db
  .select({ count: sql<number>`cast(count(*) as integer)` })
  .from(users);
```

### Limit/offset pagination

```ts
const page = 2;
const pageSize = 20;
await db.select().from(users)
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

### Cursor pagination

```ts
await db.select().from(users)
  .where(gt(users.id, lastSeenId))
  .orderBy(asc(users.id))
  .limit(20);
```

### Exists subquery

```ts
await db.select().from(users).where(
  exists(
    db.select().from(orders).where(eq(orders.userId, users.id))
  )
);
```

### $count utility

`db.$count()` — wrapper around `count(*)`, usable standalone or as a subquery:

```ts
const count = await db.$count(users);                              // number
const count = await db.$count(users, eq(users.name, "Dan"));       // with filter

// As subquery in select
const result = await db.select({
  ...users,
  postsCount: db.$count(posts, eq(posts.authorId, users.id)),
}).from(users);

// In relational queries extras
const result = await db.query.users.findMany({
  extras: {
    postsCount: db.$count(posts, eq(posts.authorId, users.id)),
  },
});
```
