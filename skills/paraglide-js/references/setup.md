# Setup & Compilation

## Table of Contents

- [Installation](#installation)
- [Compiling Messages](#compiling-messages)
- [Bundler Plugins](#bundler-plugins)
- [CLI Compilation](#cli-compilation)
- [Programmatic Compilation](#programmatic-compilation)
- [TypeScript Configuration](#typescript-configuration)
- [Generated Output](#generated-output)
- [Translation File Formats](#translation-file-formats)
- [Inlang Project Settings](#inlang-project-settings)

## Installation

```bash
npx @inlang/paraglide-js@latest init
```

Creates `project.inlang/settings.json`, example message files, and installs dependencies.

## Compiling Messages

Three methods (bundler plugins recommended):

### Bundler Plugins

All plugins exported from `@inlang/paraglide-js`:

```ts
import {
  paraglideVitePlugin,
  paraglideWebpackPlugin,
  paraglideRollupPlugin,
  paraglideRspackPlugin,
  paraglideRolldownPlugin,
  paraglideEsbuildPlugin,
} from "@inlang/paraglide-js";
```

#### Vite (recommended)

```ts
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
  ],
});
```

#### Webpack

```js
const { paraglideWebpackPlugin } = require("@inlang/paraglide-js");

module.exports = {
  plugins: [
    paraglideWebpackPlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
  ],
};
```

#### Rollup

```js
import { paraglideRollupPlugin } from "@inlang/paraglide-js";

export default {
  plugins: [
    paraglideRollupPlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
  ],
};
```

### CLI Compilation

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
```

Watch mode:

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide --watch
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "build": "paraglide-js compile --project ./project.inlang --outdir ./src/paraglide && your-build-command",
    "dev": "paraglide-js compile --project ./project.inlang --outdir ./src/paraglide && your-dev-command"
  }
}
```

### Programmatic Compilation

```ts
import { compile } from "@inlang/paraglide-js";

await compile({
  project: "./project.inlang",
  outdir: "./src/paraglide",
});
```

Lower-level API with `@inlang/sdk`:

```ts
import { compileProject } from "@inlang/paraglide-js";
import { loadProjectFromDirectory } from "@inlang/sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const inlangProject = await loadProjectFromDirectory({ path: "./project.inlang" });
const output = await compileProject({ project: inlangProject });

const outdir = "./custom/paraglide";
await mkdir(outdir, { recursive: true });
for (const [filename, content] of Object.entries(output)) {
  await writeFile(join(outdir, filename), content);
}
```

## TypeScript Configuration

Paraglide compiles to JS with JSDoc annotations. Enable in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "allowJs": true
  }
}
```

For projects that can't use `allowJs` (e.g., libraries), emit `.d.ts` declarations:

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide --emitTsDeclarations
```

Or via plugin:

```ts
paraglideVitePlugin({
  project: "./project.inlang",
  outdir: "./src/paraglide",
  emitTsDeclarations: true,
});
```

## Generated Output

```
paraglide/
  messages/
    hello_world/
      index.js
      en.js
      de.js
  messages.js     # Import message functions
  runtime.js      # getLocale(), setLocale(), locales, baseLocale
  server.js       # paraglideMiddleware()
  .gitignore
```

Key imports:

| File | Purpose |
|------|---------|
| `messages.js` | `import { m } from "./paraglide/messages.js"` |
| `runtime.js` | `getLocale()`, `setLocale()`, `locales`, `baseLocale`, `localizeHref()` |
| `server.js` | `paraglideMiddleware()` |

## Translation File Formats

Paraglide works with any format via inlang plugins.

| Plugin | Best For | File Format |
|--------|----------|-------------|
| Inlang Message Format | New projects | `messages/{locale}.json` |
| i18next | Migrating from i18next | `locales/{locale}.json` |
| JSON | Simple key-value | `{locale}.json` |

### Inlang Message Format example

```json
{
  "greeting": "Hello {name}!",
  "items_count": "{count, plural, one {# item} other {# items}}"
}
```

### Installing a plugin

In `project.inlang/settings.json`:

```json
{
  "baseLocale": "en",
  "locales": ["en", "de"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ]
}
```

Multiple plugins can be used simultaneously (useful for migrations).

## Inlang Project Settings

`project.inlang/settings.json`:

```json
{
  "baseLocale": "en",
  "locales": ["en", "de", "fr"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ]
}
```

- `baseLocale`: Default/source locale
- `locales`: All supported locales
- `modules`: Plugin URLs for message format handling
