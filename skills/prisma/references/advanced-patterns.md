# Advanced Patterns

## Table of Contents

- [Logging](#logging)
- [Error Handling](#error-handling)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Deployment](#deployment)
- [Edge Runtimes](#edge-runtimes)
- [Custom Model and Field Names](#custom-model-and-field-names)
- [Best Practices](#best-practices)

## Logging

### Log levels

Four levels: `query`, `info`, `warn`, `error`.

```ts
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
```

### Logging to stdout (default)

```ts
const prisma = new PrismaClient({
  log: [
    { emit: "stdout", level: "query" },
    { emit: "stdout", level: "error" },
    { emit: "stdout", level: "info" },
    { emit: "stdout", level: "warn" },
  ],
});
```

### Event-based logging with $on

Subscribe to log events programmatically:

```ts
const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
    { emit: "stdout", level: "info" },
    { emit: "stdout", level: "warn" },
  ],
});

prisma.$on("query", (e) => {
  console.log("Query: " + e.query);
  console.log("Params: " + e.params);
  console.log("Duration: " + e.duration + "ms");
});
```

Example output:

```
Query: SELECT "public"."User"."id", ... FROM "public"."User" WHERE 1=1 OFFSET $1
Params: [0]
Duration: 3ms
```

You can also use the `DEBUG` environment variable for lower-level debugging output.

## Error Handling

### Error types

| Error class                          | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `Prisma.PrismaClientKnownRequestError`   | Known error with an error code (e.g. constraint violation) |
| `Prisma.PrismaClientUnknownRequestError` | Unknown database error                           |
| `Prisma.PrismaClientValidationError`     | Validation error (invalid query arguments)       |

### Common error codes

| Code   | Meaning                                            |
| ------ | -------------------------------------------------- |
| `P2002` | Unique constraint violation                        |
| `P2025` | Record not found (for update/delete)               |
| `P2003` | Foreign key constraint violation                   |
| `P2014` | Relation violation                                 |
| `P2000` | Value too long for column                          |
| `P2001` | Record searched for in where condition does not exist |

### Catch patterns

```ts
import { Prisma, PrismaClient } from "./generated/prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.user.create({
    data: { email: "existing@mail.com" },
  });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      console.log("Unique constraint violated on:", e.meta?.target);
    }
    if (e.code === "P2025") {
      console.log("Record not found");
    }
    if (e.code === "P2003") {
      console.log("Foreign key constraint failed on:", e.meta?.field_name);
    }
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    console.log("Invalid query:", e.message);
  }
  throw e;
}
```

### Upsert pattern to avoid P2002

```ts
const user = await prisma.user.upsert({
  where: { email: "alice@prisma.io" },
  update: { name: "Alice Updated" },
  create: { email: "alice@prisma.io", name: "Alice" },
});
```

## Unit Testing

Mock Prisma Client to test business logic without a database.

### Singleton mock pattern (Jest)

1. Create the client module:

```ts
// client.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

2. Create a singleton mock:

```ts
// singleton.ts
import { PrismaClient } from "./generated/prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";
import { prisma } from "./client";

jest.mock("./client", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
```

3. Configure Jest:

```js
// jest.config.js
module.exports = {
  clearMocks: true,
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/singleton.ts"],
};
```

4. Write tests:

```ts
import { createUser } from "../functions";
import { prismaMock } from "../singleton";

test("should create new user", async () => {
  const user = {
    id: 1,
    name: "Alice",
    email: "alice@prisma.io",
    acceptTermsAndConditions: true,
  };

  prismaMock.user.create.mockResolvedValue(user);

  await expect(createUser(user)).resolves.toEqual({
    id: 1,
    name: "Alice",
    email: "alice@prisma.io",
    acceptTermsAndConditions: true,
  });
});
```

### Dependency injection pattern

```ts
// context.ts
import { PrismaClient } from "./generated/prisma/client";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";

export type Context = { prisma: PrismaClient };
export type MockContext = { prisma: DeepMockProxy<PrismaClient> };

export const createMockContext = (): MockContext => ({
  prisma: mockDeep<PrismaClient>(),
});
```

```ts
// test
import { MockContext, Context, createMockContext } from "../context";

let mockCtx: MockContext;
let ctx: Context;

beforeEach(() => {
  mockCtx = createMockContext();
  ctx = mockCtx as unknown as Context;
});

test("should create user", async () => {
  const user = { id: 1, name: "Alice", email: "alice@prisma.io", acceptTermsAndConditions: true };
  mockCtx.prisma.user.create.mockResolvedValue(user);

  await expect(createUser(user, ctx)).resolves.toEqual(user);
});
```

## Integration Testing

Test against a real database. Use Docker for an isolated environment.

### Docker Compose setup

```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    image: postgres:13
    restart: always
    container_name: integration-tests-prisma
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: prisma
      POSTGRES_PASSWORD: prisma
      POSTGRES_DB: tests
```

```env
# .env.test
DATABASE_URL="postgresql://prisma:prisma@localhost:5433/tests"
```

### Test lifecycle pattern

```ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  // Seed test data
  await prisma.user.create({
    data: { email: "test@example.com", name: "Test User" },
  });
});

afterAll(async () => {
  // Clean up in correct order (respect FK constraints)
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

test("creates a user", async () => {
  const user = await prisma.user.create({
    data: { email: "new@example.com", name: "New User" },
  });
  expect(user.email).toBe("new@example.com");
});
```

### Test scripts

```json
{
  "scripts": {
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "test": "docker compose up -d && prisma migrate deploy && jest -i"
  }
}
```

Flow: start container -> apply migrations -> run tests -> `docker compose down` when done.

## Deployment

### General checklist

1. **Generate client in build step**: `prisma generate` (add to build script)
2. **Apply migrations in CI/CD**: `prisma migrate deploy` (non-interactive, safe for production)
3. **Set environment variables**: `DATABASE_URL` (and `DIRECT_URL` if using a pooler)

```yaml
# .github/workflows/deploy.yml
- name: Generate Prisma Client
  run: npx prisma generate

- name: Apply migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Migration commands

| Command                | Use case                                    |
| ---------------------- | ------------------------------------------- |
| `prisma migrate dev`    | Development only (can prompt to reset DB)   |
| `prisma migrate deploy` | Production (applies pending migrations)     |
| `prisma db push`        | Quick prototyping only (can be destructive) |

> **Never** use `migrate dev` or `db push` in production.

### Deployment paradigms

- **Traditional servers** (Heroku, VMs, Docker): Long-running process, one PrismaClient instance, no `$disconnect()`.
- **Serverless** (Lambda, Vercel Functions): Instantiate outside handler, small pool sizes, consider external pooler.
- **Edge** (Cloudflare Workers, Vercel Edge): Requires driver adapter + edge import path.

## Edge Runtimes

Edge functions run in V8 isolates (not Node.js). Prisma requires:

1. **Import from `/edge` path**:

```ts
import { PrismaClient } from "./generated/prisma/edge";
```

2. **Use a compatible driver adapter**:

| Driver                   | Cloudflare Workers | Vercel Edge |
| ------------------------ | ------------------ | ----------- |
| `@prisma/adapter-pg`    | Yes (via `connect()`) | No       |
| Neon Serverless          | Yes                | Yes         |
| PlanetScale Serverless   | Yes                | Yes         |
| `@libsql/client` (Turso) | Yes               | Yes         |
| Prisma Postgres          | Yes                | Yes         |

3. **Example (Cloudflare Workers with pg)**:

```ts
import { PrismaClient } from "./generated/prisma/edge";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
```

> **Recommendation**: Prisma Postgres works on all edge runtimes without a specialized driver.

## Custom Model and Field Names

Use `@map` (field) and `@@map` (model) to decouple Prisma model names from database table/column names.

### Mapping table and column names

```prisma
model User {
  id    Int     @id @default(autoincrement()) @map("user_id")
  name  String? @db.VarChar(256)
  email String  @unique @db.VarChar(256)
  posts Post[]

  @@map("users")  // maps to "users" table
}

model Post {
  id        Int       @id @default(autoincrement()) @map("post_id")
  createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)
  title     String    @db.VarChar(256)
  content   String?
  authorId  Int?      @map("author_id")
  author    User?     @relation(fields: [authorId], references: [id])

  @@map("posts")  // maps to "posts" table
}
```

### Result in Prisma Client API

```ts
// PascalCase models, camelCase fields -- clean API
const user = await prisma.user.create({
  data: {
    name: "Alice",
    email: "alice@prisma.io",
  },
});

// Underlying SQL uses snake_case table/column names
```

### Renaming relation fields

Virtual relation fields exist only in the schema (not in DB). Rename freely:

```prisma
model User {
  id             Int    @id @default(autoincrement())
  writtenPosts   Post[] @relation("PostAuthor")
  favoritedPosts Post[] @relation("PostFavorite")
}
```

> `prisma db pull` preserves `@map`/`@@map` and custom relation field names on re-introspection.

## Best Practices

### Single PrismaClient instance

Create one global instance. Multiple instances = multiple connection pools = exhausted connections.

```ts
// lib/prisma.ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

### Do not $disconnect() in long-running apps

Opening new connections is expensive. Keep the pool open for the lifetime of the server.

### Prefer Prisma query API over raw SQL

Use raw SQL only when Prisma's API cannot express your query or for heavily optimized queries.

### Prevent N+1 queries

```ts
// BAD: N+1
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
}

// GOOD: single query
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

### Select only needed fields

```ts
const user = await prisma.user.findFirst({
  select: { id: true, email: true },
});
```

### Use omit for sensitive data

```ts
const prisma = new PrismaClient({
  adapter,
  omit: {
    user: { password: true },
  },
});
```

### Input validation before database calls

```ts
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

async function createUser(input: unknown) {
  const data = createUserSchema.parse(input);
  return prisma.user.create({ data });
}
```

### Index strategy

Index fields used in `where`, `orderBy`, and relation scalar fields:

```prisma
model Comment {
  id     Int    @id @default(autoincrement())
  postId Int
  status String
  post   Post   @relation(fields: [postId], references: [id])

  @@index([postId])
  @@index([status])
}
```

### Use enums for finite value sets

```prisma
enum Role {
  USER  @map("user")
  ADMIN @map("admin")

  @@map("user_role")
}

model User {
  id   Int  @id @default(autoincrement())
  role Role @default(USER)
}
```

### Pagination

```ts
// Offset-based (small datasets)
const posts = await prisma.post.findMany({ skip: 40, take: 10 });

// Cursor-based (large datasets, better performance)
const posts = await prisma.post.findMany({
  take: 10,
  skip: 1,
  cursor: { id: lastPostId },
  orderBy: { id: "asc" },
});
```
