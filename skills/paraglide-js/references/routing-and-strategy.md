# Routing, Strategy & Middleware

## Table of Contents

- [Strategy (Locale Detection)](#strategy-locale-detection)
- [Built-in Strategies](#built-in-strategies)
- [Common Strategy Patterns](#common-strategy-patterns)
- [Custom Strategies](#custom-strategies)
- [i18n Routing (URL Patterns)](#i18n-routing-url-patterns)
- [URL Pattern Examples](#url-pattern-examples)
- [Route-level Strategy Overrides](#route-level-strategy-overrides)
- [Middleware](#middleware)
- [Middleware Framework Examples](#middleware-framework-examples)
- [Client-side Redirects](#client-side-redirects)

## Strategy (Locale Detection)

Strategy is an ordered fallback chain. First strategy that returns a locale wins.

```ts
compile({
  project: "./project.inlang",
  outdir: "./src/paraglide",
  strategy: ["url", "cookie", "baseLocale"],
});
```

**Order matters**: strategies that always resolve (like `url` with wildcards or `baseLocale`) should be last, since they prevent later strategies from being evaluated.

## Built-in Strategies

| Strategy | Source | Notes |
|----------|--------|-------|
| `url` | URL pathname/domain via `urlPatterns` | Always resolves with default wildcard pattern |
| `cookie` | `PARAGLIDE_LOCALE` cookie | |
| `localStorage` | Browser localStorage | Client-only |
| `preferredLanguage` | `navigator.languages` / `Accept-Language` header | Tries exact match, then base language |
| `baseLocale` | Returns `baseLocale` from settings | Safety fallback |
| `globalVariable` | Global variable | Testing only |

## Common Strategy Patterns

URL as source of truth (default):

```js
strategy: ["url", "baseLocale"]
```

Prioritize user preferences:

```js
strategy: ["localStorage", "cookie", "url", "baseLocale"]
```

Auto-detect with persistent override:

```js
strategy: ["localStorage", "preferredLanguage", "url", "baseLocale"]
```

## Custom Strategies

Names must follow `custom-<name>` pattern. Define separately for client and server.

### Client-side

```js
import { defineCustomClientStrategy } from "./paraglide/runtime.js";

defineCustomClientStrategy("custom-sessionStorage", {
  getLocale: () => sessionStorage.getItem("locale") ?? undefined,
  setLocale: (locale) => sessionStorage.setItem("locale", locale),
});
```

- `getLocale` must be synchronous
- `setLocale` can be async

### Server-side

```js
import { defineCustomServerStrategy } from "./paraglide/runtime.js";

defineCustomServerStrategy("custom-header", {
  getLocale: (request) => request?.headers.get("X-Locale") ?? undefined,
});
```

- `getLocale` can be async (e.g., database lookup)
- Only needs `getLocale` (no `setLocale`)

### Using custom strategies

```ts
compile({
  strategy: ["custom-header", "url", "cookie", "baseLocale"],
});
```

### Legacy approach: overwriteGetLocale / overwriteSetLocale

```js
import { overwriteGetLocale, overwriteSetLocale } from "./paraglide/runtime.js";

overwriteGetLocale(() => document.documentElement.lang);
```

On server, use `AsyncLocalStorage` to avoid race conditions:

```js
import { overwriteGetLocale, baseLocale } from "./paraglide/runtime.js";
import { AsyncLocalStorage } from "node:async_hooks";

const localeStorage = new AsyncLocalStorage();
overwriteGetLocale(() => localeStorage.getStore() ?? baseLocale);

export function onRequest(request, next) {
  const locale = detectLocale(request);
  return localeStorage.run(locale, async () => await next());
}
```

## i18n Routing (URL Patterns)

URL patterns use the web standard [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API).

Each pattern has:
- `pattern`: Canonical route structure
- `localized`: Array of `[locale, localizedPath]` tuples

```js
{
  pattern: "/about",
  localized: [
    ["en", "/about"],
    ["de", "/ueber-uns"],
  ],
}
```

**Pattern order matters**: specific patterns before wildcards. Within `localized`, more specific patterns (with prefix) before generic ones.

### Default behavior (no urlPatterns)

Default wildcard `/:path(.*)?` matches any path. Unprefixed paths resolve to `baseLocale`.

## URL Pattern Examples

### Locale prefixing (base locale unprefixed)

```js
urlPatterns: [{
  pattern: "/:path(.*)?",
  localized: [
    ["de", "/de/:path(.*)?"],
    ["en", "/:path(.*)?"],
  ],
}]
```

### Prefix all locales (for SvelteKit, Next.js)

```js
urlPatterns: [
  {
    pattern: "/",
    localized: [["en", "/en"], ["fr", "/fr"]],
  },
  {
    pattern: "/:path(.*)?",
    localized: [
      ["en", "/en/:path(.*)?"],
      ["fr", "/fr/:path(.*)?"],
    ],
  },
]
```

### Translated pathnames

```js
urlPatterns: [
  {
    pattern: "/about",
    localized: [["en", "/about"], ["de", "/ueber-uns"]],
  },
  {
    pattern: "/products/:id",
    localized: [["en", "/products/:id"], ["de", "/produkte/:id"]],
  },
  {
    pattern: "/:path(.*)?",
    localized: [["en", "/:path(.*)?"], ["de", "/:path(.*)?"]],
  },
]
```

### Domain-based routing

```js
urlPatterns: [
  // Localhost (use prefixes)
  {
    pattern: "http://localhost::port?/:path(.*)?",
    localized: [
      ["en", "http://localhost::port?/en/:path(.*)?"],
      ["de", "http://localhost::port?/de/:path(.*)?"],
    ],
  },
  // Production (use subdomains)
  {
    pattern: "https://example.com/:path(.*)?",
    localized: [
      ["en", "https://example.com/:path(.*)?"],
      ["de", "https://de.example.com/:path(.*)?"],
    ],
  },
]
```

### Routes without locale prefix

```js
urlPatterns: [
  {
    pattern: "/dashboard/:path(.*)?",
    localized: [
      ["en", "/dashboard/:path(.*)?"],
      ["de", "/dashboard/:path(.*)?"],
    ],
  },
  {
    pattern: "/:path(.*)?",
    localized: [
      ["de", "/de/:path(.*)?"],
      ["en", "/:path(.*)?"],
    ],
  },
]
```

### Base path

```js
urlPatterns: [{
  pattern: "/{shop/}?:path(.*)?",
  localized: [
    ["en", "/{shop/}?en/:path(.*)?"],
    ["de", "/{shop/}?de/:path(.*)?"],
  ],
}]
```

### Making routes unavailable per locale

Map unsupported locales to 404:

```js
{
  pattern: "/specific-path",
  localized: [
    ["en", "/specific-path"],
    ["de", "/de/404"],
  ],
}
```

## Route-level Strategy Overrides

Override strategy per route with `routeStrategies`:

```ts
compile({
  strategy: ["url", "cookie", "baseLocale"],
  routeStrategies: [
    { match: "/dashboard/:path(.*)?", strategy: ["cookie", "baseLocale"] },
    { match: "/api/:path(.*)?", exclude: true },
  ],
});
```

- Matched in declaration order, first match wins
- `exclude: true` disables i18n middleware for matched routes

## Middleware

Only needed for SSR. Handles locale detection, URL delocalization, request isolation.

```ts
import { paraglideMiddleware } from './paraglide/server.js';

paraglideMiddleware(
  request: Request,
  resolve: (args: { request: Request, locale: Locale }) => Promise<Response>,
  callbacks?: { onRedirect?: (response: Response) => void }
): Promise<Response>
```

### Flow

1. **Locale detection** - Evaluate strategies in order
2. **Redirect check** - If URL doesn't match detected locale, 307 redirect (document requests only)
3. **URL delocalization** - `/de/about` -> `/about`
4. **AsyncLocalStorage** - Isolate locale per request
5. **Your handler** - `resolve()` callback runs

### AsyncLocalStorage

Prevents locale bleeding between concurrent requests. Disable only in environments with built-in request isolation (Cloudflare Workers, Vercel Edge):

```ts
paraglideVitePlugin({
  disableAsyncLocalStorage: true, // Use with caution
});
```

## Middleware Framework Examples

### SvelteKit

```ts
// src/hooks.server.ts
import { paraglideMiddleware } from "./paraglide/server.js";
export const handle = ({ event, resolve }) => {
  return paraglideMiddleware(event.request, ({ request, locale }) => {
    return resolve({ ...event, request });
  });
};
```

### Next.js (App Router)

```ts
// middleware.ts
import { paraglideMiddleware } from "./paraglide/server.js";
import { NextResponse } from "next/server";

export async function middleware(request: Request) {
  return paraglideMiddleware(request, async ({ request, locale }) => {
    return NextResponse.next();
  });
}
```

### Astro

```ts
// src/middleware.ts
import { paraglideMiddleware } from "./paraglide/server.js";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  return paraglideMiddleware(context.request, ({ request }) => next(request));
});
```

### Hono

```ts
import { Hono } from "hono";
import { paraglideMiddleware } from "./paraglide/server.js";

const app = new Hono();
app.use("*", async (c) => {
  return paraglideMiddleware(c.req.raw, async ({ request, locale }) => {
    return c.text(`Locale: ${locale}`);
  });
});
```

### Express (requires Web API conversion)

```ts
app.use(async (req, res, next) => {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const webRequest = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
  });
  await paraglideMiddleware(webRequest, async ({ locale }) => {
    req.locale = locale;
    return new Response();
  });
  next();
});
```

### Fastify

```ts
app.addHook('preHandler', async (req, reply) => {
  const url = `${req.protocol}://${req.hostname}${req.url}`;
  const webRequest = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
  });
  await paraglideMiddleware(webRequest, async ({ locale }) => {
    req.locale = locale;
    return new Response();
  });
});
```

### Elysia

```ts
const app = new Elysia()
  .derive(async ({ request }) => {
    let locale = 'en';
    await paraglideMiddleware(request, async ({ locale: l }) => {
      locale = l;
      return new Response();
    });
    return { locale };
  });
```

### TanStack Start

Pass original `req` (NOT modified `request`) to avoid redirect loops:

```ts
export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};
```

## Client-side Redirects

For SPAs without server middleware, use `shouldRedirect()`:

```ts
import { shouldRedirect } from "./paraglide/runtime.js";

const decision = await shouldRedirect({ url: window.location.href });
if (decision.shouldRedirect) {
  window.location.href = decision.redirectUrl.href;
}
```

TanStack Router:

```ts
import { redirect } from "@tanstack/router";
import { shouldRedirect } from "./paraglide/runtime.js";

export const beforeLoad = async ({ location }) => {
  const decision = await shouldRedirect({ url: location.href });
  if (decision.shouldRedirect) {
    throw redirect({ to: decision.redirectUrl.href });
  }
};
```
