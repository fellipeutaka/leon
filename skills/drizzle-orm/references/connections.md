# Connection Setup by Provider

## Table of Contents
- [Bun SQL](#bun-sql)
- [PostgreSQL](#postgresql)
- [MySQL](#mysql)
- [SQLite](#sqlite)
- [Turso / LibSQL](#turso--libsql)
- [Neon](#neon)
- [Supabase](#supabase)
- [Vercel Postgres](#vercel-postgres)
- [Cloudflare D1](#cloudflare-d1)
- [PlanetScale](#planetscale)
- [AWS Data API](#aws-data-api)
- [Xata](#xata)
- [PGlite](#pglite)
- [Expo SQLite](#expo-sqlite)
- [OP SQLite](#op-sqlite)
- [Cloudflare Durable Objects](#cloudflare-durable-objects)
- [TiDB Serverless](#tidb-serverless)
- [PlanetScale Postgres](#planetscale-postgres)
- [SQLite Cloud](#sqlite-cloud)
- [Nile](#nile)
- [Effect Postgres](#effect-postgres)
- [Prisma Postgres](#prisma-postgres)
- [Drizzle HTTP Proxy](#drizzle-http-proxy)

## Bun SQL

Bun's built-in SQL module — native bindings for PostgreSQL, MySQL, and SQLite. No external dependencies needed.

```bash
bun add drizzle-orm
bun add -D drizzle-kit
```

### PostgreSQL (Bun SQL)

```ts
import { drizzle } from "drizzle-orm/bun-sql";

// URL string (reads DATABASE_URL by default)
const db = drizzle(process.env.DATABASE_URL!);

// With schema for relational queries
import * as schema from "./schema";
const db = drizzle(process.env.DATABASE_URL!, { schema });

// With custom Bun SQL client
import { SQL } from "bun";
const client = new SQL(process.env.DATABASE_URL!);
const db = drizzle({ client });

// With connection options
import { SQL } from "bun";
const client = new SQL({
  hostname: "localhost",
  port: 5432,
  database: "myapp",
  username: "dbuser",
  password: "secretpass",
  max: 20,               // connection pool size
  idleTimeout: 30,
  tls: true,
});
const db = drizzle({ client });
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Bun SQLite

```ts
import { drizzle } from "drizzle-orm/bun-sqlite";

// Default — creates/opens sqlite.db
const db = drizzle();

// With file path
const db = drizzle("sqlite.db");

// With custom client
import { Database } from "bun:sqlite";
const sqlite = new Database("sqlite.db");
const db = drizzle({ client: sqlite });
```

Bun SQLite supports **sync APIs** (unique to synchronous drivers):

```ts
const result = db.select().from(users).all();     // all rows
const result = db.select().from(users).get();     // first row
const result = db.select().from(users).values();  // raw value arrays
const result = db.select().from(users).run();     // execute without returning
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: "file:sqlite.db" },
});
```

## PostgreSQL

### node-postgres (pg)

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

```ts
import { drizzle } from "drizzle-orm/node-postgres";

// URL string (simplest)
const db = drizzle(process.env.DATABASE_URL!);

// With schema for relational queries
import * as schema from "./schema";
const db = drizzle(process.env.DATABASE_URL!, { schema });

// With pool config
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });
```

### postgres.js

```bash
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/postgres-js";

const db = drizzle(process.env.DATABASE_URL!);

// With custom client
import postgres from "postgres";
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client });
```

## MySQL

### mysql2

```bash
npm i drizzle-orm mysql2
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/mysql2";

// URL string
const db = drizzle(process.env.DATABASE_URL!);

// With pool
import mysql from "mysql2/promise";
const pool = mysql.createPool(process.env.DATABASE_URL!);
const db = drizzle({ client: pool });
```

## SQLite

### better-sqlite3

```bash
npm i drizzle-orm better-sqlite3
npm i -D drizzle-kit @types/better-sqlite3
```

```ts
import { drizzle } from "drizzle-orm/better-sqlite3";

const db = drizzle("sqlite.db");

// With custom client
import Database from "better-sqlite3";
const sqlite = new Database("sqlite.db");
const db = drizzle({ client: sqlite });
```

## Turso / LibSQL

```bash
npm i drizzle-orm @libsql/client
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/libsql";

// Remote Turso database
const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});

// Local file
const db = drizzle("file:local.db");

// Embedded replicas (local cache + remote sync)
import { createClient } from "@libsql/client";
const client = createClient({
  url: "file:local.db",
  syncUrl: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = drizzle({ client });
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

## Neon

### Neon Serverless (HTTP)

```bash
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/neon-http";

const db = drizzle(process.env.DATABASE_URL!);

// With custom client
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });
```

### Neon WebSocket (for transactions)

```ts
import { drizzle } from "drizzle-orm/neon-serverless";

const db = drizzle(process.env.DATABASE_URL!);

// With custom client
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

## Supabase

```bash
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/postgres-js";

// Use connection pooler URL (port 6543) for serverless
// Use direct connection URL (port 5432) for long-running servers
const db = drizzle(process.env.DATABASE_URL!);
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

## Vercel Postgres

```bash
npm i drizzle-orm @vercel/postgres
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/vercel-postgres";

const db = drizzle();  // auto-reads POSTGRES_URL env var

// Or explicit
import { sql } from "@vercel/postgres";
const db = drizzle({ client: sql });
```

## Cloudflare D1

```bash
npm i drizzle-orm
npm i -D drizzle-kit
```

```ts
// In Cloudflare Worker
import { drizzle } from "drizzle-orm/d1";

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB);  // D1 binding
    const users = await db.select().from(usersTable);
    return Response.json(users);
  },
};
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "my-d1-database",
  },
});
```

## PlanetScale

```bash
npm i drizzle-orm @planetscale/database
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/planetscale-serverless";

const db = drizzle(process.env.DATABASE_URL!);

// With custom client
import { Client } from "@planetscale/database";
const client = new Client({ url: process.env.DATABASE_URL });
const db = drizzle({ client });
```

drizzle.config.ts:
```ts
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

## AWS Data API

```bash
npm i drizzle-orm @aws-sdk/client-rds-data
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/aws-data-api/pg"; // or /mysql

const db = drizzle({
  database: process.env.DATABASE!,
  resourceArn: process.env.RESOURCE_ARN!,
  secretArn: process.env.SECRET_ARN!,
});
```

## Xata

```bash
npm i drizzle-orm @xata.io/client
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/xata-http";
import { getXataClient } from "./xata"; // generated by Xata CLI

const xata = getXataClient();
const db = drizzle(xata);
```

## PGlite

WASM Postgres — runs in browser, Node.js, and Bun. ~2.6mb gzipped, no dependencies.

```bash
npm i drizzle-orm @electric-sql/pglite
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/pglite";

// In-memory
const db = drizzle();

// Persistent (file system or directory)
const db = drizzle("path-to-dir");

// With PGlite config
const db = drizzle({ connection: { dataDir: "path-to-dir" } });

// With existing client
import { PGlite } from "@electric-sql/pglite";
const client = new PGlite();
const db = drizzle({ client });
```

## Expo SQLite

React Native / Expo with native SQLite, live queries, and bundled migrations.

```bash
npx expo install drizzle-orm expo-sqlite
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const expo = openDatabaseSync("db.db");
const db = drizzle(expo);
```

Live queries — auto re-render on data changes:

```ts
import { useLiveQuery, drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const expo = openDatabaseSync("db.db", { enableChangeListener: true });
const db = drizzle(expo);

const App = () => {
  const { data } = useLiveQuery(db.select().from(users));
  return <Text>{JSON.stringify(data)}</Text>;
};
```

Migrations with `useMigrations` hook:

```ts
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "./drizzle/migrations";

const { success, error } = useMigrations(db, migrations);
```

drizzle.config.ts — must set `driver: "expo"`:
```ts
export default defineConfig({
  dialect: "sqlite",
  driver: "expo",
  schema: "./db/schema.ts",
  out: "./drizzle",
});
```

Requires `babel-plugin-inline-import` and adding `.sql` to Metro `sourceExts`.

## OP SQLite

High-performance React Native SQLite (embeds latest SQLite).

```bash
npm i drizzle-orm @op-engineering/op-sqlite
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/op-sqlite";
import { open } from "@op-engineering/op-sqlite";

const opsqlite = open({ name: "myDB" });
const db = drizzle(opsqlite);
```

Same migration bundling approach as Expo SQLite (babel-plugin-inline-import + Metro config).

## Cloudflare Durable Objects

SQLite embedded within a Durable Object.

```bash
npm i drizzle-orm
npm i -D drizzle-kit
```

```ts
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { DurableObject } from "cloudflare:workers";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations";

export class MyDurableObject extends DurableObject {
  storage: DurableObjectStorage;
  db: DrizzleSqliteDODatabase<any>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.db = drizzle(this.storage);
    ctx.blockConcurrencyWhile(async () => {
      migrate(this.db, migrations);
    });
  }

  async select() {
    return this.db.select().from(usersTable);
  }
}
```

Requires `wrangler.toml` with `new_sqlite_classes` migration and `[[rules]]` for `.sql` files.

## TiDB Serverless

MySQL-compatible serverless DBaaS. Also works with `mysql2` driver directly.

```bash
npm i drizzle-orm @tidbcloud/serverless
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/tidb-serverless";

const db = drizzle({ connection: { url: process.env.TIDB_URL } });

// With existing client
import { connect } from "@tidbcloud/serverless";
const client = connect({ url: process.env.TIDB_URL });
const db = drizzle({ client });
```

## PlanetScale Postgres

PlanetScale also offers PostgreSQL (separate from their MySQL/Vitess product). Connect using `node-postgres` or `@neondatabase/serverless`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);
```

## SQLite Cloud

Managed distributed SQLite.

```bash
npm i drizzle-orm @sqlitecloud/drivers
npm i -D drizzle-kit
```

```ts
import { drizzle } from "drizzle-orm/sqlite-cloud";

const db = drizzle(process.env.SQLITE_CLOUD_CONNECTION_STRING);

// With existing client
import { Database } from "@sqlitecloud/drivers";
const client = new Database(process.env.SQLITE_CLOUD_CONNECTION_STRING!);
const db = drizzle({ client });
```

## Nile

Multi-tenant PostgreSQL. Uses standard PG drivers:

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

```ts
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.NILEDB_URL);
```

## Effect Postgres

Effect-native PostgreSQL integration (v1 beta+).

```bash
npm i drizzle-orm effect @effect/sql-pg pg
npm i -D drizzle-kit @types/pg
```

```ts
import * as PgDrizzle from "drizzle-orm/effect-postgres";

// Use PgDrizzle.makeWithDefaults() for quick setup
// Integrates with Effect's service pattern
```

## Prisma Postgres

Serverless PostgreSQL by Prisma. Connect using `node-postgres` or `postgres.js`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);
```

## Drizzle HTTP Proxy

Custom driver for HTTP-based DB access. Implement your own transport layer:

```ts
// PostgreSQL proxy
import { drizzle } from "drizzle-orm/pg-proxy";

const db = drizzle(async (sql, params, method) => {
  const rows = await fetch("/query", {
    method: "POST",
    body: JSON.stringify({ sql, params, method }),
  }).then((r) => r.json());
  return { rows };
});
```

```ts
// MySQL proxy
import { drizzle } from "drizzle-orm/mysql-proxy";

const db = drizzle(async (sql, params, method) => {
  const rows = await fetch("/query", {
    method: "POST",
    body: JSON.stringify({ sql, params, method }),
  }).then((r) => r.json());
  return { rows };
});
```

```ts
// SQLite proxy (with optional batch callback)
import { drizzle } from "drizzle-orm/sqlite-proxy";

const db = drizzle(
  async (sql, params, method) => {
    const rows = await fetch("/query", {
      method: "POST",
      body: JSON.stringify({ sql, params, method }),
    }).then((r) => r.json());
    return { rows };
  },
  // Optional batch callback
  async (queries) => {
    return await fetch("/batch", {
      method: "POST",
      body: JSON.stringify({ queries }),
    }).then((r) => r.json());
  }
);
```

Callback params: `sql` (query string), `params` (array), `method` (`"run" | "all" | "values" | "get"`).
Expected return: `{ rows: string[][] }` (or `{ rows: string[] }` for `method: "get"`).
