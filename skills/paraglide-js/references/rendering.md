# Server-Side Rendering & Static Site Generation

## Table of Contents

- [Server-Side Rendering (SSR)](#server-side-rendering-ssr)
- [Static Site Generation (SSG)](#static-site-generation-ssg)
- [SSG Page Discovery](#ssg-page-discovery)
- [SSG Setting the Locale](#ssg-setting-the-locale)
- [SEO: Hreflang Tags](#seo-hreflang-tags)

## Server-Side Rendering (SSR)

Use `paraglideMiddleware()` for SSR. It handles locale detection, URL delocalization, and request isolation via AsyncLocalStorage.

```ts
import { paraglideMiddleware } from './paraglide/server.js';

app.get("*", async (request) => {
  return paraglideMiddleware(request, async ({ request, locale }) => {
    return new Response(html(request));
  });
});
```

### Locale context

AsyncLocalStorage preserves locale through async boundaries:

```ts
async function fetchUserData() {
  const locale = getLocale(); // Returns request-specific locale
  return fetch(`/api/users?lang=${locale}`);
}
```

### Hydration

Works automatically. Server sets locale, client reads from URL/cookie on hydration.

Ensure server and client use the same strategy configuration to avoid hydration mismatches.

### Streaming SSR (React 18, Solid)

Works because AsyncLocalStorage preserves context across stream chunks:

```ts
return paraglideMiddleware(request, async ({ request, locale }) => {
  const stream = await renderToReadableStream(<App />);
  return new Response(stream, {
    headers: { "Content-Type": "text/html" },
  });
});
```

## Static Site Generation (SSG)

SSG generates localized pages at build time. No `paraglideMiddleware()` - set locale programmatically.

- **`setLocale()`** - For synchronous builds (pages render one at a time)
- **`overwriteGetLocale()`** - For concurrent rendering (React) where multiple pages build simultaneously

SSG typically requires all locales to have URL prefixes (`/en/about`, `/de/about`).

### URL Configuration for SSG

```js
compile({
  strategy: ["url", "baseLocale"],
  urlPatterns: [{
    pattern: "/:path(.*)?",
    localized: [
      ["en", "/en/:path(.*)?"],
      ["de", "/de/:path(.*)?"],
    ],
  }],
});
```

## SSG Page Discovery

Use `generateStaticLocalizedUrls()`:

```ts
import { generateStaticLocalizedUrls } from "./paraglide/runtime.js";

const localizedUrls = generateStaticLocalizedUrls(["/", "/about", "/blog"]);
// ["/en/", "/de/", "/en/about", "/de/about", "/en/blog", "/de/blog"]
```

### SvelteKit (entries)

```ts
// src/routes/[locale]/+page.ts
import { locales } from "$paraglide/runtime.js";

export const prerender = true;
export function entries() {
  return locales.map((locale) => ({ locale }));
}
```

### Next.js (generateStaticParams)

```tsx
// app/[locale]/page.tsx
import { locales } from "@/paraglide/runtime.js";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
```

### Astro (getStaticPaths)

```ts
import { locales } from "../paraglide/runtime.js";

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}
```

### Invisible Anchor Tags (for crawlers)

```tsx
import { localizeHref, locales } from "@/paraglide/runtime.js";

function CrawlerLinks({ currentPath }) {
  return (
    <nav aria-hidden="true" style={{ display: "none" }}>
      {locales.map((locale) => (
        <a key={locale} href={localizeHref(currentPath, { locale })}>{locale}</a>
      ))}
    </nav>
  );
}
```

## SSG Setting the Locale

### Astro (Middleware)

```ts
import { defineMiddleware } from "astro:middleware";
import { setLocale, assertIsLocale } from "./paraglide/runtime.js";

export const onRequest = defineMiddleware((context, next) => {
  if (context.currentLocale) {
    setLocale(assertIsLocale(context.currentLocale));
  }
  return next();
});
```

### Next.js SSG

Use `overwriteGetLocale` with React's `cache`:

```tsx
// app/[locale]/layout.tsx
import { cache } from "react";
import { overwriteGetLocale, baseLocale, assertIsLocale, getLocale, getTextDirection } from "@/paraglide/runtime.js";

const ssrLocale = cache(() => ({ locale: baseLocale }));
overwriteGetLocale(() => assertIsLocale(ssrLocale().locale));

export default function RootLayout({ children, params }) {
  ssrLocale().locale = params.locale;
  return (
    <html lang={getLocale()} dir={getTextDirection()}>
      <body>{children}</body>
    </html>
  );
}
```

### SvelteKit

```ts
// src/routes/[locale]/+layout.ts
import { setLocale, assertIsLocale } from "$paraglide/runtime.js";

export function load({ params }) {
  setLocale(assertIsLocale(params.locale));
}
```

## SEO: Hreflang Tags

```tsx
import { localizeHref, locales, baseLocale } from "@/paraglide/runtime.js";

function HreflangTags({ currentPath }) {
  return (
    <>
      {locales.map((locale) => (
        <link key={locale} rel="alternate" hrefLang={locale} href={localizeHref(currentPath, { locale })} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={localizeHref(currentPath, { locale: baseLocale })} />
    </>
  );
}
```

ISR (Next.js) works the same way as SSG during regeneration.
