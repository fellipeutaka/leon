# Advanced Features

## Table of Contents

- [Variants (Pluralization, Gendering, etc.)](#variants)
- [Formatting (Numbers, Dates)](#formatting)
- [Markup (Rich Text)](#markup)
- [Message Keys](#message-keys)
- [Objects and Arrays](#objects-and-arrays)
- [Multi-Tenancy](#multi-tenancy)
- [Monorepo Setup](#monorepo-setup)
- [Common Errors](#common-errors)

## Variants

Variants enable pluralization, gendering, A/B testing via the inlang message format.

### Pluralization

```json
{
  "some_happy_cat": [{
    "declarations": ["input count", "local countPlural = count: plural"],
    "selectors": ["countPlural"],
    "match": {
      "countPlural=one": "There is one cat.",
      "countPlural=other": "There are many cats."
    }
  }]
}
```

Read `local countPlural = count: plural` as "create local variable `countPlural` = `plural(count)`".

### Ordinal pluralization (1st, 2nd, 3rd)

```json
{
  "finished_readout": [{
    "declarations": [
      "input placeNumber",
      "local ordinalCategory = placeNumber: plural type=ordinal"
    ],
    "selectors": ["ordinalCategory"],
    "match": {
      "ordinalCategory=one": "You finished in {placeNumber}st place",
      "ordinalCategory=two": "You finished in {placeNumber}nd place",
      "ordinalCategory=few": "You finished in {placeNumber}rd place",
      "ordinalCategory=*": "You finished in {placeNumber}th place"
    }
  }]
}
```

### Multi-selector matching

```json
{
  "jojo_mountain_day": [{
    "match": {
      "platform=android, userGender=male": "{username} has to download the app on his phone from the Google Play Store.",
      "platform=ios, userGender=female": "{username} has to download the app on her iPhone from the App Store.",
      "platform=*, userGender=*": "The person has to download the app."
    }
  }]
}
```

## Formatting

Built-in formatters (inlang message format plugin): `plural`, `number`, `datetime`.

### Number formatting

```json
{
  "personal_balance": [{
    "declarations": ["input amount", "local formattedAmount = amount: number"],
    "match": { "amount=*": "Your balance is {formattedAmount}." }
  }]
}
```

With options (forwarded to `Intl.NumberFormat`):

```json
{
  "price_in_usd": [{
    "declarations": [
      "input amount",
      "local formattedAmount = amount: number style=currency currency=USD"
    ],
    "match": { "amount=*": "Price: {formattedAmount}" }
  }]
}
```

### Date/time formatting

```json
{
  "purchase_date": [{
    "declarations": [
      "input date",
      "local formattedDate = date: datetime day=2-digit month=2-digit year=numeric"
    ],
    "match": { "date=*": "Purchase date: {formattedDate}." }
  }]
}
```

Options forwarded to `Intl.DateTimeFormat`. Use `timeZone=UTC` for stable output.

### Reactivity

Formatting runs when message functions are called. Locale change updates formatting:

```ts
setLocale("en");
m.personal_balance({ amount: 1000.57 }); // "Your balance is 1,000.57."
setLocale("de");
m.personal_balance({ amount: 1000.57 }); // "Your balance is 1.000,57."
```

## Markup

Markup lets translators control emphasis, links, inline UI placement. Messages return plain strings by default; `message.parts()` exposes structured parts.

### Message syntax

```json
{
  "cta": "{#link to=|/docs| @track}Read docs{/link}",
  "nested": "{#link to=|/docs|}{#strong}Read docs{/strong}{/link}"
}
```

- `link`, `strong` = tag names
- `to=|/docs|` = option (accessible as `options.to`)
- `@track` = boolean attribute (`attributes.track === true`)

### React (`@inlang/paraglide-js-react`)

```tsx
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { m } from "./paraglide/messages.js";

<ParaglideMessage
  message={m.cta}
  inputs={{}}
  markup={{
    link: ({ children, options, attributes }) => (
      <a href={options.to}>{children}</a>
    ),
  }}
/>
```

### Vue (`@inlang/paraglide-js-vue`)

```vue
<script setup lang="ts">
import { ParaglideMessage } from "@inlang/paraglide-js-vue";
import { h } from "vue";
import { m } from "./paraglide/messages.js";
const markup = { link: ({ children, options }) => h("a", { href: options.to }, children) };
</script>
<template>
  <ParaglideMessage :message="m.cta" :inputs="{}" :markup="markup" />
</template>
```

### Svelte (`@inlang/paraglide-js-svelte`)

```svelte
<script lang="ts">
  import { ParaglideMessage } from "@inlang/paraglide-js-svelte";
  import { m } from "./paraglide/messages.js";
</script>
<ParaglideMessage message={m.cta} inputs={{}}>
  {#snippet link({ children, options })}
    <a href={options.to}>{@render children?.()}</a>
  {/snippet}
</ParaglideMessage>
```

### Solid (`@inlang/paraglide-js-solid`)

```tsx
import { ParaglideMessage } from "@inlang/paraglide-js-solid";
import { m } from "./paraglide/messages.js";

<ParaglideMessage
  message={m.cta}
  inputs={{}}
  markup={{ link: ({ children, options }) => <a href={options.to}>{children}</a> }}
/>
```

### Low-level: `message.parts()`

```ts
const parts = m.cta.parts({});
// [
//   { type: "markup-start", name: "link", options: { to: "/docs" }, attributes: { track: true } },
//   { type: "text", value: "Read docs" },
//   { type: "markup-end", name: "link", options: { to: "/docs" }, attributes: { track: true } }
// ]
```

Part types: `text`, `markup-start`, `markup-end`, `markup-standalone`.

## Message Keys

Flat keys recommended. Nested keys supported via bracket notation.

```json
{ "nav_home": "Home" }
```

```ts
m.nav_home(); // Direct function call, tree-shakable, go-to-definition
```

Nested keys (if needed):

```json
{ "nav.home": "Home" }
```

```ts
m["nav.home"](); // Bracket notation
```

### Dynamic messages

Specify beforehand to preserve tree-shaking:

```ts
const messages = { greeting: m.greeting, goodbye: m.goodbye };
messages["greeting"]();
```

### Type-safe localized strings

```ts
import type { LocalizedString } from "./paraglide/runtime.js";

function PageTitle(props: { title: LocalizedString }) {
  return <h1>{props.title}</h1>;
}
<PageTitle title={m.welcome_title()} />  // OK
<PageTitle title="Welcome" />            // Type error
```

## Objects and Arrays

Store as JSON strings, parse at runtime:

```json
{ "features": "[\"Fast\", \"Secure\", \"Easy to use\"]" }
```

```ts
const features: string[] = JSON.parse(m.features());
```

Objects (escape braces with `\{` and `\}` in inlang-message-format):

```json
{ "pricing": "\\{\"basic\": \"$9/mo\", \"pro\": \"$29/mo\"\\}" }
```

```ts
const pricing = JSON.parse(m.pricing());
```

For items needing interpolation, use separate message keys:

```json
{ "step_0": "Welcome, {name}!", "step_1": "You have {count} items" }
```

```ts
const steps = [m.step_0({ name: "Alex" }), m.step_1({ count: 3 })];
```

## Multi-Tenancy

Different domains/tenants with different default locales:

```js
compile({
  strategy: ["url", "baseLocale"],
  urlPatterns: [
    {
      pattern: "https://customer1.fr/:path(.*)?",
      localized: [
        ["fr", "https://customer1.fr/:path(.*)?"],
        ["en", "https://customer1.fr/en/:path(.*)?"],
      ],
    },
    {
      pattern: "https://customer2.com/:path(.*)?",
      localized: [
        ["en", "https://customer2.com/:path(.*)?"],
        ["fr", "https://customer2.com/fr/:path(.*)?"],
      ],
    },
  ],
});
```

Disable locales per tenant by mapping to 404:

```js
["fr", "https://customer1.com/404"] // Unsupported locale -> 404
```

Tenant-specific locale switchers: filter `locales` based on current hostname.

## Monorepo Setup

### Pattern 1: Each package compiles (recommended)

One shared `project.inlang`, compile separately per package with different strategies:

```bash
# packages/web
npx @inlang/paraglide-js compile --project ../../project.inlang --outdir ./src/paraglide

# packages/mobile (different strategy)
npx @inlang/paraglide-js compile --project ../../project.inlang --outdir ./src/paraglide --strategy cookie,baseLocale
```

### Pattern 2: Shared i18n package

Compile once in a dedicated package, all consumers import from it. All must use same strategy.

```json
{
  "name": "@myorg/i18n",
  "scripts": {
    "build": "paraglide-js compile --project ./project.inlang --outdir ./src/paraglide --emit-ts-declarations"
  },
  "exports": {
    "./messages": "./src/paraglide/messages.js",
    "./runtime": "./src/paraglide/runtime.js"
  }
}
```

```ts
import * as m from "@myorg/i18n/messages";
import { getLocale } from "@myorg/i18n/runtime";
```

## Common Errors

### "No locale found"

1. Empty strategy array -> add strategies
2. `overwriteGetLocale()`/`overwriteSetLocale()` not called at app root
3. Using `url` strategy but calling messages outside request context -> use within `paraglideMiddleware` callback
4. API requests with only `strategy: ["url"]` -> add `cookie` or `baseLocale` (URL strategy only works for document requests via `Sec-Fetch-Dest: document`)

### Switching locales via links doesn't work

Use `setLocale()` instead. Client-side routing won't update UI with `localizeHref()` alone. Force reload:

```tsx
setLocale("de"); // Works
<a href={localizeHref("/page", { locale: "de" })}>Deutsch</a> // Won't work with client-side routing
```

### Redirect loops

Both middleware AND framework handling URL localization. Fix: pass original request to framework:

```ts
paraglideMiddleware(req, () => handler(req)); // Pass original req
```

### Locale bleeds between requests

AsyncLocalStorage disabled in multi-request environment. Keep it enabled (default).

### Wrong locale on first request

Normal during hydration. Ensure same strategy order on server and client.
