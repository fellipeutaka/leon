# Prisma Client Queries Reference

## Table of Contents

- [CRUD](#crud)
- [select / include / omit](#select--include--omit)
- [Filtering](#filtering)
- [Relation Filters](#relation-filters)
- [Logical Operators](#logical-operators)
- [Ordering, Pagination, Distinct](#ordering-pagination-distinct)
- [Nested Reads](#nested-reads)
- [Nested Writes](#nested-writes)
- [Aggregation and Grouping](#aggregation-and-grouping)
- [Transactions](#transactions)
- [JSON Fields](#json-fields)
- [Scalar Lists](#scalar-lists)
- [Composite IDs](#composite-ids)
- [Null vs Undefined](#null-vs-undefined)

## CRUD

```ts
// findUnique — by unique field or ID
const user = await prisma.user.findUnique({ where: { email: "a@b.io" } });

// findFirst — first match
const user = await prisma.user.findFirst({
  where: { posts: { some: { likes: { gt: 100 } } } },
  orderBy: { id: "desc" },
});

// findMany — all matching
const users = await prisma.user.findMany({
  where: { email: { endsWith: "prisma.io" } },
});

// create
const user = await prisma.user.create({
  data: { email: "elsa@prisma.io", name: "Elsa" },
});

// createMany (returns count; skipDuplicates not on MongoDB/SQLServer/SQLite)
const result = await prisma.user.createMany({
  data: [{ name: "A", email: "a@b.io" }, { name: "B", email: "b@b.io" }],
  skipDuplicates: true,
}); // { count: 2 }

// createManyAndReturn (PostgreSQL, CockroachDB, SQLite)
const users = await prisma.user.createManyAndReturn({
  data: [{ name: "A", email: "a@b.io" }],
});

// update
const user = await prisma.user.update({
  where: { email: "viola@prisma.io" },
  data: { name: "Viola the Magnificent" },
});

// updateMany (returns count)
const result = await prisma.user.updateMany({
  where: { email: { contains: "prisma.io" } },
  data: { role: "ADMIN" },
});

// upsert
const user = await prisma.user.upsert({
  where: { email: "viola@prisma.io" },
  update: { name: "Viola" },
  create: { email: "viola@prisma.io", name: "Viola" },
});

// Atomic number operations in update
await prisma.post.updateMany({
  data: { views: { increment: 1 }, likes: { decrement: 1 } },
});

// delete
await prisma.user.delete({ where: { email: "bert@prisma.io" } });

// deleteMany
await prisma.user.deleteMany({ where: { email: { contains: "prisma.io" } } });
await prisma.user.deleteMany({}); // all records
```

## select / include / omit

```ts
// select — return only specified fields
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: { email: true, name: true },
}); // { email: '...', name: '...' }

// select with nested relation fields
const user = await prisma.user.findFirst({
  select: { name: true, posts: { select: { title: true } } },
});

// include — return all model fields + relations
const user = await prisma.user.findFirst({
  include: { posts: true },
});

// select inside include
const user = await prisma.user.findFirst({
  include: { posts: { select: { title: true } } },
});

// Cannot use select and include at same level — use nested select instead

// omit — exclude specific fields
const user = await prisma.user.findFirst({ omit: { password: true } });
```

## Filtering

```ts
where: {
  email: "exact@match.io",                         // equals (shorthand)
  email: { equals: "exact@match.io" },              // equals (explicit)
  name: { not: "Bob" },                             // not equal
  id: { in: [1, 2, 3] },                           // in list
  age: { notIn: [18, 19] },                        // not in list
  views: { lt: 100 },                              // <
  likes: { lte: 50 },                              // <=
  score: { gt: 80 },                               // >
  rating: { gte: 4.5 },                            // >=
  bio: { contains: "prisma" },                     // substring
  name: { startsWith: "A" },                       // prefix
  email: { endsWith: "@prisma.io" },               // suffix
  title: { search: "cat & dog" },                  // full-text search (preview)
  name: { contains: "prisma", mode: "insensitive" }, // case-insensitive
}
```

## Relation Filters

```ts
// To-many: some / every / none
where: {
  posts: {
    some: { published: true },        // at least one matches
    every: { likes: { lte: 50 } },    // all match
    none: { views: { gt: 100 } },     // zero match
  },
}

// Users with zero posts
where: { posts: { none: {} } }

// Users with at least one post
where: { posts: { some: {} } }

// To-one: is / isNot
where: {
  author: {
    is: { age: { gt: 40 } },
    isNot: { name: "Bob" },
  },
}

// Posts with no author
where: { author: null }
```

## Logical Operators

```ts
where: {
  OR: [{ name: { startsWith: "E" } }, { email: { endsWith: "@prisma.io" } }],
  AND: [{ profileViews: { gt: 0 } }, { role: "ADMIN" }],
  NOT: { name: "Bob" },
}
```

## Ordering, Pagination, Distinct

```ts
// orderBy
findMany({ orderBy: { name: "asc" } })
findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] })

// Offset pagination
findMany({ skip: 10, take: 20 })

// Cursor pagination
findMany({ take: 10, cursor: { id: 50 }, skip: 1 })

// Distinct
findMany({ distinct: ["role"], select: { role: true } })
```

## Nested Reads

```ts
// Filter/sort/limit relations inside include
const user = await prisma.user.findFirst({
  include: {
    posts: {
      where: { published: false },
      orderBy: { title: "asc" },
      take: 5,
    },
  },
});

// Relation count
include: { _count: { select: { posts: true } } }
// => { id: 1, _count: { posts: 3 } }

// Filtered relation count
select: { _count: { select: { posts: { where: { title: "Hello!" } } } } }
```

## Nested Writes

All nested writes run in a single transaction; if any part fails, everything rolls back.

```ts
// create — create child records
data: { posts: { create: [{ title: "A" }, { title: "B" }] } }

// createMany — bulk create children (no further nesting allowed)
data: { posts: { createMany: { data: [{ title: "A" }, { title: "B" }] } } }

// connect — link to existing records
data: { posts: { connect: [{ id: 8 }, { id: 9 }] } }
data: { posts: { connect: { id: 11 } } }            // single

// connectOrCreate
data: { author: {
  connectOrCreate: {
    where: { email: "viola@prisma.io" },
    create: { email: "viola@prisma.io", name: "Viola" },
  },
}}

// set — replace all connections (empty array = disconnect all)
data: { posts: { set: [] } }

// disconnect
data: { posts: { disconnect: [{ id: 12 }, { id: 19 }] } }
data: { author: { disconnect: true } }               // to-one

// update — update a specific child
data: { posts: { update: { where: { id: 9 }, data: { title: "New" } } } }

// upsert — update or create child
data: { author: { upsert: { create: { ... }, update: { ... } } } }

// updateMany — update multiple children
data: { posts: { updateMany: { where: { published: true }, data: { published: false } } } }

// deleteMany — delete children
data: { posts: { deleteMany: { published: false } } }
data: { posts: { deleteMany: {} } }                  // delete all
```

## Aggregation and Grouping

```ts
// aggregate
const result = await prisma.user.aggregate({
  _avg: { age: true },
  _sum: { profileViews: true },
  _min: { age: true },
  _max: { age: true },
  _count: { age: true },
  where: { email: { contains: "prisma.io" } },
  orderBy: { age: "asc" },
  take: 10,
});

// groupBy
const groups = await prisma.user.groupBy({
  by: ["country"],
  _sum: { profileViews: true },
  _count: { country: true },
  where: { email: { contains: "prisma.io" } },  // filter before grouping
  having: { profileViews: { _avg: { gt: 100 } } }, // filter groups by aggregate
  orderBy: { _count: { country: "desc" } },
  skip: 2,
  take: 2,
});

// count
const total = await prisma.user.count();
const filtered = await prisma.user.count({ where: { profileViews: { gte: 100 } } });
const nonNull = await prisma.user.count({ select: { _all: true, name: true } });
// { _all: 30, name: 10 }
```

## Transactions

### Sequential (array)

```ts
const [posts, count] = await prisma.$transaction([
  prisma.post.findMany({ where: { title: { contains: "prisma" } } }),
  prisma.post.count(),
]);

// With isolation level
await prisma.$transaction(
  [prisma.post.deleteMany({ where: { authorId: 7 } }), prisma.user.delete({ where: { id: 7 } })],
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
);
```

### Interactive

```ts
const result = await prisma.$transaction(async (tx) => {
  const sender = await tx.account.update({
    data: { balance: { decrement: 100 } },
    where: { email: "alice@prisma.io" },
  });
  if (sender.balance < 0) throw new Error("Insufficient funds"); // rolls back
  return tx.account.update({
    data: { balance: { increment: 100 } },
    where: { email: "bob@prisma.io" },
  });
}, {
  maxWait: 5000,   // default: 2000ms
  timeout: 10000,  // default: 5000ms
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
});
```

Keep interactive transactions short to avoid deadlocks.

## JSON Fields

```ts
// Write
await prisma.user.create({
  data: { extendedPetsData: [{ name: "Bob" }] },
});

// Simple filter (exact match)
where: { extendedPetsData: { equals: [{ name: "Bob" }] } }

// Advanced path filtering (PostgreSQL — array path)
where: { extendedPetsData: { path: ["petName"], equals: "Claudine" } }
where: { extendedPetsData: { path: ["petType"], string_contains: "cat" } }
where: { extendedPetsData: { path: ["cats", "fostering"], array_contains: ["Fido"] } }

// Advanced path filtering (MySQL — dot path)
where: { extendedPetsData: { path: "$.petName", equals: "Claudine" } }
where: { extendedPetsData: { path: "$.petType", string_contains: "cat" } }
where: { extendedPetsData: { path: "$.cats.fostering", array_contains: "Fido" } }

// String filters: string_contains, string_starts_with, string_ends_with
// Array filters: array_contains, array_starts_with, array_ends_with
// Case-insensitive: add mode: "insensitive"

// JSON null vs database NULL
import { Prisma } from "@prisma/client";
data: { meta: Prisma.JsonNull }    // JSON null value
data: { meta: Prisma.DbNull }     // database NULL
where: { meta: { equals: Prisma.AnyNull } } // matches both
```

## Scalar Lists

Available on PostgreSQL, CockroachDB, MongoDB.

```ts
// Set on create
data: { tags: ["typescript", "prisma"] }

// set — overwrite
data: { tags: { set: ["new", "list"] } }

// push — append value
data: { tags: { push: "graphql" } }

// Filters
where: { tags: { has: "databases" } }                        // contains value
where: { tags: { hasEvery: ["databases", "typescript"] } }   // contains all
where: { tags: { hasSome: ["databases", "typescript"] } }    // contains any
where: { tags: { isEmpty: true } }                           // empty array
```

Note: `NULL` arrays are not matched by `isEmpty` or `NOT: { has: "x" }`. Default to `[]`.

## Composite IDs

```prisma
model Like {
  postId Int
  userId Int
  @@id(name: "likeId", [postId, userId])
}
```

```ts
// Use compound key name in unique queries
await prisma.like.findUnique({ where: { likeId: { userId: 1, postId: 1 } } });
await prisma.like.update({ where: { likeId: { userId: 1, postId: 1 } }, data: { postId: 2 } });
await prisma.like.delete({ where: { likeId: { userId: 1, postId: 1 } } });
await prisma.like.upsert({
  where: { likeId: { userId: 1, postId: 1 } },
  update: { userId: 2 },
  create: { userId: 2, postId: 1 },
});

// connect / connectOrCreate with compound ID
data: { likes: { connect: { likeId: { postId: 1, userId: 2 } } } }
```

Without custom name, default key is `fieldA_fieldB` (e.g., `postId_userId`).

## Null vs Undefined

- `null` = **value** (sets field to null / filters for null)
- `undefined` = **do nothing** (field ignored in query)

```ts
// null: finds records where name IS null
findMany({ where: { name: null } })

// undefined: no filter applied — returns all
findMany({ where: { name: undefined } })

// In updates: null sets to null, undefined leaves unchanged
update({ where: { id: 1 }, data: { name: null } })      // name => null
update({ where: { id: 1 }, data: { name: undefined } })  // name unchanged
```

**strictUndefinedChecks (preview):** passing explicit `undefined` throws at runtime. Use `Prisma.skip` to omit:

```ts
data: { email: optionalEmail ?? Prisma.skip }
```

| Operator | All filters undefined | Result          |
| -------- | --------------------- | --------------- |
| `OR`     | empty list            | returns nothing |
| `AND`    | no filter             | returns all     |
| `NOT`    | no filter             | returns all     |
