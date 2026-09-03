# Preflight: trabalho aberto sobre skills e Intent

Snapshot consultado em 2026-08-26 nos 33 repositórios candidatos da campanha.
A consulta foi somente leitura e procurou issues abertas, pull requests abertos
e Discussions abertas com foco em `TanStack Intent`, `tanstack-intent`, Intent
registry/package skills e agent/AI coding skills.

Os resultados foram coletados por investigadores delegados via GitHub CLI/API.
Termos genéricos como `intent` ou `skills` só foram mantidos quando o título ou
o corpo indicava relação concreta com este trabalho. Um resultado `POSSIBLE`
precisa ser lido antes de decidir; não é autorização para abrir um PR duplicado.

## Decisão rápida

| Resultado | Quantidade | Próxima ação |
|-----------|------------|--------------|
| `RELEVANT` | 13 | Ler e alinhar com o trabalho existente; não abrir PR paralelo. |
| `POSSIBLE` | 2 | Inspecionar o contexto e confirmar se é a mesma iniciativa. |
| `NONE_FOUND` | 18 | Pode seguir para reconhecimento do pacote, salvo nova busca no momento do PR. |

O snapshot é temporal. Faça uma nova busca imediatamente antes de criar branch
ou PR.

## Trabalho aberto relevante

### `vercel/ai` — `RELEVANT`

