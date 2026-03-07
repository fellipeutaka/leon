---
name: paraglide-js
description: Implement internationalization (i18n) with Paraglide JS — a compiler-based i18n library that compiles translation files into tree-shakable JavaScript functions. Use when working with Paraglide JS, @inlang/paraglide-js, or any i18n task involving compiled message functions, locale strategies, i18n routing, or multilingual rendering. Covers setup, message compilation, locale detection strategies, URL-based i18n routing, SSR/SSG middleware, variants (pluralization/gendering), formatting, markup, and integration with any framework (React, Vue, Svelte, Solid, Next.js, SvelteKit, Astro, etc.).
---

# Paraglide JS

Compiler-based i18n library. Compiles translation files (JSON/inlang) into tree-shakable JS functions. Each message becomes a function — only used messages are bundled.

## Architecture

```
messages/          ← Translation source files (JSON)
  en.json
  de.json
project.inlang/
  settings.json    ← Inlang project config (locales, plugins, sourceLanguageTag)
src/paraglide/     ← Compiler output (generated, gitignored)
  messages.js      ← Compiled message functions
  runtime.js       ← getLocale(), setLocale(), locales, sourceLocale
  server.js        ← paraglideMiddleware() for SSR
```

Compiler runs via bundler plugin (Vite/Webpack/Rollup) or CLI. Output is always `./src/paraglide/`.

## Core Usage

### Message Functions

```ts
import * as m from "./paraglide/messages.js";

// Simple message — no params
m.hello_world();  // "Hello World"

// Parameterized message
m.greeting({ name: "Alice" });  // "Hello, Alice!"
```

Messages are defined in JSON translation files:

```json
// messages/en.json
{
  "hello_world": "Hello World",
  "greeting": "Hello, {name}!"
}
```

### Runtime

```ts
import { getLocale, setLocale, locales, sourceLocale } from "./paraglide/runtime.js";

getLocale();        // Current locale, e.g. "en"
setLocale("de");    // Change locale (triggers re-render in frameworks)
locales;            // ["en", "de", "fr"] — all configured locales
sourceLocale;       // "en" — the source language
```

Message functions automatically use `getLocale()`. Override per-call:

```ts
m.greeting({ name: "Alice" }, { locale: "de" });  // Force German
```

### Overriding `getLocale` (Critical for SSR)

`getLocale` and `setLocale` must be overridden in the inlang project settings for any real app. The default is a simple global variable — not suitable for SSR (concurrent requests share state).

```json
// project.inlang/settings.json
{
  "baseLocale": "en",
  "locales": ["en", "de", "fr"],
  "plugin": "https://cdn.jsdelivr.net/npm/@inlang/paraglide-js@2/dist/plugin.js",
  "$imports": {
    "default": "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@latest/dist/index.js"
  }
}
```

Override via `compilerOptions.emitGitIgnore`, `compilerOptions.outputStructure`, etc. in settings.

For SSR, use `paraglideMiddleware()` which handles request-scoped locale via AsyncLocalStorage. See [references/rendering.md](references/rendering.md).

## Strategy (Locale Detection)

Strategy is an ordered fallback chain that determines the locale. Configure via compiler options.

```ts
import { defineCompilerOptions } from "@inlang/paraglide-js";

export default defineCompilerOptions({
  strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
  urlPatterns: [{ pattern: "/:locale(en|de|fr)/:path*" }],
  cookieName: "NEXT_LOCALE",
});
```

Common strategies: `url`, `cookie`, `preferredLanguage`, `globalVariable`, `localStorage`, `baseLocale`.

For full strategy configuration, URL patterns, custom strategies, and middleware setup, see [references/routing-and-strategy.md](references/routing-and-strategy.md).

## Key Integration Patterns

### Bundler Plugin (Recommended)

```ts
// vite.config.ts
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  plugins: [paraglideVitePlugin()],
});
```

Also available: `paraglideWebpackPlugin()`, `paraglideRollupPlugin()`, `paraglideRolldownPlugin()`.

For full setup, CLI compilation, and TypeScript config, see [references/setup.md](references/setup.md).

### SSR Middleware

```ts
import { paraglideMiddleware } from "./paraglide/server.js";

app.use((req, res, next) => {
  paraglideMiddleware(req, ({ request, locale }) => {
    // locale is detected, getLocale() works in this scope
    return next();
  });
});
```

For SSR, SSG, page discovery, and hreflang, see [references/rendering.md](references/rendering.md).

## Reference Files

Read these as needed based on the task:

- **[references/setup.md](references/setup.md)** — Installation, bundler plugins, CLI/programmatic compilation, TypeScript config, translation file formats, inlang project settings
- **[references/routing-and-strategy.md](references/routing-and-strategy.md)** — Strategy configuration, URL patterns, custom strategies, middleware for all frameworks (Next.js, SvelteKit, Astro, Express, Hono, etc.), client-side redirects
- **[references/rendering.md](references/rendering.md)** — SSR with paraglideMiddleware, SSG page discovery, setting locale for static pages, hreflang SEO tags
- **[references/advanced.md](references/advanced.md)** — Variants (pluralization/gendering), number/date formatting, rich text markup, message keys, objects/arrays, multi-tenancy, monorepo setup, common errors
