---
name: nuqs
description: >
  Implement, review, debug, or test type-safe URL query state with nuqs 2.x.
  Use when selecting a NuqsAdapter, choosing parsers and
  useQueryState/useQueryStates, defining URL update semantics, sharing state
  with server loaders or caches, serializing links, or testing query state in
  Next.js, React, Remix, React Router, or TanStack Router.
---

# Build and review query state with nuqs

Treat the URL as the state contract. Follow the steps in order, and load only
the reference branches whose conditions match the application.

## 1. Model the URL contract

For every query key, record:

- its URL spelling and domain type;
- the value to use when the key is absent or invalid;
- whether setting the default should remove the key;
- whether an update represents navigation or ephemeral UI state;
- which client components, loaders, routes, or server components read it.

Inspect the installed `nuqs`, framework, and router major versions before
choosing integration paths.

Read the matching branch references:

- **Adapter branch:** [select and mount the matching adapter](references/setup-adapter.md)
  when installing nuqs, changing routers, or reviewing the provider boundary.
- **URL-key branch:** [define shorter external key names](references/advanced-url-keys.md)
  when domain property names should differ from URL keys.
- **Provider-policy branch:** [configure adapter defaults and URL middleware](references/advanced-adapter-props.md)
  when update policy or URL processing belongs at the application boundary.

Complete when every query key has one documented URL representation and the
adapter import and provider boundary match the installed router.

## 2. Define one parser contract

Put related parsers in a dependency-neutral module. Import parsers from
`nuqs/server` when any server-side consumer imports that module; client hooks
can reuse the exported parser object.

Prefer built-ins that match the wire format. Use `.withDefault(value)` only
when absent and invalid values should resolve to a non-null domain default.
Defaults stay internal unless explicitly written; setting state to `null`
removes the query key.

```ts
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParams = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(["relevance", "date"] as const).withDefault(
    "relevance",
  ),
};
```

Create a custom parser only for a wire format that built-ins cannot express.
Its parse function returns `null` for invalid input, and parsing and
serialization form a pure, lossless round trip for every valid value.

Read the matching branch references:

- **Scalar branch:** choose [typed parsers](references/parser-typed.md),
  [non-null defaults](references/parser-with-default.md), or
  [literal and enum parsers](references/parser-enum-literals.md) from the domain
  type and absent-value policy.
- **Collection branch:** choose the [array wire format](references/parser-array-format.md)
  or [runtime-validated JSON](references/parser-json-validation.md) from the URL
  contract.
- **Special-format branch:** use the documented [date](references/parser-date-format.md),
  [one-based index](references/parser-index-offset.md), or
  [hex color](references/parser-hex-colors.md) representation when the domain
  requires it.
- **Custom-parser branch:** follow the [custom parser contract](references/parser-custom.md)
  and provide [object equality](references/advanced-eq-function.md) when value
  equality is not referential.
- **Shared-module branch:** [share one parser map](references/setup-shared-parsers.md)
  and use [server-safe imports](references/setup-server-imports.md) when both
  client and server code consume it.
- **Schema branch:** expose a [Standard Schema validator](references/advanced-standard-schema.md)
  when a router or validation library needs the same contract.

Complete when every key has exactly one parser, nullability follows its
default policy, invalid input has an explicit outcome, and all consumers import
the same parser definition.

## 3. Bind the contract to client state

Use `useQueryState` for one independent key. Use `useQueryStates` when keys form
one state object or must update atomically. Keep the URL-backed value as the
source of truth; isolate any temporary input draft and define when it commits
back to the URL. Client hook modules carry the `'use client'` directive where
the framework requires it.

Choose update semantics deliberately:

- Keep the default `history: 'replace'` for ephemeral state. Use `'push'` when
  each change should become a Back-button navigation point.
- Keep shallow client-first updates when the server does not need the new
  value. Use `shallow: false` only when an update must rerun a server component
  or route loader.
- Enable `scroll` only for navigation that should move the viewport.
- Keep the default `clearOnDefault: true` for canonical URLs. Set it to `false`
  only when the URL must preserve an explicitly written default value.