- Issue [#11446 — Add native support for skills](https://github.com/vercel/ai/issues/11446).
- PR [#18617 — fix(skills): match use-ai-sdk skill name to its directory](https://github.com/vercel/ai/pull/18617).
- Discussions estão desabilitadas.

Não prepare uma skill nova sem verificar o escopo da issue e do PR existentes.

### `shadcn-ui/ui` — `RELEVANT`

Há uma frente ativa de skills, incluindo:

- [#11269 — pin CLI version and remove load-time package execution](https://github.com/shadcn-ui/ui/issues/11269);
- [#11271 — SKILL.md fails in monorepos](https://github.com/shadcn-ui/ui/issues/11271);
- [#9963 — Put skills in separate repo](https://github.com/shadcn-ui/ui/issues/9963);
- [#11515 — pin CLI version and remove load-time package execution](https://github.com/shadcn-ui/ui/pull/11515);
- [#11368 — keep skill loading when info exits 1 at monorepo root](https://github.com/shadcn-ui/ui/pull/11368);
- [#9968 — serve skills from separate repo](https://github.com/shadcn-ui/ui/pull/9968).

Não abra uma contribuição de skill antes de entender essa arquitetura e seus
problemas de segurança/monorepo.

### `TanStack/hotkeys` — `RELEVANT`

- Discussion [#146 — Ship skills on Hotkeys](https://github.com/TanStack/hotkeys/discussions/146).

Use a Discussion existente como ponto de alinhamento.

### `TanStack/query` — `RELEVANT`

- Discussion [#10810 — Ship TanStack Intent skills for React Query](https://github.com/TanStack/query/discussions/10810).

Não abra outro PR para `tanstack-query` sem participar/alinhavar nessa
Discussion.

### `TanStack/store` — `POSSIBLE`

- Discussion [#314 — TanStack Store Skill / Design](https://github.com/TanStack/store/discussions/314).
- PR [#358 — docs: clarify contribution guidelines](https://github.com/TanStack/store/pull/358) é adjacente, mas não foi confirmado como PR de Intent.

Leia a Discussion para confirmar se ela cobre o mesmo tipo de skill antes de
prosseguir.

### `drizzle-team/drizzle-orm` — `RELEVANT`

- Issue [#5990 — Ship drizzle-kit agent skills as one router skill instead of ~8 top-level skills](https://github.com/drizzle-team/drizzle-orm/issues/5990).
- Issue [#5815 — Add Ageniti integration for Agent-friendly tool exposure](https://github.com/drizzle-team/drizzle-orm/issues/5815) é relacionada a agentes, mas pode ter escopo diferente.

A issue #5990 é o ponto de alinhamento para a contribuição de skills.

### `elysiajs/elysia` — `POSSIBLE`

- PR [#1847 — docs: add AGENTS.md for AI coding agent context](https://github.com/elysiajs/elysia/pull/1847).
- Discussion [#1813 — Official CLI tool for ElysiaJS](https://github.com/elysiajs/elysia/discussions/1813).

O trabalho encontrado é sobre contexto para agentes/CLI, não necessariamente
TanStack Intent. Leia ambos antes de classificar como oportunidade distinta.

### `honojs/hono` — `RELEVANT`

- Issue [#4812 — Feature Request: Official AI Agent Skill for Hono](https://github.com/honojs/hono/issues/4812).

Contribua nessa issue ou peça alinhamento antes de abrir um PR separado.

### `prisma/prisma` — `RELEVANT`

- PR [#30088 — docs(skills): fix claims-vs-reality drift from the skills audit](https://github.com/prisma/prisma/pull/30088).

Há trabalho de skills em andamento; confirme se a skill proposta cobre uma lacuna
real do PR existente.

### `vercel/next.js` — `RELEVANT`

Há uma frente extensa de skills e avaliações, incluindo:

- Discussion [#87409 — Turn Next DevTools MCP into a Claude Skill/Agent Skill](https://github.com/vercel/next.js/discussions/87409);
- PR [#91611 — Replace generate-release-log script with agent skill](https://github.com/vercel/next.js/pull/91611);
- PR [#93193 — Add skills CTA to hero and tutorial steps](https://github.com/vercel/next.js/pull/93193);
- PR [#97759 — add adoption skill evals](https://github.com/vercel/next.js/pull/97759);
- PR [#97787 — evaluate static shell optimization](https://github.com/vercel/next.js/pull/97787).

Não trate as quatro skills de Next.js como espaço livre; primeiro entenda a
organização e o fluxo que já estão sendo desenvolvidos.

### `vercel-labs/agent-browser` — `RELEVANT`

Há trabalho aberto sobre o ciclo de vida e o empacotamento de skills, incluindo:

- Issue [#1459 — Deleted upstream skills are not pruned](https://github.com/vercel-labs/agent-browser/issues/1459);
- Issue [#1351 — High LLM turn count due to frequent snapshot calls](https://github.com/vercel-labs/agent-browser/issues/1351);
- Issue [#1116 — Claude Code skill for browser testing workflows](https://github.com/vercel-labs/agent-browser/issues/1116);
- PR [#1079 — Only bundle core agent-browser skill in npm package](https://github.com/vercel-labs/agent-browser/pull/1079).
- Discussions estão desabilitadas.

Alinhe a proposta com o modelo de skills existente e com o escopo do pacote
publicado.

### `pnpm/pnpm` — `RELEVANT`

- Issue [#12701 — Manage AI skills](https://github.com/pnpm/pnpm/issues/12701).
- Discussion [#13422 — RFC: a standard way for packages to communicate to AI coding agents at install time](https://github.com/orgs/pnpm/discussions/13422).

O trabalho pode ser mais amplo que TanStack Intent; leia a RFC antes de propor
um mecanismo paralelo.

### `microsoft/playwright` — `RELEVANT`

- PR [#42245 — Add Cursor support to init-agents and init-skills](https://github.com/microsoft/playwright/pull/42245).
- PR [#42344 — Add WebMCP skill guidance](https://github.com/microsoft/playwright/pull/42344).
- Issues [#42139](https://github.com/microsoft/playwright/issues/42139) e [#42084](https://github.com/microsoft/playwright/issues/42084) tiveram correspondências de corpo possivelmente incidentais; os títulos são sobre component testing.
- Discussions estão desabilitadas.

Os PRs de agent skills são relevantes; as duas issues devem ser tratadas como
possíveis falsos positivos.

### `vercel/turborepo` — `RELEVANT`

- Discussion [#12661 — Ship the Turborepo Agent Skill inside the turbo npm package](https://github.com/vercel/turborepo/discussions/12661).

Use a Discussion existente como ponto de partida.

### `expo/expo` — `RELEVANT`

Há vários PRs abertos para skills e sua distribuição, incluindo:

- PR [#49019 — Add agent evals inside the shipped skill](https://github.com/expo/expo/pull/49019);
- PR [#49018 — Print installed skills to coding agents](https://github.com/expo/expo/pull/49018);
- PR [#48973 — Auto-sync agent skills on expo start](https://github.com/expo/expo/pull/48973);
- PR [#48972 — Auto-sync agent skills on expo install](https://github.com/expo/expo/pull/48972);
- PR [#48796 — Ship an agent skill in the npm package](https://github.com/expo/expo/pull/48796);
- PR [#48592 — Add expo skills command for npm packages](https://github.com/expo/expo/pull/48592).

Não abra uma skill nova sem revisar esse fluxo ativo.

## Nenhum trabalho relevante encontrado

Nestes 18 repositórios não foi encontrado trabalho aberto relevante na consulta.
Isso não elimina a necessidade de repetir a busca antes do PR.

| Repositório | Discussions |
|-------------|-------------|
| `fellipeutaka/denji` | Nenhuma correspondência relevante |
| `fellipeutaka/kanpeki` | Nenhuma correspondência relevante |
| `motiondivision/motion` | Nenhuma correspondência relevante |
| `47ng/nuqs` | Nenhuma correspondência relevante |
| `opral/paraglide-js` | Desabilitadas |
| `TanStack/form` | Nenhuma correspondência relevante |
| `TanStack/pacer` | Nenhuma correspondência relevante |
| `TanStack/virtual` | Nenhuma correspondência relevante |
| `pmndrs/zustand` | Nenhuma correspondência relevante |
| `nestjs/nest` | Nenhuma correspondência relevante |
| `better-auth/better-auth` | Nenhuma correspondência relevante |
| `fastify/fastify` | Nenhuma correspondência relevante |
| `resend/react-email` | Nenhuma correspondência relevante |
| `oven-sh/bun` | Nenhuma correspondência relevante |
| `colinhacks/zod` | Nenhuma correspondência relevante |
| `react-hook-form/react-hook-form` | Nenhuma correspondência relevante |
| `react/react-native` | Desabilitadas |
| `tauri-apps/tauri` | Nenhuma correspondência relevante |

## Limitações

- A consulta foi feita em um momento específico; issues, PRs e Discussions podem
  mudar antes da próxima execução.
- A busca depende dos índices e limites da API do GitHub. O lote de Next.js teve
  um hit de rate limit em uma busca REST, mas foi conferido novamente via
  GraphQL; o resultado relevante permaneceu confirmado.
- “Relevante” significa que existe trabalho relacionado a skills/agentes, não que
  a iniciativa aceite exatamente uma skill TanStack Intent.
- Nenhum comentário, issue, Discussion, branch, commit ou PR foi criado como
  parte desta verificação.
