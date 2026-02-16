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

## Skills

### Frontend

| Skill | Description | Source |
|-------|-------------|--------|
| [ai-sdk](skills/ai-sdk/) | AI SDK for building AI-powered features — generateText, streamText, useChat, tool calling | [vercel/ai](https://github.com/vercel/ai) |
| [composition-patterns](skills/composition-patterns/) | React composition patterns that scale | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [denji](skills/denji/) | Manage SVG icons as framework components | [fellipeutaka/denji](https://github.com/fellipeutaka/denji) |
| [kanpeki](skills/kanpeki/) | Accessible UI components with Kanpeki library | [fellipeutaka/kanpeki](https://github.com/fellipeutaka/kanpeki) |
| [motion](skills/motion/) | React animations with Motion (Framer Motion) | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) |
| [react-best-practices](skills/react-best-practices/) | React/Next.js performance optimization | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [react-hook-form-zod](skills/react-hook-form-zod/) | Type-safe forms with React Hook Form v7 and Zod v4 | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) |
| [react-native-skills](skills/react-native-skills/) | React Native and Expo best practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [tanstack-form](skills/tanstack-form/) | TanStack Form type-safe form management, validation, and composition | Curated |
| [tanstack-query](skills/tanstack-query/) | TanStack Query v5 data fetching, caching, and mutations | Curated |
| [tanstack-router](skills/tanstack-router/) | TanStack Router type-safe routing, search params, and data loading | Curated |
| [tanstack-pacer](skills/tanstack-pacer/) | TanStack Pacer execution control — debouncing, throttling, rate limiting, queuing, batching | Curated |
| [tanstack-table](skills/tanstack-table/) | TanStack Table headless data grid with sorting, filtering, and pagination | Curated |
| [web-design-guidelines](skills/web-design-guidelines/) | Web Interface Guidelines compliance review | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |

### Backend

| Skill | Description | Source |
|-------|-------------|--------|
| [elysia](skills/elysia/) | Type-safe, high-performance backend with ElysiaJS | [elysiajs/skills](https://github.com/elysiajs/skills) |
| [fastify](skills/fastify/) | Fastify development best practices | [mcollina/skills](https://github.com/mcollina/skills) |
| [hono](skills/hono/) | Develop Hono applications using Hono CLI | [yusukebe/hono-skill](https://github.com/yusukebe/hono-skill) |

### Full-Stack Frameworks

| Skill | Description | Source |
|-------|-------------|--------|
| [next-best-practices](skills/next-best-practices/) | Next.js best practices and conventions | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [next-cache-components](skills/next-cache-components/) | Next.js 16 cache components and PPR | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [next-upgrade](skills/next-upgrade/) | Upgrade Next.js to latest version | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [tanstack-start](skills/tanstack-start/) | TanStack Start full-stack React framework with SSR, server functions, and streaming | Curated |

### Software Design

| Skill | Description | Source |
|-------|-------------|--------|
| [clean-code](skills/clean-code/) | Clean Code principles — naming, functions, formatting, error handling, code smells, Object Calisthenics | Curated |
| [design-patterns](skills/design-patterns/) | All 22 Gang of Four design patterns with TypeScript implementations | Curated |
| [solid](skills/solid/) | SOLID principles — SRP, OCP, LSP, ISP, DIP with detection heuristics and examples | Curated |

### DevOps

| Skill | Description | Source |
|-------|-------------|--------|
| [docker](skills/docker/) | Docker containerization, security, and Compose orchestration | Curated |

### Tooling

| Skill | Description | Source |
|-------|-------------|--------|
| [agent-browser](skills/agent-browser/) | Browser automation CLI for AI agents | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) |
| [commit-work](skills/commit-work/) | High-quality git commits | [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) |
| [react-email](skills/react-email/) | HTML email templates with React components | [resend/react-email](https://github.com/resend/react-email) |
| [turborepo](skills/turborepo/) | Turborepo monorepo build system guidance | [vercel/turborepo](https://github.com/vercel/turborepo) |

## License

Licensed under the [MIT license](./LICENSE).