- Use `limitUrlUpdates: throttle(ms)` to bound repeated URL or server updates.
  Use `debounce(ms)` for server-side fetching after the user pauses; debounce
  the hook value separately for client-side fetching.
- Resolve option conflicts by precedence: setter call, parser, then hook-level
  options.

Read the matching branch references:

- **Hook branch:** load the [client directive rule](references/setup-client-hooks.md)
  or [grouped-state pattern](references/state-use-query-states.md) when the
  component boundary or key relationship requires it.
- **Update branch:** use [functional updates](references/state-functional-updates.md),
  [clear with `null`](references/state-clear-with-null.md), and the
  [setter return value](references/state-setter-return.md) for derived or
  coordinated writes.
- **UI-state branch:** normalize [controlled input values](references/state-controlled-inputs.md)
  and [avoid mirroring URL state](references/state-avoid-derived.md) when local
  state could create a second source of truth.
- **Option branch:** use [parser-level options](references/state-options-inheritance.md),
  [rate limiting](references/perf-limit-url-updates.md), and
  [default removal](references/perf-clear-on-default.md) when policy applies to
  repeated writes.
- **Rendering branch:** [isolate URL-state rerenders](references/perf-avoid-rerender.md)
  when profiling shows unrelated expensive work, and
  [serialize typed links](references/perf-serialize-utility.md) when navigation
  code constructs URLs.
- **History branch:** choose [push for navigation](references/history-push-navigation.md)
  or [replace for ephemeral state](references/history-replace-ephemeral.md),
  then verify [scroll behavior](references/history-scroll-behavior.md) and
  [Back/Forward synchronization](references/history-back-sync.md).
- **Optimistic-router branch:** use
  [optimistic search params](references/advanced-optimistic-search-params.md)
  when Remix or React Router loaders need immediate client feedback.

Complete when each updater has explicit removal, history, server-notification,
scroll, and rate-limit behavior for every key it can change.

## 4. Parse at server boundaries when present

Reuse the parser contract at every loader, request handler, route validator, or
Server Component that reads query state. Prefer `createLoader` for entry-point
parsing. Use `createSearchParamsCache` only when nested Next.js Server
Components need parsed values without prop drilling. When there is no
server-side reader, confirm that the query-state behavior is intentionally
client-first.

Read the matching branch references:

- **Entry-boundary branch:** use [createLoader](references/server-create-loader.md)
  for one-off parsing and its supported input shapes.
- **Nested-RSC branch:** use
  [createSearchParamsCache](references/server-search-params-cache.md) when a
  Next.js App Router page must expose parsed values below its boundary.
- **Shared-contract branch:** [share parsers across client and server](references/server-share-parsers.md)
  instead of defining a second server-only contract.
- **Refresh branch:** use [`shallow: false`](references/server-shallow-false.md)
  only when the update must rerun server work, and expose pending UI with
  [`useTransition`](references/server-use-transition.md) when needed.
- **Next.js async branch:** handle
  [promise-based `searchParams`](references/server-next15-async.md) on supported
  Next.js versions.

Complete when every server boundary parses the shared contract before reading
values, or every key is confirmed to have no server consumer.

## 5. Verify the contract

Run the application's focused typecheck and tests. Exercise representative
URLs for absent, valid, empty, and invalid values, then update and clear every
key. Verify reload, copied-link, Back/Forward, and server refresh behavior for
the selected options. For high-frequency `shallow: false` updates, also verify
the request cadence.

Read the matching branch references:

- **Failure branch:** [enable debug logging](references/debug-enable-logging.md)
  and follow the [common-error diagnoses](references/debug-common-errors.md)
  when behavior differs from the contract.
- **Test branch:** use the [nuqs testing adapter patterns](references/debug-testing.md)
  for component, hook, parser, and URL-update assertions.

Complete when tests and manual checks account for every query key and prove its
parse, serialize, default, clear, navigation, and server-notification behavior.
