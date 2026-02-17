# Connections and Configuration

## Table of Contents

- [Prisma Config (prisma.config.ts)](#prisma-config)
- [PrismaClient Instantiation](#prismaclient-instantiation)
- [Driver Adapters (v7)](#driver-adapters-v7)
- [Connection Pool Configuration](#connection-pool-configuration)
- [Singleton Pattern](#singleton-pattern)
- [$connect and $disconnect Lifecycle](#connect-and-disconnect-lifecycle)
- [PgBouncer and Supavisor](#pgbouncer-and-supavisor)
- [External Connection Poolers (DATABASE_URL + DIRECT_URL)](#external-connection-poolers)
- [Serverless Considerations](#serverless-considerations)
- [Connection URL Formats](#connection-url-formats)

## Prisma Config

The `prisma.config.ts` file configures the datasource URL used by Prisma CLI commands (migrations, introspection, etc.):

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

The Prisma schema declares the provider and generator:

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

## PrismaClient Instantiation

Install dependencies:

```bash
npm install prisma --save-dev
npm install @prisma/client
```

Generate client code:

```bash
npx prisma generate
```

Import and create an instance:

```ts
// Node.js
import { PrismaClient } from "./generated/prisma/client";
const prisma = new PrismaClient();

// Edge runtimes
import { PrismaClient } from "./generated/prisma/edge";
const prisma = new PrismaClient();
```

Your application should create **one** instance of `PrismaClient`. Multiple instances create multiple connection pools and can exhaust your database connection limit.

## Driver Adapters (v7)

In Prisma v7, relational databases require a driver adapter. The adapter wraps the Node.js database driver you supply.

### PostgreSQL (@prisma/adapter-pg)

```ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

### MySQL / MariaDB (@prisma/adapter-mariadb)

```ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export const prisma = new PrismaClient({ adapter });
```

### SQL Server (@prisma/adapter-mssql)

```ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql({
  server: "localhost",
  port: 1433,
  database: "mydb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const prisma = new PrismaClient({ adapter });
```

### Edge (Prisma Postgres Serverless)

```ts
import { PrismaClient } from "./generated/prisma/edge";
import { PrismaPostgresAdapter } from "@prisma/adapter-ppg";

const adapter = new PrismaPostgresAdapter({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

## Connection Pool Configuration

In v7, pool settings are configured on the **driver adapter**, not via connection URL parameters. Defaults vary per adapter.

### PostgreSQL (pg adapter)

| Behavior            | v7 `pg` config field      | Default          |
| ------------------- | ------------------------- | ---------------- |
| Pool size           | `max`                     | `10`             |
| Acquire timeout     | `connectionTimeoutMillis` | `0` (no timeout) |
| Idle timeout        | `idleTimeoutMillis`       | `10000` (10s)    |
| Connection lifetime | `maxLifetimeSeconds`      | `0` (no timeout) |

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 300_000,
});
```

### MySQL / MariaDB (mariadb adapter)

| Behavior           | v7 `mariadb` config field | Default |
| ------------------ | ------------------------- | ------- |
| Pool size          | `connectionLimit`         | `10`    |
| Acquire timeout    | `acquireTimeout`          | `10s`   |
| Connection timeout | `connectTimeout`          | `1s`    |
| Idle timeout       | `idleTimeout`             | `1800s` |

```ts
const adapter = new PrismaMariaDb({
  host: "localhost",
  user: "root",
  database: "mydb",
  connectionLimit: 20,
  acquireTimeout: 10_000,
  connectTimeout: 5_000,
});
```

### SQL Server (mssql adapter)

| Behavior           | v7 `mssql` config field  | Default |
| ------------------ | ------------------------ | ------- |
| Pool size          | `pool.max`               | `10`    |
| Connection timeout | `connectionTimeout`      | `15s`   |
| Idle timeout       | `pool.idleTimeoutMillis` | `30s`   |

```ts
const adapter = new PrismaMssql({
  server: "localhost",
  database: "mydb",
  connectionTimeout: 5_000,
  pool: {
    max: 20,
    idleTimeoutMillis: 300_000,
  },
});
```

### MongoDB

MongoDB uses the MongoDB driver's own connection pool, configured via connection string parameters (e.g. `?maxPoolSize=10`).

## Singleton Pattern

### Hot-reload safe singleton (for Next.js / dev environments)

Frameworks with hot-reloading create new `PrismaClient` instances on every file change. Use `globalThis` to prevent this:

```ts
// lib/prisma.ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Usage stays the same:

```ts
import { prisma } from "./lib/prisma";

const users = await prisma.user.findMany();
```

### Simple singleton (non-hot-reload environments)

```ts
// client.ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

Node.js module caching ensures the same instance is reused across imports.

## $connect and $disconnect Lifecycle

`PrismaClient` connects lazily on the first query. Explicit calls are rarely needed.

```ts
// Explicit connect (for instant first-query response)
await prisma.$connect();

// Explicit disconnect (for scripts, not long-running apps)
await prisma.$disconnect();
```

### When to call $disconnect()

- **Long-running apps (servers, APIs)**: Do NOT call `$disconnect()`. Keep connections open.
- **Short-lived scripts (cron jobs, seed scripts)**: Call `$disconnect()` when done.
- **Serverless functions**: Do NOT call `$disconnect()` (container may be reused).
- **Cloudflare Workers**: Call `ctx.waitUntil(prisma.$disconnect())` to release resources.

### beforeExit hook

Run cleanup code before disconnection:

```ts
prisma.$on("beforeExit", async () => {
  await prisma.message.create({
    data: { message: "Shutting down server" },
  });
});
```

## PgBouncer and Supavisor

### PgBouncer configuration

1. Set PgBouncer to **transaction mode** (required for Prisma).
2. For PgBouncer < 1.21.0, add `?pgbouncer=true` to the connection URL:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?pgbouncer=true
```

For PgBouncer >= 1.21.0, the `pgbouncer=true` flag is NOT recommended.

3. Set `max_prepared_statements` > 0 in PgBouncer config to enable prepared statements.

### Supabase Supavisor

Same as PgBouncer. Add `?pgbouncer=true` to the pooled connection string from your Supabase database settings.

### Migrations with PgBouncer

Prisma Migrate does not work through PgBouncer. Use a direct connection for CLI commands:

```env
# .env
DATABASE_URL="postgres://USER:PASSWORD@HOST:6543/DATABASE?pgbouncer=true"
DIRECT_URL="postgres://USER:PASSWORD@HOST:5432/DATABASE"
```

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),  // CLI uses direct connection
  },
});
```

```ts
// src/db/client.ts -- runtime uses pooled connection
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL, // pooled
});
export const prisma = new PrismaClient({ adapter });
```

## External Connection Poolers

The `DATABASE_URL` + `DIRECT_URL` pattern separates runtime (pooled) from CLI (direct) connections:

```env
# Pooled connection for runtime (Prisma Client via driver adapter)
DATABASE_URL="postgres://USER:PASSWORD@pooler-host:6543/DATABASE?pgbouncer=true"

# Direct connection for CLI (prisma migrate, db push, etc.)
DIRECT_URL="postgres://USER:PASSWORD@db-host:5432/DATABASE"
```

- `prisma.config.ts` uses `DIRECT_URL` for all CLI commands.
- Driver adapter at runtime uses `DATABASE_URL`.

> **Note**: AWS RDS Proxy does NOT provide connection pooling benefits with Prisma Client due to connection pinning.

## Serverless Considerations

### Instantiate outside the handler

```ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Outside handler -- reused across warm invocations
const prisma = new PrismaClient({ adapter });

export async function handler(event) {
  const users = await prisma.user.findMany();
  return { statusCode: 200, body: JSON.stringify(users) };
}
```

### Key guidelines

- Use **small pool sizes** (e.g. `max: 2-5`) when not using an external pooler.
- Do NOT call `$disconnect()` at the end of the handler.
- Set serverless **concurrency limits** to avoid exceeding the database connection limit: `max_db_connections / (pool_size * concurrent_functions)`.
- Consider an external pooler (PgBouncer, Supavisor, Prisma Accelerate) for high-concurrency workloads.
- Each cold start creates a new connection pool. Idle containers ("zombie connections") keep connections open.

## Connection URL Formats

### PostgreSQL

```
postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

### MySQL

```
mysql://USER:PASSWORD@HOST:3306/DATABASE
```

### SQL Server

```
sqlserver://HOST:1433;initial catalog=DATABASE;user=USER;password=PASSWORD;
```

### SQLite

```
file:./dev.db
```

### CockroachDB

```
postgresql://USER:PASSWORD@HOST:26257/DATABASE?schema=public
```

### Prisma Postgres (direct TCP)

```
postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require
```

### Special characters

For PostgreSQL, MySQL, and CockroachDB, percentage-encode special characters in connection URLs. Example: `p@$$w0rd` becomes `p%40%24%24w0rd`.
