---
title: Select and Mount the Matching NuqsAdapter
impact: CRITICAL
tags: setup, NuqsAdapter, provider, next, remix, react-router, tanstack-router
---

## Select and Mount the Matching NuqsAdapter

Read this reference when installing nuqs, changing routers, or reviewing a
provider boundary. Inspect the installed framework and router major version,
confirm that it satisfies the installed `nuqs` package's peer dependencies,
select the exact adapter import, and mount one provider around every React tree
that contains a nuqs consumer.

| Runtime                    | Adapter import                  | Provider boundary                           |
| -------------------------- | ------------------------------- | ------------------------------------------- |
| Next.js App Router         | `nuqs/adapters/next/app`        | Root layout, around `children`              |
| Next.js Pages Router       | `nuqs/adapters/next/pages`      | Custom App, around `Component`              |
| Next.js using both routers | `nuqs/adapters/next`            | The App or layout that hosts nuqs consumers |
| React SPA                  | `nuqs/adapters/react`           | Root render, around the application         |
| Remix                      | `nuqs/adapters/remix`           | Root route, around `Outlet`                 |
| React Router v6            | `nuqs/adapters/react-router/v6` | Around `RouterProvider`                     |
| React Router v7            | `nuqs/adapters/react-router/v7` | Root route, around `Outlet`                 |
| React Router v8            | `nuqs/adapters/react-router/v8` | Root route, around `Outlet`                 |
| TanStack Router            | `nuqs/adapters/tanstack-router` | Root route, around `Outlet`                 |
| Tests                      | `nuqs/adapters/testing`         | Component or hook render wrapper            |

Prefer the App- or Pages-specific Next.js adapter. Use the unified adapter only
when the application genuinely mounts nuqs consumers under both routers.

Pin React Router imports to `/v6`, `/v7`, or `/v8`. The unversioned
`nuqs/adapters/react-router` alias is deprecated for removal in nuqs 3. Remix
and React Router v6 have reached end of life, and their adapters are also
scheduled for removal in nuqs 3; preserve them only for existing applications
that still use those router versions. The v8 adapter currently re-exports the
v7 implementation, but the versioned path protects future migrations.

For a React SPA that must turn `shallow: false` into full-page navigation, set
`fullPageNavigationOnShallowFalseUpdates` on the adapter. Leave it unset when
client-first URL updates are the intended behavior.

TanStack Router support is experimental and does not cover TanStack Start.
For route-level `validateSearch` typing, follow the
[Standard Schema integration](advanced-standard-schema.md). When property and
URL names differ, apply the documented
[`urlKeys` limitation](advanced-url-keys.md).

Use the testing adapter through the documented
[component and hook patterns](debug-testing.md); production trees use the
framework adapter.
