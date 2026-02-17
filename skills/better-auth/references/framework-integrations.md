# Framework Integrations

## Table of Contents
- [Next.js](#nextjs)
- [Nuxt](#nuxt)
- [SvelteKit](#sveltekit)
- [Astro](#astro)
- [React Router / Remix](#react-router--remix)
- [Solid Start](#solid-start)
- [Hono](#hono)
- [Express](#express)
- [Elysia](#elysia)
- [Fastify](#fastify)
- [Expo (React Native)](#expo-react-native)
- [Cloudflare Workers](#cloudflare-workers)
- [Electron](#electron)

## Next.js

### App Router

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Pages Router

```ts
// pages/api/auth/[...all].ts
import { auth } from "@/lib/auth";
import { toNodeHandler } from "better-auth/node";

export default toNodeHandler(auth);

export const config = { api: { bodyParser: false } };
```

### RSC / Server Actions

Add `nextCookies()` plugin for cookie access in server components:

```ts
// lib/auth.ts
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  plugins: [nextCookies()],
});
```

```ts
// Server component or server action
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
```

### Client

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

### Middleware

Better Auth recommends validating sessions per-page rather than centralized middleware. If you need middleware:

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const session = getSessionCookie(request, {
    cookiePrefix: "better-auth", // match your config
    useSecureCookies: process.env.NODE_ENV === "production",
  });
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
```

## Nuxt

### Handler

```ts
// server/api/auth/[...all].ts
import { auth } from "~/lib/auth";

export default defineEventHandler((event) => auth.handler(toWebRequest(event)));
```

### Client

```ts
import { createAuthClient } from "better-auth/vue";

export const authClient = createAuthClient();
```

### Middleware

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch);
  if (!session.value) return navigateTo("/sign-in");
});
```

### Server-Side Session

```ts
// server/api/protected.ts
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session) throw createError({ statusCode: 401 });
  return { user: session.user };
});
```

## SvelteKit

### Handler

```ts
// src/hooks.server.ts
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";

export async function handle({ event, resolve }) {
  return svelteKitHandler({ event, resolve, auth });
}
```

### Populate Locals

```ts
// src/hooks.server.ts
export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;
  return svelteKitHandler({ event, resolve, auth });
}
```

For cookie handling in form actions, add `sveltekitCookies` plugin:

```ts
import { sveltekitCookies } from "better-auth/svelte-kit";

export const auth = betterAuth({
  plugins: [sveltekitCookies()],
});
```

### Client

```ts
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient();
```

## Astro

### Handler

```ts
// src/pages/api/auth/[...all].ts
import { auth } from "../../../lib/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => auth.handler(ctx.request);
```

### Middleware

```ts
// src/middleware.ts
import { auth } from "./lib/auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = session?.user ?? null;
  context.locals.session = session?.session ?? null;
  return next();
});
```

### Client

Supports multiple frameworks via Astro islands: `better-auth/react`, `better-auth/vue`, `better-auth/svelte`, `better-auth/solid`, or `better-auth/client`.

## React Router / Remix

### Handler

```ts
// app/routes/api.auth.$.ts (React Router v7)
import { auth } from "../lib/auth.server";
import type { Route } from "./+types/api.auth.$";

export async function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return auth.handler(request);
}
```

### Client

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

## Solid Start

```ts
// src/routes/api/auth/*auth.ts
import { auth } from "~/lib/auth";
import { toSolidStartHandler } from "better-auth/solid-start";

export const { GET, POST } = toSolidStartHandler(auth);
```

Client: `createAuthClient` from `better-auth/solid`.

## Hono

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const app = new Hono();

app.use("/api/auth/**", cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
```

### Middleware (session injection)

```ts
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) { c.set("user", null); c.set("session", null); return next(); }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});
```

### Cloudflare Workers with Hono

For Cloudflare Workers, use programmatic migrations:

```ts
import { getMigrations } from "better-auth/db";

const { runMigrations } = await getMigrations(auth);
await runMigrations();
```

## Express

```ts
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// IMPORTANT: mount BEFORE body parsing middleware
app.all("/api/auth/*splat", toNodeHandler(auth)); // Express v5: *splat
// app.all("/api/auth/*", toNodeHandler(auth));    // Express v4: *

app.use(express.json()); // AFTER Better Auth handler

app.listen(3000);
```

### Server-Side Session

```ts
import { fromNodeHeaders } from "better-auth/node";

app.get("/api/protected", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: session.user });
});
```

## Elysia

```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./auth";

new Elysia()
  .use(cors({ origin: "http://localhost:3000", credentials: true }))
  .mount(auth.handler)
  .listen(3000);
```

### Auth Middleware (macro)

```ts
const betterAuthView = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ error }) {
        const session = await auth.api.getSession({ headers: this.request.headers });
        if (!session) return error(401);
        return { user: session.user, session: session.session };
      },
    },
  });

// Usage
app.use(betterAuthView)
  .get("/profile", ({ user }) => user, { auth: true });
```

## Fastify

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { auth } from "./auth";

const fastify = Fastify();

await fastify.register(cors, { origin: "http://localhost:3000", credentials: true });

fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) headers.append(key, value.toString());
    });

    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });

    const response = await auth.handler(req);
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    reply.send(response.body ? await response.text() : null);
  },
});

fastify.listen({ port: 3000 });
```

## Expo (React Native)

### Server Plugin

```ts
import { expo } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [expo()],
  trustedOrigins: ["myapp://"],  // custom scheme
});
```

### Client

```bash
npm install @better-auth/expo expo-secure-store
```

```ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://your-api.com",
  plugins: [
    expoClient({
      scheme: "myapp",
      storagePrefix: "myapp",
      storage: SecureStore,
    }),
  ],
});
```

### Metro Config

Enable package exports in `metro.config.js`:

```js
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
module.exports = config;
```

### Social Auth

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
});
```

### Making Authenticated Requests

```ts
const cookie = await authClient.getCookie();
const response = await fetch("https://your-api.com/api/protected", {
  headers: { cookie },
});
```

## Electron

Requires three components: server plugin, proxy client (web), and electron client.

```bash
npm install @better-auth/electron
```

### Server

```ts
import { electron } from "@better-auth/electron";

const auth = betterAuth({
  plugins: [electron()],
  trustedOrigins: ["com.example.app://"],
});
```

### Web Client (proxy)

```ts
import { electronProxyClient } from "@better-auth/electron/client";

const authClient = createAuthClient({
  plugins: [electronProxyClient({ protocol: "com.example.app" })],
});
```

### Electron Client

```ts
import { electronClient } from "@better-auth/electron";

const authClient = createAuthClient({
  baseURL: "https://your-auth-server.com",
  plugins: [
    electronClient({
      signInURL: "https://your-auth-server.com/sign-in",
      protocol: "com.example.app",
    }),
  ],
});

// main process
authClient.setupMain();
```

Preload script: `setupRenderer()` from `@better-auth/electron/preload`.

Uses deep linking with custom protocol scheme (reverse domain notation).
