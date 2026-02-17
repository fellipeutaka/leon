# Prisma Client Extensions

## Table of Contents

- [Overview](#overview)
- [Creating Extensions](#creating-extensions)
- [Chaining Multiple Extensions](#chaining-multiple-extensions)
- [Model Component](#model-component)
- [Client Component](#client-component)
- [Query Component](#query-component)
- [Result Component](#result-component)
- [Type Utilities](#type-utilities)
- [Read Replicas Extension](#read-replicas-extension)
- [Typing Extended Clients](#typing-extended-clients)

## Overview

`$extends` creates an extended client — a lightweight wrapper around the standard Prisma Client. The original client is never mutated. Extended clients share the same connection pool. Four component types: `model`, `client`, `query`, `result`.

## Creating Extensions

### Inline

```ts
const prisma = new PrismaClient().$extends({
  name: "myExtension", // optional, appears in error logs
  model: { ... },
  client: { ... },
  query: { ... },
  result: { ... },
});
```

### With Prisma.defineExtension

Useful for separating extensions into multiple files.

```ts
import { Prisma } from "@prisma/client";

const myExtension = Prisma.defineExtension({
  name: "myExtension",
  model: {
    user: { ... },
  },
});

const prisma = new PrismaClient().$extends(myExtension);
```

### With callback form (access to base client)

```ts
const ext = Prisma.defineExtension((prisma) =>
  prisma.$extends({
    query: {
      user: {
        async findFirst({ args, query }) {
          const [result] = await prisma.$transaction([query(args)]);
          return result;
        },
      },
    },
  })
);
```

## Chaining Multiple Extensions

```ts
const prisma = new PrismaClient()
  .$extends(extensionA)
  .$extends(extensionB);
```

On conflict, the **last** extension takes precedence. Extensions execute in order (FIFO) for query hooks.

## Model Component

### Specific model

```ts
const prisma = new PrismaClient().$extends({
  model: {
    user: {
      async signUp(email: string) {
        await prisma.user.create({ data: { email } });
      },
    },
  },
});

await prisma.user.signUp("john@prisma.io");
```

### All models with `$allModels`

```ts
const prisma = new PrismaClient().$extends({
  model: {
    $allModels: {
      async exists<T>(
        this: T,
        where: Prisma.Args<T, "findFirst">["where"]
      ): Promise<boolean> {
        const context = Prisma.getExtensionContext(this);
        const result = await (context as any).findFirst({ where });
        return result !== null;
      },
    },
  },
});

await prisma.user.exists({ name: "Alice" });
await prisma.post.exists({ title: { contains: "Prisma" } });
```

### Prisma.getExtensionContext(this)

- Access the current model context at runtime
- `$name` property returns the model name as a string
- Call custom methods from other custom methods on the same model

```ts
const context = Prisma.getExtensionContext(this);
console.log(context.$name); // "User"
await (context as any).findFirst({ where });
```

### Cross-method calls

```ts
const prisma = new PrismaClient().$extends({
  model: {
    user: {
      firstMethod() { ... },
      secondMethod() {
        Prisma.getExtensionContext(this).firstMethod();
      },
    },
  },
});
```

## Client Component

Add top-level methods to the Prisma Client instance.

```ts
let total = 0;
const prisma = new PrismaClient().$extends({
  client: {
    $log: (s: string) => console.log(s),
    async $totalQueries() {
      return total;
    },
  },
  query: {
    $allModels: {
      async $allOperations({ query, args }) {
        total += 1;
        return query(args);
      },
    },
  },
});

prisma.$log("Hello world");
const count = await prisma.$totalQueries();
```

## Query Component

Hook into the query lifecycle. Callback receives `{ model, operation, args, query }`.

- `model`: model name string (undefined for raw queries)
- `operation`: operation name string
- `args`: type-safe mutable query input (cannot mutate `include`/`select`)
- `query`: promise-returning function to execute the query

### Specific operation on specific model

```ts
const prisma = new PrismaClient().$extends({
  query: {
    user: {
      async findMany({ model, operation, args, query }) {
        args.where = { ...args.where, age: { gt: 18 } };
        return query(args);
      },
    },
  },
});
```

### Specific operation on all models

```ts
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args = { ...args, take: 100 };
        return query(args);
      },
    },
  },
});
```

### All operations on a specific model

```ts
const prisma = new PrismaClient().$extends({
  query: {
    user: {
      $allOperations({ model, operation, args, query }) {
        return query(args);
      },
    },
  },
});
```

### All operations on all models

```ts
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(args);
      },
    },
  },
});
```

### $allOperations (top-level, includes raw queries)

```ts
const prisma = new PrismaClient().$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const start = performance.now();
      const result = await query(args);
      console.log(`${model}.${operation}: ${performance.now() - start}ms`);
      return result;
    },
  },
});
```

### Raw query hooks

```ts
const prisma = new PrismaClient().$extends({
  query: {
    $queryRaw({ args, query, operation }) {
      return query(args);
    },
    $executeRaw({ args, query, operation }) {
      return query(args);
    },
  },
});
```

### Limitation

`query` extensions do not support nested read/write operations.

## Result Component

Add computed fields or methods to query results. Computed lazily (on access, not on retrieval).

### Computed field

```ts
const prisma = new PrismaClient().$extends({
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`;
        },
      },
    },
  },
});

const user = await prisma.user.findFirst();
console.log(user.fullName); // "John Doe"
```

### Reusing computed fields across chained extensions

```ts
const prisma = new PrismaClient()
  .$extends({
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`;
          },
        },
      },
    },
  })
  .$extends({
    result: {
      user: {
        titleFullName: {
          needs: { title: true, fullName: true },
          compute(user) {
            return `${user.title} (${user.fullName})`;
          },
        },
      },
    },
  });
```

### Custom method on result

```ts
const prisma = new PrismaClient().$extends({
  result: {
    user: {
      save: {
        needs: { id: true },
        compute(user) {
          return () =>
            prisma.user.update({ where: { id: user.id }, data: user });
        },
      },
    },
  },
});

const user = await prisma.user.findUniqueOrThrow({ where: { id: someId } });
user.email = "new@example.com";
await user.save();
```

### Interaction with `omit`

Omitting a dependency of a computed field: the field is still read from the DB but excluded from the result. To prevent the DB read entirely, omit both the computed field and its dependencies:

```ts
const user = await xprisma.user.findFirstOrThrow({
  omit: { sanitizedPassword: true, password: true },
});
```

### Limitations

- Only scalar fields in `needs` (no relations)
- Computed fields only work when their dependencies are selected
- Cannot aggregate computed fields

## Type Utilities

```ts
import { Prisma } from "@prisma/client";
```

| Utility | Purpose |
|---|---|
| `Prisma.Exact<Input, Shape>` | Enforce strict type matching on `Input` against `Shape` |
| `Prisma.Args<T, Operation>` | Get input argument types for a model+operation |
| `Prisma.Result<T, Args, Operation>` | Get result type for a model+operation+args |
| `Prisma.Payload<T, Operation>` | Get full result structure (scalars + relations) |

### Example: custom findMany with extra args

```ts
type CacheStrategy = { swr: number; ttl: number };

const prisma = new PrismaClient().$extends({
  model: {
    $allModels: {
      findMany<T, A>(
        this: T,
        args: Prisma.Exact<A, Prisma.Args<T, "findMany"> & CacheStrategy>
      ): Prisma.Result<T, A, "findMany"> {
        // implementation
      },
    },
  },
});
```

## Read Replicas Extension

```bash
npm install @prisma/extension-read-replicas
```

```ts
import { readReplicas } from "@prisma/extension-read-replicas";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const mainAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const mainClient = new PrismaClient({ adapter: mainAdapter });

const replicaAdapter = new PrismaPg({ connectionString: process.env.REPLICA_URL! });
const replicaClient = new PrismaClient({ adapter: replicaAdapter });

const prisma = mainClient.$extends(readReplicas({ replicas: [replicaClient] }));
```

All reads go to replicas, all writes and `$transaction` go to primary. Multiple replicas are load-balanced randomly.

### Force primary or replica

```ts
// Force read from primary
const posts = await prisma.$primary().post.findMany();

// Force execution on replica
const result = await prisma.$replica().user.findFirst();
```

## Typing Extended Clients

### Direct typeof

```ts
const extendedPrisma = new PrismaClient().$extends({ /* ... */ });
type ExtendedPrismaClient = typeof extendedPrisma;
```

### From factory function (singleton pattern)

```ts
function getExtendedClient() {
  return new PrismaClient().$extends({ /* ... */ });
}
type ExtendedPrismaClient = ReturnType<typeof getExtendedClient>;
```

### Prisma.Result for extended model types

```ts
type ExtendedUser = Prisma.Result<
  typeof prisma.user,
  { select: { id: true } },
  "findFirstOrThrow"
>;
```
