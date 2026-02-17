# Setup

## Table of Contents
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Server Config](#server-config)
- [Client Config](#client-config)
- [Route Handlers](#route-handlers)
- [Database Adapters](#database-adapters)
- [Core Schema](#core-schema)
- [CLI](#cli)
- [Secondary Storage](#secondary-storage)

## Installation

```bash
npm install better-auth  # or bun add / pnpm add
```

## Environment Variables

```env
BETTER_AUTH_SECRET=<32+ chars, generate: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000    # production: https://yourdomain.com
DATABASE_URL=<connection string>
```

Better Auth looks for the secret in this order:
1. `options.secret` in config
2. `BETTER_AUTH_SECRET` env var
3. `AUTH_SECRET` env var

Secret validation in production:
- Rejects default/placeholder secrets
- Warns if shorter than 32 characters
- Warns if entropy is below 120 bits

Only define `baseURL`/`secret` in config if env vars are NOT set.

## Server Config

Location: `lib/auth.ts` or `src/lib/auth.ts` (CLI looks in `./`, `./lib`, `./utils`, or under `./src`; use `--config` for custom path).

### Minimal

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: { enabled: true },
});
```

### Standard

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({ to: user.email, subject: "Verify email", text: `Click: ${url}` });
    },
    sendOnSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [],
});

export type Session = typeof auth.$Infer.Session;
```

### Full Config Options

| Option | Notes |
|--------|-------|
| `appName` | Display name (used in 2FA issuer, emails) |
| `baseURL` | Only if `BETTER_AUTH_URL` not set |
| `basePath` | Default `/api/auth`. Set `/` for root |
| `secret` | Only if `BETTER_AUTH_SECRET` not set |
| `database` | Connection string or adapter instance |
| `secondaryStorage` | Redis/KV for sessions & rate limits |
| `emailAndPassword` | `{ enabled, requireEmailVerification, sendResetPassword, ... }` |
| `socialProviders` | `{ google: { clientId, clientSecret }, ... }` |
| `plugins` | Array of plugins |
| `trustedOrigins` | CSRF whitelist (array or async function) |
| `session` | `{ expiresIn, updateAge, freshAge, cookieCache }` |
| `account` | `{ accountLinking, encryptOAuthTokens }` |
| `user` | `{ additionalFields, changeEmail, deleteUser }` |
| `rateLimit` | `{ enabled, window, max, storage }` |
| `advanced` | `{ useSecureCookies, cookiePrefix, backgroundTasks, ... }` |
| `databaseHooks` | `{ user, session, account }` create/update/delete hooks |

## Client Config

Import by framework:

| Framework | Import |
|-----------|--------|
| React / Next.js | `better-auth/react` |
| Vue / Nuxt | `better-auth/vue` |
| Svelte / SvelteKit | `better-auth/svelte` |
| Solid / Solid Start | `better-auth/solid` |
| Vanilla JS | `better-auth/client` |

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", // optional if same origin
  plugins: [], // client plugins here
});
```

Key methods: `signUp.email()`, `signIn.email()`, `signIn.social()`, `signOut()`, `useSession()`, `getSession()`, `revokeSession()`, `revokeSessions()`.

For separate client/server projects: `createAuthClient<typeof auth>()`.

## Route Handlers

### Next.js App Router

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

Add `nextCookies()` plugin for RSC session access:

```ts
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  plugins: [nextCookies()],
});
```

### Express

```ts
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = express();
// IMPORTANT: no body parsing middleware before this
app.all("/api/auth/*splat", toNodeHandler(auth)); // Express v5: *splat, v4: *
```

### Hono

```ts
import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono();
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
```

### Elysia

```ts
import { Elysia } from "elysia";
import { auth } from "./auth";

const app = new Elysia().mount(auth.handler);
```

### SvelteKit

```ts
// src/hooks.server.ts
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";

export async function handle({ event, resolve }) {
  return svelteKitHandler({ event, resolve, auth });
}
```

### Astro

```ts
// src/pages/api/auth/[...all].ts
import { auth } from "../../../lib/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => auth.handler(ctx.request);
```

See [framework-integrations.md](framework-integrations.md) for Nuxt, React Router, Solid Start, TanStack Start, Expo, Cloudflare Workers, Electron, Fastify, NestJS.

## Database Adapters

### Direct Connection

```ts
// SQLite
import Database from "better-sqlite3";
const auth = betterAuth({ database: new Database("./sqlite.db") });

// PostgreSQL
import { Pool } from "pg";
const auth = betterAuth({ database: new Pool({ connectionString: process.env.DATABASE_URL }) });

// MySQL
import mysql from "mysql2/promise";
const auth = betterAuth({ database: await mysql.createPool(process.env.DATABASE_URL!) });

// Connection string (uses built-in Kysely)
const auth = betterAuth({ database: process.env.DATABASE_URL });
```

### ORM Adapters

```ts
// Prisma
import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "better-auth/adapters/prisma";

const auth = betterAuth({
  database: prismaAdapter(new PrismaClient(), { provider: "postgresql" }),
});

// Drizzle
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const auth = betterAuth({
  database: drizzleAdapter(drizzle(process.env.DATABASE_URL!), { provider: "pg" }),
});

// MongoDB
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);
const auth = betterAuth({
  database: mongodbAdapter(client.db()),
});
```

## Core Schema

| Table | Key Fields |
|-------|-----------|
| `user` | id, name, email, emailVerified, image, createdAt, updatedAt |
| `session` | id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt |
| `account` | id, userId, accountId, providerId, accessToken, refreshToken, expiresAt |
| `verification` | id, identifier, value, expiresAt, createdAt, updatedAt |

Plugins add their own tables (e.g., `twoFactor` adds fields to user, `organization` adds organization/member/invitation tables).

### Extending Schema

```ts
const auth = betterAuth({
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user" },
      plan: { type: "string", required: false },
    },
  },
});
```

### ID Generation

```ts
const auth = betterAuth({
  advanced: {
    database: {
      generateId: "uuid",  // "uuid" | "serial" | false | custom function
    },
  },
});
```

## CLI

```bash
npx @better-auth/cli@latest migrate                    # Apply schema directly (built-in Kysely adapter)
npx @better-auth/cli@latest generate                    # Generate schema file
npx @better-auth/cli@latest generate --output prisma/schema.prisma   # For Prisma
npx @better-auth/cli@latest generate --output src/db/auth-schema.ts  # For Drizzle
npx @better-auth/cli@latest mcp --cursor               # Add MCP to AI tools
```

Re-run after adding/changing plugins.

### Programmatic Migrations

For serverless/edge environments where CLI isn't available:

```ts
import { getMigrations } from "better-auth/db";

const { runMigrations } = await getMigrations(auth);
await runMigrations();
```

## Secondary Storage

For sessions and rate limiting (Redis, Upstash, etc.):

```ts
import { betterAuth } from "better-auth";
import { Redis } from "ioredis";

const redis = new Redis();

const auth = betterAuth({
  secondaryStorage: {
    get: async (key) => {
      const value = await redis.get(key);
      return value ? value : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => { await redis.del(key); },
  },
});
```

When `secondaryStorage` is configured:
- Sessions are stored there by default (not DB)
- Rate limiting uses it automatically
- Set `session.storeSessionInDatabase: true` to persist to both
