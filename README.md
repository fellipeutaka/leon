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

| Skill | Description | Source |
|-------|-------------|--------|
| [agent-browser](skills/agent-browser/) | Browser automation CLI for AI agents | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) |
| [commit-work](skills/commit-work/) | High-quality git commits | [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) |
| [composition-patterns](skills/composition-patterns/) | React composition patterns that scale | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [denji](skills/denji/) | Manage SVG icons as framework components | [fellipeutaka/denji](https://github.com/fellipeutaka/denji) |
| [elysia](skills/elysia/) | Type-safe, high-performance backend with ElysiaJS | [elysiajs/skills](https://github.com/elysiajs/skills) |
| [hono](skills/hono/) | Develop Hono applications using Hono CLI | [yusukebe/hono-skill](https://github.com/yusukebe/hono-skill) |
| [kanpeki](skills/kanpeki/) | Accessible UI components with Kanpeki library | [fellipeutaka/kanpeki](https://github.com/fellipeutaka/kanpeki) |
| [motion](skills/motion/) | React animations with Motion (Framer Motion) | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) |
| [next-best-practices](skills/next-best-practices/) | Next.js best practices and conventions | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [next-cache-components](skills/next-cache-components/) | Next.js 16 cache components and PPR | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [next-upgrade](skills/next-upgrade/) | Upgrade Next.js to latest version | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| [react-best-practices](skills/react-best-practices/) | React/Next.js performance optimization | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [react-email](skills/react-email/) | HTML email templates with React components | [resend/react-email](https://github.com/resend/react-email) |
| [react-native-skills](skills/react-native-skills/) | React Native and Expo best practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| [turborepo](skills/turborepo/) | Turborepo monorepo build system guidance | [vercel/turborepo](https://github.com/vercel/turborepo) |
| [web-design-guidelines](skills/web-design-guidelines/) | Web Interface Guidelines compliance review | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |

## License

Licensed under the [MIT license](./LICENSE).
