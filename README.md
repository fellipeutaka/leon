# Leon

Curated collection of Agent Skills for AI coding agents. Named after Leon S. Kennedy from Resident Evil.

Skills follow the [Agent Skills](https://agentskills.io/) format.

## Installation

```bash
npx skills add fellipeutaka/leon
```

## Upstream Sync

Some skills are synced from external repos. Tracked in `upstream.json`.

```bash
bun sync
bun sync --new-only  # sync only skills without a prior sync
```

## Recommended Skills by Stack

Quick reference for adding skills based on your tech stack:

### Next.js

```bash
npx skills add fellipeutaka/leon --skill baseline-ui clean-code commit-work composition-patterns denji design-lab fixing-accessibility fixing-metadata fixing-motion-performance frontend-design interaction-design motion next-best-practices next-cache-components-optimizer next-cache-components-adoption next-upgrade nuqs paraglide-js react-hook-form-zod seo-audit shadcn tanstack-query tanstack-router wcag-audit-patterns web-design-guidelines zod zustand
```

### React (non-Next.js)

```bash
npx skills add fellipeutaka/leon --skill baseline-ui clean-code commit-work composition-patterns denji design-lab fixing-accessibility fixing-motion-performance frontend-design interaction-design motion react-best-practices react-hook-form-zod shadcn tanstack-query tanstack-router wcag-audit-patterns web-design-guidelines zod zustand
```

### React Native / Expo

```bash
npx skills add fellipeutaka/leon --skill baseline-ui clean-code commit-work design-lab fixing-accessibility frontend-design interaction-design react-hook-form-zod react-native-skills tanstack-query tdd ui-ux-pro-max wcag-audit-patterns zod zustand
```

### SwiftUI (iOS)

```bash
npx skills add fellipeutaka/leon --skill clean-code commit-work swiftui-ui-patterns tdd wcag-audit-patterns
```

### Full-Stack / Monorepo

```bash
npx skills add fellipeutaka/leon --skill ai-sdk better-auth bun clean-code commit-work design-patterns docker drizzle-orm next-best-practices playwright prisma solid tanstack-start tdd turborepo zod
```

### Backend (Node.js)

```bash
npx skills add fellipeutaka/leon --skill better-auth bun clean-code commit-work design-patterns docker drizzle-orm elysia fastify nestjs nginx prisma solid tdd zod
```

### Backend (Rust)

```bash
npx skills add fellipeutaka/leon --skill clean-code commit-work docker nginx rust tdd
```

## Skills

### Frontend

| Skill | Description | Source |
|-------|-------------|--------|
| [ai-sdk](skills/ai-sdk/) | AI SDK for building AI-powered features — generateText, streamText, useChat, tool calling | [vercel/ai](https://github.com/vercel/ai) |
| [baseline-ui](skills/baseline-ui/) | Validates animation durations, enforces typography scale, checks component accessibility, prevents layout anti-patterns in Tailwind CSS | [ibelick/ui-skills](https://github.com/ibelick/ui-skills) |
| [canvas-design](skills/canvas-design/) | Create beautiful visual art in .png and .pdf using design philosophy | Curated |
| [composition-patterns](skills/composition-patterns/) | React composition patterns that scale | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [denji](skills/denji/) | Manage SVG icons as framework components | [fellipeutaka/denji](https://github.com/fellipeutaka/denji) |
| [design-lab](skills/design-lab/) | Conduct design interviews, generate five distinct UI variations, collect feedback, produce implementation plans | Curated |
| [fixing-accessibility](skills/fixing-accessibility/) | Audit and fix HTML accessibility — ARIA labels, keyboard navigation, focus management, color contrast, form errors | [ibelick/ui-skills](https://github.com/ibelick/ui-skills) |
| [fixing-metadata](skills/fixing-metadata/) | Audit and fix HTML metadata — page titles, meta descriptions, canonical URLs, Open Graph, Twitter cards, JSON-LD | [ibelick/ui-skills](https://github.com/ibelick/ui-skills) |
| [fixing-motion-performance](skills/fixing-motion-performance/) | Audit and fix animation performance — layout thrashing, compositor properties, scroll-linked motion, blur effects | [ibelick/ui-skills](https://github.com/ibelick/ui-skills) |
| [frontend-design](skills/frontend-design/) | Create distinctive, production-grade frontend interfaces with high design quality | [anthropics/claude-code](https://github.com/anthropics/claude-code) |
| [interface-design](skills/interface-design/) | Interface design for dashboards, admin panels, and interactive products | [Dammyjay93/interface-design](https://github.com/Dammyjay93/interface-design) |
| [interaction-design](skills/interaction-design/) | Design microinteractions, motion design, transitions, and user feedback patterns | Curated |
| [kanpeki](skills/kanpeki/) | Accessible UI components with Kanpeki library | [fellipeutaka/kanpeki](https://github.com/fellipeutaka/kanpeki) |
| [motion](skills/motion/) | React animations with Motion (Framer Motion) | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) |
| [nuqs](skills/nuqs/) | Type-safe URL query state management with nuqs 2.x | Curated |
| [paraglide-js](skills/paraglide-js/) | Compiler-based i18n library — compiled message functions, locale strategies, i18n routing, SSR/SSG | Curated |
| [react-best-practices](skills/react-best-practices/) | React/Next.js performance optimization | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [react-hook-form-zod](skills/react-hook-form-zod/) | Type-safe forms with React Hook Form v7 and Zod v4 | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) |
| [react-native-skills](skills/react-native-skills/) | React Native and Expo best practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [shadcn](skills/shadcn/) | shadcn/ui component management — adding, searching, fixing, styling, and composing UI components | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) |
| [tanstack-ai](skills/tanstack-ai/) | Build AI-powered chat applications with TanStack AI and React | Curated |
| [tanstack-db](skills/tanstack-db/) | TanStack DB local-first database with live queries and optimistic mutations | Curated |
| [tanstack-form](skills/tanstack-form/) | TanStack Form type-safe form management, validation, and composition | Curated |
| [tanstack-hotkeys](skills/tanstack-hotkeys/) | Type-safe keyboard shortcut management for React | Curated |
| [tanstack-query](skills/tanstack-query/) | TanStack Query v5 data fetching, caching, and mutations | Curated |
| [tanstack-react-store](skills/tanstack-react-store/) | Global state management in React apps using TanStack Store | Curated |
| [tanstack-router](skills/tanstack-router/) | TanStack Router type-safe routing, search params, and data loading | Curated |
| [tanstack-virtual](skills/tanstack-virtual/) | TanStack Virtual headless virtualization for large lists and grids | Curated |
| [tanstack-pacer](skills/tanstack-pacer/) | TanStack Pacer execution control — debouncing, throttling, rate limiting, queuing, batching | Curated |
| [tanstack-table](skills/tanstack-table/) | TanStack Table headless data grid with sorting, filtering, and pagination | Curated |
| [ui-ux-pro-max](skills/ui-ux-pro-max/) | UI/UX design intelligence — 50+ styles, 161 color palettes, 57 font pairings, 99 UX guidelines | Curated |
| [web-design-guidelines](skills/web-design-guidelines/) | Web Interface Guidelines compliance review | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [zustand](skills/zustand/) | Global state management for React/TypeScript applications | Curated |

### Backend & Systems

| Skill | Description | Source |
|-------|-------------|--------|
| [drizzle-orm](skills/drizzle-orm/) | Drizzle ORM type-safe lightweight TypeScript ORM for SQL databases | Curated |
| [nestjs](skills/nestjs/) | NestJS best practices for production-ready REST APIs, GraphQL APIs, and microservices | Curated |
| [better-auth](skills/better-auth/) | Framework-agnostic TypeScript auth & authorization — email/password, OAuth, passkeys, 2FA, orgs, plugins | Curated |
| [elysia](skills/elysia/) | Type-safe, high-performance backend with ElysiaJS | [elysiajs/skills](https://github.com/elysiajs/skills) |
| [fastify](skills/fastify/) | Fastify development best practices | [mcollina/skills](https://github.com/mcollina/skills) |
| [hono](skills/hono/) | Develop Hono applications using Hono CLI | [yusukebe/hono-skill](https://github.com/yusukebe/hono-skill) |
| [prisma](skills/prisma/) | Prisma ORM type-safe database toolkit with schema-first approach | Curated |
| [rust](skills/rust/) | Memory-safe, high-performance Rust — ownership, async/Tokio, traits, error handling | Curated |

### Full-Stack Frameworks

| Skill | Description | Source |
|-------|-------------|--------|
| [next-best-practices](skills/next-best-practices/) | Next.js best practices and conventions | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [next-cache-components-optimizer](skills/next-cache-components-optimizer/) | Optimize a Next.js app that has `cacheComponents: true` | [vercel-labs/next-skills](https://github.com/vercel/next.js/tree/canary/skills) |
| [next-cache-components-adoption](skills/next-cache-components-adoption/) | Enable, adopt, or migrate to Cache Components | [vercel-labs/next-skills](https://github.com/vercel/next.js/tree/canary/skills) |
| [next-upgrade](skills/next-upgrade/) | Upgrade Next.js to latest version | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [tanstack-start](skills/tanstack-start/) | TanStack Start full-stack React framework with SSR, server functions, and streaming | Curated |

### Software Design

| Skill | Description | Source |
|-------|-------------|--------|
| [clean-code](skills/clean-code/) | Clean Code principles — naming, functions, formatting, error handling, code smells, Object Calisthenics | Curated |
| [design-patterns](skills/design-patterns/) | All 22 Gang of Four design patterns with TypeScript implementations | Curated |
| [solid](skills/solid/) | SOLID principles — SRP, OCP, LSP, ISP, DIP with detection heuristics and examples | Curated |
| [tdd](skills/tdd/) | Test-driven development with red-green-refactor loop | [mattpocock/skills](https://github.com/mattpocock/skills) |

### DevOps

| Skill | Description | Source |
|-------|-------------|--------|
| [docker](skills/docker/) | Docker containerization, security, and Compose orchestration | Curated |
| [nginx](skills/nginx/) | Nginx web server and reverse proxy — configuration, load balancing, SSL/TLS, caching, and security hardening | Curated |

### Mobile

| Skill | Description | Source |
|-------|-------------|--------|
| [swiftui-ui-patterns](skills/swiftui-ui-patterns/) | Best practices for SwiftUI — navigation hierarchies, custom view modifiers, responsive layouts, @State/@Binding | Curated |

### Validation & Type Safety

| Skill | Description | Source |
|-------|-------------|--------|
| [wcag-audit-patterns](skills/wcag-audit-patterns/) | WCAG 2.2 accessibility audits with automated testing, manual verification, and remediation guidance | Curated |
| [zod](skills/zod/) | Zod 4 TypeScript-first schema validation with static type inference | Curated |

### Tooling

| Skill | Description | Source |
|-------|-------------|--------|
| [agent-browser](skills/agent-browser/) | Browser automation CLI for AI agents | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) |
| [ai-repo-setup](skills/ai-repo-setup/) | Set up repositories for AI agents — AGENTS.md, CLAUDE.md, docs/REQUIREMENTS.md, docs/BUSINESS-RULES.md, feedback loops, deterministic enforcement | Curated |
| [commit-work](skills/commit-work/) | High-quality git commits | [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) |
| [creating-a-changeset](skills/creating-a-changeset/) | Create and validate Changeset files for user-facing package changes | Curated |
| [gh-stack](skills/gh-stack/) | Manage stacked branches and pull requests with the GitHub CLI | [github/gh-stack](https://github.com/github/gh-stack) |
| [playwright](skills/playwright/) | Write, debug, and maintain Playwright end-to-end tests for web applications | Curated |
| [react-email](skills/react-email/) | HTML email templates with React components | [resend/react-email](https://github.com/resend/react-email) |
| [bun](skills/bun/) | Bun runtime, package manager, bundler, and test runner | Curated |
| [pnpm](skills/pnpm/) | Node.js package manager with strict dependency resolution, workspaces, catalogs | [antfu/skills](https://github.com/antfu/skills) |
| [seo-audit](skills/seo-audit/) | SEO audit, technical SEO diagnostics, meta tags review, on-page SEO health check | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) |
| [tauri](skills/tauri/) | Cross-platform desktop/mobile apps with Rust backends and web frontends | Curated |
| [turborepo](skills/turborepo/) | Turborepo monorepo build system guidance | [vercel/turborepo](https://github.com/vercel/turborepo) |

## License

Licensed under the [MIT license](./LICENSE).

## Local variants

The Matt-derived engineering flow skills in `skills/implement`,
`skills/ask-matt`, and `skills/to-tickets` are maintained as downstream
variants in this repository. Their upstream commits and manual sync policy are
tracked in [`downstream.json`](./downstream.json).

They add optional stacked-PR and integration-branch delivery through the
`gh-stack` skill while keeping issue blockers and product specs independent
from branch topology. Read the [custom implement flow guide](docs/implement-flow.md)
for the differences from Matt's upstream flow and usage examples. They are
intentionally not listed in `upstream.json`, because the automatic upstream
sync would overwrite the local changes.
