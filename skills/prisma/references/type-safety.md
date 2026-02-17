# Type Safety in Prisma Client

## Table of Contents

- [Generated Types in Prisma Namespace](#generated-types-in-prisma-namespace)
- [Model Payload Types](#model-payload-types)
- [Input Types](#input-types)
- [UncheckedInput Types](#uncheckedinput-types)
- [Prisma.validator](#prismavalidator)
- [Operating on Partial Structures](#operating-on-partial-structures)
- [Return Type of Functions](#return-type-of-functions)
- [Type Utilities](#type-utilities)
- [Prisma Type System (null vs undefined)](#prisma-type-system)
- [satisfies Patterns](#satisfies-patterns)

## Generated Types in Prisma Namespace

All generated types live under the `Prisma` namespace. Import and use with dot notation:

```ts
import { Prisma } from "./generated/prisma/client";

// Select type
const userEmail: Prisma.UserSelect = {
  email: true,
};

// Include type
const userPosts: Prisma.UserInclude = {
  posts: true,
};
```

Given this schema:

```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  name    String?
  posts   Post[]
  profile Profile?
}
```

The generated `UserSelect` type:

```ts
type Prisma.UserSelect = {
  id?: boolean | undefined;
  email?: boolean | undefined;
  name?: boolean | undefined;
  posts?: boolean | Prisma.PostFindManyArgs | undefined;
  profile?: boolean | Prisma.ProfileArgs | undefined;
};
```

## Model Payload Types

Use `Prisma.UserGetPayload<T>` to derive the return type for a given query shape:

```ts
import { Prisma } from "./generated/prisma/client";

// Type for User with posts included
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true };
}>;

// Type for User with only selected fields
type UserNameAndEmail = Prisma.UserGetPayload<{
  select: { name: true; email: true };
}>;
```

The base model type (scalars only, no relations) is exported directly:

```ts
import type { User } from "./generated/prisma/client";

// User = { id: number; email: string; name: string | null }
```

## Input Types

Generated input types for all CRUD operations:

```ts
import { Prisma } from "./generated/prisma/client";

// Create input
const createData: Prisma.UserCreateInput = {
  email: "alice@prisma.io",
  name: "Alice",
};

// Update input
const updateData: Prisma.UserUpdateInput = {
  name: "Alice Updated",
};

// Where input (for filtering)
const where: Prisma.UserWhereInput = {
  email: { contains: "prisma.io" },
  name: { not: null },
};

// Where unique input (for findUnique, update, delete)
const whereUnique: Prisma.UserWhereUniqueInput = {
  email: "alice@prisma.io",
};
```

## UncheckedInput Types

Allow writing relation scalar fields directly (bypassing nested writes). Less safe but sometimes convenient:

```ts
// UncheckedCreateInput -- write authorId directly
type PostUncheckedCreateInput = {
  id?: number;
  title: string;
  content?: string | null;
  authorId: number; // relation scalar field
};

// Using unchecked input
await prisma.post.create({
  data: {
    title: "First post",
    authorId: 1, // directly set FK
  },
});

// Safer alternative using nested connect
await prisma.post.create({
  data: {
    title: "First post",
    author: {
      connect: { id: 1 },
    },
  },
});
```

Prefer the safe `Input` types with nested `connect`/`connectOrCreate` over `UncheckedInput` types.

## Prisma.validator

Build reusable, type-safe query fragments using `satisfies`:

```ts
import { Prisma } from "./generated/prisma/client";

// Reusable select object
const userSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect;

// Reusable include object
const userWithPosts = {
  include: { posts: true },
} satisfies Prisma.UserDefaultArgs;

// Use in queries
const users = await prisma.user.findMany({
  select: userSelect,
});
```

Derive the payload type from a reusable fragment:

```ts
const userWithPosts = {
  include: { posts: true },
} satisfies Prisma.UserDefaultArgs;

type UserWithPosts = Prisma.UserGetPayload<typeof userWithPosts>;
```

## Operating on Partial Structures

### Problem

You need a type that represents a User with posts included, or only a subset of fields.

### Manual approach (fragile)

```ts
// Breaks when schema changes
type UserWithPosts = {
  id: number;
  email: string;
  name: string | null;
  posts: Post[];
};
```

### Prisma approach (auto-updates with schema)

```ts
import { Prisma } from "./generated/prisma/client";

// User with relations
const userWithPosts = {
  include: { posts: true },
} satisfies Prisma.UserDefaultArgs;

type UserWithPosts = Prisma.UserGetPayload<typeof userWithPosts>;

// User with subset of fields
const userPersonalData = {
  select: { email: true, name: true },
} satisfies Prisma.UserDefaultArgs;

type UserPersonalData = Prisma.UserGetPayload<typeof userPersonalData>;
```

### Select return types

When using `select`, the return type automatically narrows:

```ts
// result is typed as { email: string; name: string | null }[]
const result = await prisma.user.findMany({
  select: { email: true, name: true },
});
```

## Return Type of Functions

Extract the return type of a function that uses Prisma queries:

```ts
async function getUsersWithPosts() {
  return prisma.user.findMany({ include: { posts: true } });
}

// Extract the resolved type
type UsersWithPosts = Awaited<ReturnType<typeof getUsersWithPosts>>;
```

## Type Utilities

Prisma Client provides advanced type utilities for building generic, type-safe abstractions:

### Args<Type, Operation>

Retrieve input argument types for any model + operation:

```ts
// Get the type of `data` for post.create
type PostCreateBody = Prisma.Args<typeof prisma.post, "create">["data"];

const addPost = async (postBody: PostCreateBody) => {
  const post = await prisma.post.create({ data: postBody });
  return post;
};

await addPost(myData);
// myData is guaranteed to match post.create input
```

### Result<Type, Arguments, Operation>

Get the result type for a given model + args + operation:

```ts
type PostCreateResult = Prisma.Result<
  typeof prisma.post,
  { data: { title: string; authorId: number } },
  "create"
>;
```

### Exact<Input, Shape>

Enforce strict type matching (no extra properties):

```ts
function createUser<T>(data: Prisma.Exact<T, Prisma.UserCreateInput>) {
  return prisma.user.create({ data });
}
```

### Payload<Type, Operation>

Retrieve the full result structure (scalars + relations) at the type level:

```ts
type UserPayload = Prisma.Payload<typeof prisma.user, "findFirst">;
```

## Prisma Type System

### null vs undefined

In Prisma Client, `null` and `undefined` have different semantics:

- **`undefined`**: "Do nothing" / "ignore this field"
- **`null`**: "Set this field to NULL"

```ts
// Sets name to NULL in the database
await prisma.user.update({
  where: { id: 1 },
  data: { name: null },
});

// Leaves name unchanged
await prisma.user.update({
  where: { id: 1 },
  data: { name: undefined },
});
```

### JsonValue

For `Json` fields, Prisma uses the `Prisma.JsonValue` type:

```ts
import { Prisma } from "./generated/prisma/client";

const metadata: Prisma.JsonValue = {
  key: "value",
  nested: { a: 1 },
};
```

### Native type mappings

Prisma scalar types map to default database types. Use `@db.X` native type attributes for non-default mappings:

```prisma
model Post {
  id        Int      @id
  title     String           // maps to text (PG) / varchar (MySQL)
  createdAt DateTime         // maps to timestamp(3) (PG)
  updatedAt DateTime @db.Date // maps to date (PG)
}
```

## satisfies Patterns

Use TypeScript's `satisfies` operator for type-safe query options without losing inference:

```ts
import { Prisma } from "./generated/prisma/client";

// Type-checked but preserves the literal type
const args = {
  where: { email: { contains: "prisma.io" } },
  select: { id: true, email: true },
} satisfies Prisma.UserFindManyArgs;

const users = await prisma.user.findMany(args);
// users is typed as { id: number; email: string }[]

// Reusable default args for payload derivation
const withPosts = {
  include: { posts: true },
} satisfies Prisma.UserDefaultArgs;

type UserWithPosts = Prisma.UserGetPayload<typeof withPosts>;
```
